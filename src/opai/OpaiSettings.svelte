<script lang="ts">
    import {get} from 'svelte/store';
    import type {ModuleSetting} from '../integration/types';
    import {opaiPreferences, type OpaiPreferences} from './preferences';
    import OpaiSetting from './OpaiSetting.svelte';

    export let disabled: boolean;
    export let change: <K extends keyof OpaiPreferences>(key: K, value: OpaiPreferences[K]) => Promise<void>;

    type BooleanKey = 'shadows' | 'blur' | 'loadKeybinds' | 'icmpPing' | 'search';
    type Field = {key: BooleanKey | 'islandStyle' | 'targetHudStyle' | 'hudBackground' | 'nametagDistance' | 'bedDistance'; name: string};
    const fields: Field[] = [
        {key: 'shadows', name: 'Shadows'},
        {key: 'blur', name: 'Blur'},
        {key: 'islandStyle', name: 'Dynamic Island'},
        {key: 'targetHudStyle', name: 'Target HUD'},
        {key: 'hudBackground', name: 'HUD Background'},
        {key: 'nametagDistance', name: 'Nametag Distance'},
        {key: 'bedDistance', name: 'Bed Distance'},
        {key: 'loadKeybinds', name: 'Restore Keybinds'},
        {key: 'icmpPing', name: 'ICMP Ping'},
        {key: 'search', name: 'ClickGUI Search'},
    ];

    function controls(preferences: OpaiPreferences): ModuleSetting[] {
        return fields.map(({key, name}) => {
            const common = {name, description: undefined, key: undefined};
            if (key === 'targetHudStyle') {
                return {...common, valueType: 'CHOOSE', choices: ['New', 'Old', 'IDK'], value: preferences[key] === 'idk' ? 'IDK' : preferences[key] === 'old' ? 'Old' : 'New'};
            }
            if (key === 'nametagDistance' || key === 'bedDistance') {
                return {...common, valueType: 'INT', value: preferences[key], range: {from: 8, to: 256}, suffix: 'm'};
            }
            if (key === 'islandStyle') {
                return {...common, valueType: 'CHOOSE', choices: ['New', 'Old'], value: preferences[key] === 'old' ? 'Old' : 'New'};
            }
            if (key === 'hudBackground') {
                return {...common, valueType: 'CHOOSE', choices: ['Translucent', 'Dark Gray'], value: preferences[key] === 'solid' ? 'Dark Gray' : 'Translucent'};
            }
            return {...common, valueType: 'BOOLEAN', value: preferences[key]};
        });
    }

    let settings: ModuleSetting[];
    $: settings = controls($opaiPreferences);

    async function commit(index: number) {
        const {key} = fields[index];
        const value = settings[index].value;
        if (key === 'targetHudStyle') {
            await change(key, value === 'IDK' ? 'idk' : value === 'Old' ? 'old' : 'new');
        } else if (key === 'nametagDistance' || key === 'bedDistance') {
            await change(key, Math.round(Math.max(8, Math.min(256, Number(value)))));
        } else if (key === 'islandStyle') {
            await change(key, value === 'Old' ? 'old' : 'new');
        } else if (key === 'hudBackground') {
            await change(key, value === 'Dark Gray' ? 'solid' : 'translucent');
        } else {
            await change(key, value === true);
        }
        settings = controls(get(opaiPreferences));
    }
</script>

<fieldset class="opai-preferences" aria-label="Opai settings" {disabled}>
    {#each fields as field, index (field.key)}
        <OpaiSetting path="opai.preferences" displayName={field.name} bind:setting={settings[index]} on:change={() => commit(index)}/>
    {/each}
</fieldset>

<style>
    .opai-preferences { margin: 0; min-width: 0; padding: 0; border: 0; }
    .opai-preferences:disabled { opacity: .7; }
    .opai-preferences :global(.boolean .setting-label) { white-space: normal; line-height: 1.2; }
</style>
