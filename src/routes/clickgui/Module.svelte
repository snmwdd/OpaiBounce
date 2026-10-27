<script lang="ts">
    import {ripple} from '../../opai/motion';
    import {secondaryClick} from "../../opai/secondaryClick";
    import {onMount,onDestroy} from "svelte";
    import {listen} from "../../integration/ws";
    import type {BindSetting} from "../../integration/types";
    import {
        getModuleSettings,
        setModuleSettings,
        setModuleEnabled,
        setTyping,
    } from "../../integration/rest";
    import type {ConfigurableSetting} from "../../integration/types";
    import GenericSetting from "./setting/common/GenericSetting.svelte";
    import {previewModule} from '../../opai/scriptBridge';
    import {get} from 'svelte/store';
    import Reveal from "../../opai/Reveal.svelte";

    import {description as descriptionStore, highlightModuleName} from "./clickgui_store";
    import {persistentDataLoaded,setItem} from "../../integration/persistent_storage";
    import {convertToSpacedString, spaceSeperatedNames} from "../../theme/theme_config";
    import {scaleFactor,bindingModule} from "./clickgui_store";

    export let name: string;
    export let enabled: boolean;
    export let description: string;
    export let aliases: string[];

    let moduleNameElement: HTMLElement;
    let configurable: ConfigurableSetting | undefined;
    const path = `opai.module.${name}`;
    let expanded = false;
    let settingsVersion = 0;
    onMount(() => {
        const refresh = async () => { if(expanded){ await fetchModuleSettings(); settingsVersion++; }else configurable=undefined; };
        window.addEventListener('opai-profile-loaded',refresh);
        return () => window.removeEventListener('opai-profile-loaded',refresh);
    });
    onMount(() => {
        let alive=true;
        persistentDataLoaded.then(async()=>{if(!alive)return;expanded=localStorage.getItem(path)==='true';if(expanded)await fetchModuleSettings();});
        return()=>{alive=false;};
    });

    const unsubscribeHighlight = highlightModuleName.subscribe((m) => {
        if (name !== m) {
            return;
        }

        setTimeout(() => {
            if (!moduleNameElement) {
                return;
            }
            moduleNameElement.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }, 1000);
    });

    onDestroy(() => {if(get(previewModule)?.name===name)previewModule.set(null); unsubscribeHighlight(); if($bindingModule === name) { bindingModule.set(null); setTyping(false).catch(() => {}); } });
    async function bindKey(event: MouseEvent) {
        if(event.button !== 1) return;
        event.preventDefault(); if(!configurable)await fetchModuleSettings();if(!configurable)return;bindingModule.set(name); setTyping(true).catch(() => {});
    }
    listen('keyboardKey', async event => {
        if($bindingModule !== name || event.action !== 1 || !configurable) return;
        const bind = configurable.value.find(v => v.valueType === 'BIND') as BindSetting | undefined;
        bindingModule.set(null);
        if(bind) {
            bind.value.boundKey = event.keyCode === 27 || event.keyCode === 8 ? 'key.keyboard.unknown' : event.key;
            bind.value.modifiers = [];
            await updateModuleSettings();
        }
        await setTyping(false);
    });

    async function fetchModuleSettings() {
        try { configurable = await getModuleSettings(name);if(expanded&&moduleNameElement&&['esp','playeresp','nametags'].includes(name.toLowerCase()))previewModule.set({name,anchor:moduleNameElement,settings:configurable}); } catch {}

    }

    async function updateModuleSettings() {
        try { if(configurable){await setModuleSettings(name, configurable);if(get(previewModule)?.name===name)previewModule.set({name,anchor:moduleNameElement,settings:configurable});} } catch {}
    }

    async function toggleModule() {
        try { await setModuleEnabled(name, !enabled); } catch {}
    }

    function setDescription(event:MouseEvent) {
        if (!moduleNameElement) return;

        const ratio=2/$scaleFactor;

        let moduleDescription = description;
        if (aliases.length > 0) {
            moduleDescription += ` (aka ${aliases.map(name => $spaceSeperatedNames ? convertToSpacedString(name) : name).join(", ")})`;
        }

        descriptionStore.set({x:event.clientX*ratio,y:event.clientY*ratio,anchor:'right',description:moduleDescription});
    }

    async function toggleExpanded(e: MouseEvent) {
        e.stopPropagation();

        expanded = !expanded;
        if(expanded && !configurable)await fetchModuleSettings();
        if(['esp','playeresp','nametags'].includes(name.toLowerCase())){if(expanded)previewModule.set({name,anchor:moduleNameElement,settings:configurable});else if(get(previewModule)?.name===name)previewModule.set(null);}
        await setItem(path, expanded.toString());
    }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
        class="module"
        class:expanded


>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div
            class="name"
            use:secondaryClick={toggleExpanded}
            use:ripple
            on:click={toggleModule}
            on:mousedown={bindKey}
            on:mouseenter={setDescription}
            on:mousemove={setDescription}
            on:mouseleave={() => descriptionStore.set(null)}
            bind:this={moduleNameElement}
            class:enabled
            class:highlight={name === $highlightModuleName}
    >
        <span class="module-label">{$bindingModule === name ? "Press a key" : $spaceSeperatedNames ? convertToSpacedString(name) : name}</span>

    </div>

    <Reveal visible={expanded && !!configurable}>
    {#if configurable}
        <div class="settings">
            {#key settingsVersion}
            {#each configurable.value as setting (setting.name)}
                {#if setting.name !== "Bind" && setting.name !== "Hidden"}<GenericSetting {path} bind:setting on:change={updateModuleSettings}/>{/if}
            {/each}
            {/key}
        </div>
    {/if}
    </Reveal>
</div>

<style>
.module{position:relative}.name{overflow:hidden;isolation:isolate;cursor:pointer;color:var(--clickgui-text-dimmed-color);text-align:left;font:400 16.6px 'Google Sans','Opai CJK',sans-serif;position:relative;padding:0 20px;min-height:39.2px;line-height:39.2px;transition:background-color 120ms,color 120ms}.name:hover{background:var(--clickgui-module-hover-background-color);color:var(--text-color)}.name.enabled{color:var(--opai-enabled-text);background:var(--opai-enabled)}.name.highlight{outline:1px solid var(--accent-color);outline-offset:-1px}.module-label{position:relative;z-index:6;pointer-events:none}.settings{padding:0 20px;background:#211b1a;isolation:isolate}
</style>
