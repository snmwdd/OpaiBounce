<script lang="ts">
    import {get} from 'svelte/store';
    import type {ModuleSetting} from '../integration/types';
    import {opaiPreferences, type OpaiPreferences} from './preferences';
    import OpaiSetting from './OpaiSetting.svelte';

    export let disabled: boolean;
    export let change: <K extends keyof OpaiPreferences>(key: K, value: OpaiPreferences[K]) => Promise<void>;

    type BooleanKey = Exclude<keyof OpaiPreferences, 'islandStyle'>;
    const fields: {key: keyof OpaiPreferences; name: string}[] = [
        {key: 'shadows', name: 'Enable Shadows'},
        {key: 'blur', name: 'Enable Blur'},
        {key: 'islandStyle', name: 'Dynamic Island Style'},
        {key: 'loadKeybinds', name: 'Load Key Binds with Configurations'},
        {key: 'icmpPing', name: 'Use Independent Ping'},
        {key: 'search', name: 'Show ClickGUI Search'},
    ];

    function controls(preferences: OpaiPreferences): ModuleSetting[] {
        return fields.map(({key, name}) => {
            const common = {name, description: undefined, key: undefined};
            if (key === 'islandStyle') {
                return {...common, valueType: 'CHOOSE', choices: ['New', 'Old'], value: preferences.islandStyle === 'old' ? 'Old' : 'New'};
            }
            return {...common, valueType: 'BOOLEAN', value: preferences[key]};
        });
    }

    let settings: ModuleSetting[];
    $: settings = controls($opaiPreferences);

    async function commit(index: number) {
        const {key} = fields[index];
        const value = settings[index].value;
        if (key === 'islandStyle') {
            await change(key, value === 'Old' ? 'old' : 'new');
        } else {
            await change(key as BooleanKey, value === true);
        }
        settings = controls(get(opaiPreferences));
    }
</script>

<fieldset class="opai-preferences" aria-label="Opai settings" {disabled}>
    {#each fields as field, index (field.key)}
        <OpaiSetting path="opai.preferences" bind:setting={settings[index]} on:change={() => commit(index)}/>
    {/each}
</fieldset>

<style>
    .opai-preferences { margin: 0; min-width: 0; padding: 0; border: 0; }
    .opai-preferences:disabled { opacity: .7; }
    .opai-preferences :global(.boolean .setting-label) { white-space: normal; line-height: 1.2; }
</style>
