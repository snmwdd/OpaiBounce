<script lang="ts">
    import {createEventDispatcher} from 'svelte';
    import type {ConfigurableSetting, ModuleSetting} from '../integration/types';
    import OpaiSetting from './OpaiSetting.svelte';

    export let configurable: ConfigurableSetting;
    export let path: string;
    const dispatch = createEventDispatcher();
    const checkNames: Record<string, string> = {
        AutoBlock:'Auto Block', LegitScaffold:'Eagle', Scaffold:'Scaffold', ScaffoldBPS:'Scaffold BPS',
        TellyScaffold:'Telly Scaffold', NoSlow:'No Slow', Nuker:'Nuker', BedNuker:'Bed Nuker',
        AirHover:'Air Hover', GroundSpeed:'Ground Speed', AimAssist:'Aim Assist', AutoClicker:'Auto Clicker',
        Blink:'Blink', FastMine:'Fast Mine', NoFall:'No Fall', Protocol:'Protocol',
        AutoThrow:'Auto Throw', AutoBow:'Auto Bow',
    };
    const fieldNames: Record<string, string> = {
        AlertVL:'Cheater VL', FlagIntervalSeconds:'Flag Interval (s)', VL:'VL per Flag',
        VLReset:'Reset VL', VLResetSettingsIntervalSeconds:'Reset Interval (s)',
        WindowSeconds:'Time Window (s)', BlockTimeSeconds:'Block Time (s)', HoldSeconds:'Hold Time (s)',
        LockSeconds:'Lock Time (s)', WaitSeconds:'Wait Time (s)', JumpTimeSeconds:'Jump Time (s)',
        BlockRatio:'Blocking Ratio', LockRatio:'Lock Ratio', MaxBPS:'Max BPS', MaxCPS:'Max CPS',
        MaxRate:'Max per Second', MinDistance:'Min Distance', TargetRadius:'Target Radius',
        TimingMs:'Timing Spread (ms)', MaxBreakMs:'Break Time (ms)', MinSpeed:'Min Speed (BPS)',
        MinTravel:'Jump Travel', MaxVerticalStep:'Vertical Step', AimAngle:'Aim Angle',
        MaxPitch:'Max Pitch', MinPitch:'Min Pitch', SmoothTicks:'Smooth Ticks',
    };
    type Group = {key: string; nativeName: string; setting: ModuleSetting};
    let groups: Group[] = [];
    let general: ModuleSetting[] = [];
    let labels: Record<string, string> = {};
    let resetSwitch: ModuleSetting | undefined;
    let resetInterval: ModuleSetting | undefined;

    $: {
        groups = [];
        general = [];
        labels = {...fieldNames};
        resetSwitch = configurable.value.find(setting => setting.name === 'VLReset');
        resetInterval = configurable.value.find(setting => setting.name === 'VLResetSettingsIntervalSeconds');
        for (const setting of configurable.value) {
            if (setting.name === 'Bind' || setting.name === 'Hidden' || setting.name === 'VLAbove10ToAlert') continue;
            if (setting.name.startsWith('VLReset')) continue;
            if (setting.name.includes('Settings')) {
                const field = setting.name.split('Settings')[1];
                labels[setting.name] = fieldNames[field] ?? field.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
                continue;
            }
            const key = setting.name.replace(/Detection$/, '');
            if (setting.valueType === 'BOOLEAN' && checkNames[key]) {
                const children = configurable.value.filter(value => value.name.startsWith(key + 'Settings'));
                labels[key] = checkNames[key];
                groups.push({key, nativeName:setting.name, setting:{
                    name:key, valueType:'TOGGLEABLE', value:[{...setting,name:'Enabled'}, ...children],
                } as ModuleSetting});
            } else {
                general.push(setting);
            }
        }
    }

    function saveGroup(group: Group) {
        const values = (group.setting as ConfigurableSetting).value;
        const enabled = values.find(value => value.name === 'Enabled');
        const replacements = new Map(values.filter(value => value !== enabled).map(value => [value.name, value]));
        configurable = {...configurable, value:configurable.value.map(value => {
            if (value.name === group.nativeName && enabled) return {...value, value:enabled.value} as ModuleSetting;
            return replacements.get(value.name) ?? value;
        })};
        dispatch('change');
    }

    function saveGeneral(index: number) {
        saveField(general[index]);
    }

    function saveField(updated: ModuleSetting | undefined) {
        if (!updated) return;
        configurable = {...configurable, value:configurable.value.map(value => value.name === updated.name ? updated : value)};
        dispatch('change');
    }
</script>

{#each general as setting, index (setting.name)}
    <OpaiSetting {path} {labels} bind:setting={general[index]} on:change={() => saveGeneral(index)}/>
{/each}
{#if resetSwitch}
    <OpaiSetting {path} {labels} bind:setting={resetSwitch} on:change={() => saveField(resetSwitch)}/>
    {#if resetSwitch.value === true && resetInterval}
        <OpaiSetting {path} {labels} bind:setting={resetInterval} on:change={() => saveField(resetInterval)}/>
    {/if}
{/if}
{#each groups as group, index (group.key)}
    <OpaiSetting {path} {labels} bind:setting={groups[index].setting} on:change={() => saveGroup(groups[index])}/>
{/each}
