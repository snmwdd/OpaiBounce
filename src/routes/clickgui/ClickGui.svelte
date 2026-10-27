<script lang="ts">
    import {prefersReducedMotion,softwareMotion} from '../../opai/motionPlatform';
    import type {GroupedModules, Module} from "../../integration/types";
    import Panel from "./Panel.svelte";
    import Description from "./Description.svelte";
    import {onMount,tick} from "svelte";
    import {listen} from "../../integration/ws";
    import {getModules} from "../../integration/rest";
    import {opaiCategories} from "../../opai/categories";
    import {gridSize, showGrid} from "./clickgui_store";
    import ScaledClickGuiContent from "./ScaledClickGuiContent.svelte";

    import {playMotion,type MotionHandle} from '../../opai/animation';
    import {openingKeyframes} from "../../opai/motion";
    import EntityPreview from '../../opai/EntityPreview.svelte';
    import Configurations from "../../opai/Configurations.svelte";
    let element:HTMLDivElement;
    let animating=$state(false);
    let categories = $state<GroupedModules>({});
    let modules = $state<Module[]>([]);

    let restart=()=>{};
    onMount(() => {
        let alive=true,ready=false,running:MotionHandle|undefined;
        function stop(){running?.cancel();running=undefined;animating=false;element.style.willChange='';}
        restart=()=>{
            stop();
            if(!ready||prefersReducedMotion())return;
            animating=true;element.style.willChange='transform, opacity';
            const animation=playMotion(element,openingKeyframes(),320);running=animation;
            void animation.finished.then(()=>{if(running===animation){running=undefined;animating=false;element.style.willChange='';}},()=>{});
        };
        // A customized CEF UA can reveal Windows only after /client/info returns.
        const offPlatform=softwareMotion.subscribe(software=>{if(software)restart();});
        window.addEventListener('opai-clickgui-open',restart);
        getModules().then(async items=>{if(alive){modules=items;categories=opaiCategories(items);await tick();if(alive){ready=true;restart();}}}).catch(()=>{});
        return()=>{alive=false;offPlatform();stop();window.removeEventListener('opai-clickgui-open',restart);restart=()=>{};};
    });

</script>

<ScaledClickGuiContent>
    <div
            class="clickgui" bind:this={element} data-motion-active={animating}
            class:grid={$showGrid}
            style="background-size: {$gridSize}px {$gridSize}px;"
            style:transform="scale(1)" style:opacity={1}
    >

        {#each Object.entries(categories) as [category, modules], panelIndex (category)}
            <Panel {category} {modules} {panelIndex}/>
        {/each}
    </div>
    <Description/>
    <EntityPreview/>
    <Configurations/>
</ScaledClickGuiContent>

<style lang="scss">
  .clickgui {
    position: absolute;
    inset: 0;
    overflow: auto;
    scrollbar-width: thin;

    &.grid {
      background-image: linear-gradient(to right, var(--clickgui-grid-color) 1px, transparent 1px),
      linear-gradient(to bottom, var(--clickgui-grid-color) 1px, transparent 1px);
    }
  }
</style>
