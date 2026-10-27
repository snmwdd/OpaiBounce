<script lang="ts">
    import {installClickGuiLifecycle} from '../../opai/clickGuiLifecycle';
    import {musicOpen} from '../../opai/music';
    import {clickGuiVisible} from '../../opai/clickGuiLifecycle';
    import {setEditorMode} from '../../opai/hudEditorMode';
    import {hudGeometry} from '../../opai/hudGeometry';
    import {tuneFrameRate} from "../../opai/highRefresh";
    import PaletteIsland from '../../opai/PaletteIsland.svelte';
    import ScaledClickGuiContent from './ScaledClickGuiContent.svelte';
    import {consumePalette,type PaletteSession} from '../../opai/paletteIntent';
    import {deleteScreen} from '../../integration/rest';
    import {isStatic,isPreview} from '../../integration/host';
    import {push} from '../../integration/router';
    import ClickGui from "./ClickGui.svelte";
    import GlobalSettings from "./tabs/GlobalSettings.svelte";
    import HudEditButton from "../../opai/HudEditButton.svelte";
    import {gridSize, os, scaleFactor, snappingEnabled, darken} from "./clickgui_store";
    import type {ConfigurableSetting, TogglableSetting} from "../../integration/types";
    import {onMount,onDestroy} from "svelte";
    import {
        getClientInfo,
        getGameWindow,
        getModuleSettings,
        setTyping
    } from "../../integration/rest";
    import {listen} from "../../integration/ws";
    import type {ClickGuiValueChangeEvent, ScaleFactorChangeEvent} from "../../integration/events";
    import HudEditor from "./tabs/hud_editor/HudEditor.svelte";
    import {isTextEntry} from "../../util/utils";
    import {persistentDataLoaded, setItem} from "../../integration/persistent_storage";

    const TAB_KEY = "opai.clickgui.tab";

    const tabs = [
        {title: "ClickGUI", content: ClickGui},
        {title: "HUD Editor", content: HudEditor},
        {title: "Settings", content: GlobalSettings},
    ];

    let activeTab = $state(0);
    let palette = $state(false);
    let paletteRequest=$state<PaletteSession|null>(null);
    let showAfterClose=false;
    async function checkPalette(){if(isStatic&&!isPreview)return;try{const request=await consumePalette();if(request){paletteRequest=request;palette=true;void setTyping(true).catch(()=>{});}}catch{}}
    async function closePalette(){palette=false;await setTyping(false);if(showAfterClose){activeTab=0;showAfterClose=false;return;}if(isPreview)await push('/hud?static&preview');else await deleteScreen();}
    function showModule(){palette=false;activeTab=0;void setTyping(false);}
    listen('virtualScreen',event=>{
        if(event.action==='open'&&((event as any).screenName==='clickgui'||event.type==='clickgui'||event.type==='CLICK_GUI'))checkPalette();
        else if(event.action==='close'){palette=false;void setTyping(false).catch(()=>{});}
    });
    let tabRestored = false;
    const minecraftScaleFactor = $derived($hudGeometry.gameScale);
    $effect(()=>{void setEditorMode(activeTab===1&&!palette&&$clickGuiVisible).catch(()=>{});});
    let clickGuiScaleFactor = $state(1);

    $effect(() => {
        $scaleFactor = minecraftScaleFactor * clickGuiScaleFactor;
    });

    $effect(() => {
        const title = tabs[activeTab].title;
        if (tabRestored) {
            setItem(TAB_KEY, title);
        }
    });

    function escapeEditor(event:KeyboardEvent){if(event.key==='Escape' && activeTab!==0){event.preventDefault();event.stopPropagation();activeTab=0;}}
    async function restoreTab() {
        await persistentDataLoaded;
        const stored = tabs.findIndex(tab => tab.title === localStorage.getItem(TAB_KEY));
        if (stored >= 0) {
            activeTab = stored;
        }
        tabRestored = true;
    }

    /**
     * The client has to know whether the user is typing, otherwise key presses
     * that are meant for a text field are also handled as game input - see
     * `ModuleClickGui.isInSearchBar`.
     *
     * Focus events bubble, so tracking them here covers every text field of the
     * ClickGUI, including the ones rendered by the HUD editor.
     */
    async function handleFocusIn(event: FocusEvent) {
        await setTyping(palette||$musicOpen||isTextEntry(event.target));
    }

    async function handleFocusOut(event: FocusEvent) {
        // `relatedTarget` is the element that receives the focus, so moving
        // from one text field to another does not report a pause in typing.
        await setTyping(palette||$musicOpen||isTextEntry(event.relatedTarget));
    }

    function applyValues(configurable: ConfigurableSetting) {
        const scaleValue = configurable.value.find(v => v.name === "Scale");
        const snappingValue = configurable.value.find(v => v.name === "Snapping") as TogglableSetting | undefined;

        if (scaleValue) {
            clickGuiScaleFactor = scaleValue.value as number;
        }

        if (snappingValue) {
            $snappingEnabled = snappingValue.value.find(v => v.name === "Enabled")?.value as boolean ?? true;
            $gridSize = snappingValue.value.find(v => v.name === "GridSize")?.value as number ?? 10;
        }
    }

    onMount(installClickGuiLifecycle);
    onMount(async () => {
        checkPalette();
        restoreTab();

        $os = (await getClientInfo()).os;

        const clickGuiSettings = await getModuleSettings("ClickGUI");
        applyValues(clickGuiSettings);
        void tuneFrameRate('ClickGUI',clickGuiSettings).catch(()=>{});

        await setTyping(palette||$musicOpen);
    });

    onDestroy(()=>{void setEditorMode(false).catch(()=>{});if(palette)void setTyping(false).catch(()=>{});});
    listen("keyboardKey",e=>{if(e.keyCode===27 && e.action===1 && activeTab!==0)activeTab=0;});

    listen("clickGuiValueChange", (e: ClickGuiValueChangeEvent) => {
        applyValues(e.configurable);
    });
</script>

<svelte:window onfocusin={handleFocusIn} onfocusout={handleFocusOut} onkeydown={escapeEditor}/>

<div
        class="tabbed-clickgui"
        class:darken={$darken}
        style:--opai-click-scale={$scaleFactor}
>
    {#if palette&&paletteRequest}<PaletteIsland session={paletteRequest} on:close={closePalette} on:show-requested={()=>showAfterClose=true}/>{:else if activeTab===1}<HudEditor/>{:else if activeTab===2}<GlobalSettings/>{:else}<ClickGui/>{/if}
    {#if !palette}<HudEditButton editing={activeTab===1} on:edit={()=>activeTab=1}/>{/if}
</div>

<style lang="scss">
  .tabbed-clickgui {
    overflow: hidden;
    position: absolute;
    inset: 0;
    transition: ease background-color .2s;

    &.darken {
      background-color: var(--clickgui-overlay-background-color);
    }
  }
</style>
