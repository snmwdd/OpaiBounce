<script lang="ts">
    import ArrayList from "./elements/ArrayList.svelte";
    import TargetHud from "./elements/targethud/TargetHud.svelte";
    import Watermark from "./elements/Watermark.svelte";
    import Notifications from "./elements/notifications/Notifications.svelte";
    import TabGui from "./elements/tabgui/TabGui.svelte";
    import HotBar from "./elements/hotbar/HotBar.svelte";
    import Scoreboard from "./elements/Scoreboard.svelte";
    import {onMount, setContext} from "svelte";
    import {
        getClientInfo,
        getComponents,
        getMetadata,
        getNativeComponents
    } from "../../integration/rest";
    import {listen} from "../../integration/ws";
    import type {HudComponent, Metadata} from "../../integration/types";
    import Taco from "./elements/taco/Taco.svelte";
    import type {ComponentsUpdateEvent, ScaleFactorChangeEvent} from "../../integration/events";
    import Keystrokes from "./elements/keystrokes/Keystrokes.svelte";
    import Effects from "./elements/Effects.svelte";
    import BlockCounter from "./elements/BlockCounter.svelte";
    import Text from "./elements/Text.svelte";
    import DraggableComponent from "./elements/DraggableComponent.svelte";
    import KeyBinds from "./elements/KeyBinds.svelte";
    import ClosedCaptions from "./elements/ClosedCaptions.svelte";
    import {os} from "../clickgui/clickgui_store";
    import {
        HUD_EDITOR_ELEMENTS_CONTEXT,
        type HudEditorDragState
    } from "../clickgui/tabs/hud_editor/constants";
    import Image from "./elements/Image.svelte";

    import InventoryPanel from '../../opai/InventoryPanel.svelte';
    import PlayerInfo from '../../opai/PlayerInfo.svelte';
    import Fps from '../../opai/Fps.svelte';
    import OpaiInventory from '../../opai/Inventory.svelte';
    import OpaiSession from '../../opai/Session.svelte';
    import MusicHud from '../../opai/MusicHud.svelte';
    import {hudGeometry} from '../../opai/hudGeometry';
    export let inEditor = false;

    let saveError = "";
    let metadata: Metadata;
    let nativeComponents: HudComponent[] = [];
    let themeComponents: HudComponent[] = [];

    $: renderedComponents = themeComponents;

    setContext(HUD_EDITOR_ELEMENTS_CONTEXT, new Map<string, HTMLElement>());

    onMount(async () => {
        $os = (await getClientInfo()).os;

        metadata = await getMetadata();
        [nativeComponents, themeComponents] = await Promise.all([
            Promise.resolve([]),
            getComponents(metadata.id)
        ]);
    });

    listen("componentsUpdate", (event: ComponentsUpdateEvent) => {
        if (inEditor && event.source === "native") {
            nativeComponents = event.components;
        }

        if (event.source === "theme" && event.themeId === metadata?.id) {
            themeComponents = event.components;
        }
    });
</script>

<div class="hud">
    {#if $hudGeometry.ready}<div class="hud-plane" style:width="{$hudGeometry.width/$hudGeometry.scale}px" style:height="{$hudGeometry.height/$hudGeometry.scale}px" style:transform="scale({$hudGeometry.scale})">
    {#each renderedComponents as c (c.id)}
        {#if c.settings.enabled}
            <DraggableComponent
                    {inEditor}
                    coordinateScale={$hudGeometry.scale}
                    viewportWidth={$hudGeometry.width}
                    viewportHeight={$hudGeometry.height}
                    on:saveError={e=>saveError=e.detail}
                    componentId={c.id}
                    componentName={c.name}
                    alignment={c.settings.alignment}
                    zIndex={c.settings.zIndex ?? 0}
                    width={c.width}
                    height={c.height}
            >
                <div class:opai-hud-element={['MusicInfo','MusicLyrics','MusicSpectrum','Watermark','ArrayList','TargetHud','Effects','Inventory','SessionInfo','ArmorItems','CraftingInventory','EnderChestInventory','InventoryStatistics','Coordinates','Fps'].includes(c.name)}>
                {#if ["MusicInfo","MusicLyrics","MusicSpectrum"].includes(c.name)}<MusicHud kind={c.name} {inEditor}/>
                {:else if c.name === "Coordinates"}<PlayerInfo/>
                {:else if c.name === "Fps"}<Fps/>
                {:else if c.name === "SessionInfo"}<OpaiSession settings={c.settings}/>
                {:else if c.name === "Watermark"}
                    <Watermark/>
                {:else if c.name === "ArrayList"}
                    <ArrayList settings={c.settings}/>
                {:else if c.name === "TabGui"}
                    <TabGui/>
                {:else if c.name === "Notifications"}
                    <Notifications settings={c.settings}/>
                {:else if c.name === "TargetHud"}
                    <TargetHud {inEditor}/>
                {:else if c.name === "BlockCounter"}
                    <BlockCounter settings={c.settings}/>
                {:else if c.name === "Hotbar"}
                    <HotBar/>
                {:else if c.name === "Scoreboard"}
                    <Scoreboard settings={c.settings}/>
                {:else if c.name === "ArmorItems"}
                    <InventoryPanel mode="equipment" settings={c.settings} {inEditor}/>
                {:else if c.name === "InventoryStatistics"}
                    <InventoryPanel mode="statistics" settings={c.settings} {inEditor}/>
                {:else if c.name === "Inventory"}
                    <OpaiInventory/>
                {:else if c.name === "CraftingInventory"}
                    <InventoryPanel mode="crafting" settings={c.settings} {inEditor}/>
                {:else if c.name === "EnderChestInventory"}
                    <InventoryPanel mode="enderchest" settings={c.settings} {inEditor}/>
                {:else if c.name === "Taco"}
                    <Taco/>
                {:else if c.name === "Keystrokes"}
                    <Keystrokes/>
                {:else if c.name === "Effects"}
                    <Effects {inEditor}/>
                {:else if c.name === "Text"}
                    <Text settings={c.settings}/>
                {:else if c.name === "Image"}
                    <Image componentId={c.id} settings={c.settings}/>
                {:else if c.name === "KeyBinds"}
                    <KeyBinds/>
                {:else if c.name === "ClosedCaptions"}
                    <ClosedCaptions/>
                {:else if c.width !== undefined && c.height !== undefined}
                    <div></div>
                {/if}
                </div>
            </DraggableComponent>
        {/if}
    {/each}
    </div>{/if}
    {#if inEditor&&saveError}<p class="hud-save-error" role="alert">{saveError}</p>{/if}
</div>

<style lang="scss">
  .hud{position:fixed;inset:0}
  .hud-plane{position:absolute;left:0;top:0;transform-origin:top left}
  .hud-save-error{position:fixed;left:12px;bottom:12px;padding:8px 12px;background:#171312ee;border-radius:6px;color:var(--accent-color);font-size:13px;z-index:10001}
  .opai-hud-element { zoom: 2; --opai-hud-shadow:0 0 4px 2px var(--hud-shadow-color); --opai-hud-silhouette-shadow:drop-shadow(0 0 2px var(--hud-shadow-color)); }
  .hud {
    height: 100vh;
    width: 100vw;
  }
</style>
