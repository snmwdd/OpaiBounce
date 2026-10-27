<script lang="ts">
    import {secondaryClick} from "../../opai/secondaryClick";
    import {onMount,onDestroy,tick} from "svelte";
    import type {Module as TModule} from "../../integration/types";
    import {listen} from "../../integration/ws";
    import {drag} from "../../opai/drag";
    import Reveal from "../../opai/Reveal.svelte";
    import Module from "./Module.svelte";
    import type {KeyboardKeyEvent, ModuleToggleEvent} from "../../integration/events";
    import {
        gridSize,
        highlightModuleName,
        maxPanelZIndex,
        scaleFactor,
        showGrid,
        snappingEnabled
    } from "./clickgui_store";
    import {persistentDataLoaded,setItem} from "../../integration/persistent_storage";

    export let category: string;
    export let modules: TModule[];
    export let panelIndex: number;

    let panelElement: HTMLElement;
    let modulesElement: HTMLElement;

    let moving = false;

    let scrollPositionSaveTimeout: ReturnType<typeof setTimeout> | undefined;

    let panelConfig = loadPanelConfig(), interacted = false;

    let ignoreGrid = false;

    interface PanelConfig {
        top: number;
        left: number;
        expanded: boolean;
        scrollTop: number;
        zIndex: number;
    }

    function clamp(number: number, min: number, max: number) {
        return Math.max(min, Math.min(number, Math.max(min,max)));
    }

    function loadPanelConfig(): PanelConfig {
        const defaults={
            top:Math.max(16,document.documentElement.clientHeight*(2/$scaleFactor)*.112),
            left:Math.min(60,document.documentElement.clientWidth*(2/$scaleFactor)*.0382)+panelIndex*320,
            expanded:true,scrollTop:0,zIndex:0
        };
        try {
            const saved=JSON.parse(localStorage.getItem(`opai.panel.${category}`)??'null');
            if(!saved || typeof saved.expanded!=='boolean')return defaults;
            for(const key of ['top','left','scrollTop','zIndex'])if(!Number.isFinite(saved[key]))return defaults;
            $maxPanelZIndex=Math.max($maxPanelZIndex,saved.zIndex);
            return {top:Math.max(0,saved.top),left:Math.max(0,saved.left),expanded:saved.expanded,scrollTop:Math.max(0,saved.scrollTop),zIndex:saved.zIndex};
        } catch { return defaults; }
    }

    async function savePanelConfig() {
        await setItem(
            `opai.panel.${category}`,
            JSON.stringify(panelConfig),
        );
    }

    function fixPosition() {
        panelConfig.left = clamp(panelConfig.left, 0, document.documentElement.clientWidth * (2 / $scaleFactor) - panelElement.offsetWidth);
        panelConfig.top = clamp(panelConfig.top, 0, document.documentElement.clientHeight * (2 / $scaleFactor) - 100);
    }

    const dragging={
        scale:()=>$scaleFactor/2,
        get:()=>({x:panelConfig.left,y:panelConfig.top}),
        start:()=>{moving=true;interacted=true;panelConfig.zIndex=++$maxPanelZIndex;},
        move:(x:number,y:number)=>{panelConfig={...panelConfig,left:snapToGrid(x),top:snapToGrid(y)};fixPosition();},
        end:()=>{moving=false;void savePanelConfig();}
    };

    function toggleExpanded() {
        interacted = true;panelConfig.expanded = !panelConfig.expanded;

        savePanelConfig();
        if(panelConfig.expanded)void tick().then(()=>modulesElement?.scrollTo({top:panelConfig.scrollTop,behavior:'instant'}));
    }

    function handleModulesScroll() {
        panelConfig.scrollTop = modulesElement.scrollTop;

        if (scrollPositionSaveTimeout !== undefined) {
            clearTimeout(scrollPositionSaveTimeout);
        }
        scrollPositionSaveTimeout = setTimeout(() => {
            savePanelConfig();
        }, 500)
    }

    const unsubscribeHighlight = highlightModuleName.subscribe((name) => {
        const highlightModule = modules.find(
            (m) => m.name === name,
        );
        if (highlightModule) {
            panelConfig.zIndex = ++$maxPanelZIndex;
            panelConfig.expanded = true;
            savePanelConfig();
        }
    });

    listen("moduleToggle", (e: ModuleToggleEvent) => {
        const moduleName = e.moduleName;
        const moduleEnabled = e.enabled;

        const mod = modules.find((m) => m.name === moduleName);
        if (!mod) return;

        mod.enabled = moduleEnabled;
        modules = modules;
    });

    onDestroy(() => { unsubscribeHighlight(); if(scrollPositionSaveTimeout !== undefined) clearTimeout(scrollPositionSaveTimeout); });

    onMount(() => {
        let alive=true;
        persistentDataLoaded.then(()=>{
            if(!alive || interacted)return;
            panelConfig=loadPanelConfig();
            modulesElement?.scrollTo({top:panelConfig.scrollTop,behavior:'instant'});
        });
        return()=>{alive=false;};
    });

    listen("keyboardKey", (e: KeyboardKeyEvent) => {
        if (e.key === "key.keyboard.left.shift") {
            ignoreGrid = e.action === 1;
        }
    });

    function snapToGrid(value: number): number {
        if (ignoreGrid || !$snappingEnabled) return value;

        return Math.round(value / $gridSize) * $gridSize;
    }
</script>



<div
        class="panel"
        style="left: {panelConfig.left}px; top: {panelConfig.top}px; z-index: {panelConfig.zIndex};--panel-top:{panelConfig.top}px"
        bind:this={panelElement}
>
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
            class="title"
            use:drag={dragging}
            use:secondaryClick={toggleExpanded}
    >
        <span class="category">{category}</span>

    </div>

    <Reveal visible={panelConfig.expanded}>
    <div
            class="modules"
            class:expanded={panelConfig.expanded}
            on:scroll={handleModulesScroll}
            bind:this={modulesElement}
    >
        {#each modules as {name, enabled, description, aliases} (name)}
            <Module {name} {enabled} {description} {aliases}/>
        {/each}
    </div>
    </Reveal>
</div>

<style lang="scss">

  .panel {
    border-radius: 14px;
    width: 304px;
    position: absolute;
    overflow: hidden;


    contain: layout style;
    transition: none;
    user-select: none;
  }

  .title {
    display: grid;
    grid-template-columns: 1fr;
    align-items: center;
    column-gap: 0;
    background-color: var(--clickgui-panel-header-background-color);
    height: 42px;
    padding: 0 20px;
    cursor: grab;touch-action:none;

    .category {
      font-size: 18.4px;
      color: var(--clickgui-text-color);
      font-weight: 400;
    }
  }

  .modules {

    scroll-behavior: smooth;
    overflow-anchor: none;
    max-height: max(40px,min(641px, calc(100vh * 2 / var(--opai-click-scale, 2) - var(--panel-top) - 56px)));
    overflow-y: auto;
    overflow-x: hidden;
    background-color: var(--clickgui-panel-body-background-color);padding-bottom:14px;

    &.expanded {
      max-height: max(40px,min(641px, calc(100vh * 2 / var(--opai-click-scale, 2) - var(--panel-top) - 56px)));

    }

    &::-webkit-scrollbar {
      width: 2px;
      height: 2px;
    }

    &::-webkit-scrollbar-thumb {
      border-radius: 2px;
    }
  }



</style>
