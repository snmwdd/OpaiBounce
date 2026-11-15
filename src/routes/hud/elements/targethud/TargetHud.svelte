<script lang="ts">
    import {onDestroy} from 'svelte';
    import {getPlayerData, itemTextureUrl} from '../../../../integration/rest';
    import {REST_BASE} from '../../../../integration/host';
    import type {PlayerData} from '../../../../integration/types';
    import {listen} from '../../../../integration/ws';
    import PixelText from '../../../../opai/PixelText.svelte';
    import Head from '../../../../opai/Head.svelte';
    import {opaiPreferences} from '../../../../opai/preferences';
    import {bridgeState, type CombatTarget} from '../../../../opai/scriptBridge';

    export let inEditor = false;
    let preview: PlayerData | null = null;
    let target: PlayerData | null = null;
    let visibleTarget: PlayerData | null;
    let live: CombatTarget | null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let flashLayer: HTMLSpanElement;
    let previousHit = 0;
    let previousLayer: HTMLSpanElement | undefined;
    let previewPending = false;
    let destroyed = false;

    $: if (inEditor && !preview && !previewPending) loadPreview();
    $: if (!inEditor && !preview) previewPending = false;
    $: visibleTarget = target ?? (inEditor ? preview : null);
    $: {
        const sample = $bridgeState?.combatTarget;
        live = $bridgeState?.inWorld && !!target && sample?.uuid === target.uuid ? sample : null;
    }
    $: health = live?.health ?? visibleTarget?.actualHealth ?? 0;
    $: healthRatio = Math.max(0, Math.min(1, health / Math.max(1, visibleTarget?.maxHealth ?? 1)));
    $: armor = visibleTarget?.armorItems?.slice().reverse() ?? [];
    $: idk = $opaiPreferences.targetHudStyle === 'idk';
    $: percentage = `${(healthRatio * 100).toFixed(1)}%`;
    $: legacy = $opaiPreferences.targetHudStyle === 'old';
    $: flashOnHit(live?.lastHitAt ?? 0, flashLayer);

    async function loadPreview() {
        previewPending = true;
        try {
            const data = await getPlayerData();
            if (!destroyed) preview = data;
        } catch {
            // A later editor session can try again.
        }
    }

    function flashOnHit(hit: number, layer: HTMLSpanElement | undefined) {
        if (layer !== previousLayer) {
            previousLayer = layer;
            previousHit = 0;
        }
        if (!layer || hit <= previousHit) return;
        previousHit = hit;
        const age = Date.now() - hit;
        if (age < 0 || age > 500) return;
        layer.getAnimations().forEach(animation => animation.cancel());
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            && document.documentElement.dataset.opaiMotion !== 'full';
        layer.animate([{opacity: .58}, {opacity: 0}], {duration: reduced ? 110 : 340, easing: 'ease-out'});
    }

    listen('targetChange', event => {
        target = event.target;
        clearTimeout(timer);
        if (target) timer = setTimeout(() => target = null, 1000);
    });
    listen('disconnect', () => {
        clearTimeout(timer);
        target = preview = null;
        previewPending = false;
    });
    onDestroy(() => {
        destroyed = true;
        clearTimeout(timer);
    });
</script>

{#if visibleTarget}
    <div class="targethud" class:legacy class:idk data-style={$opaiPreferences.targetHudStyle}>
        {#key visibleTarget.uuid}
            <div class="portrait">
                <Head src="{REST_BASE}/api/v1/client/resource/skin?uuid={visibleTarget.uuid}" size={idk ? 34 : 26}/>
                <span class="hit-tint" bind:this={flashLayer}></span>
            </div>
        {/key}
        <div class="name">{#if idk}<PixelText text={visibleTarget.username}/>{:else}{visibleTarget.username} <span>{Math.ceil(health)}</span>{/if}</div>
        {#if legacy}
            <div class="details" aria-label="Target status">
                <div><abbr title="On ground">G</abbr>: {live?.grounded ?? '—'} | <abbr title="Line of sight">CV</abbr>: {live?.visible ?? '—'}</div>
                <div><abbr title="Ticks existed">TE</abbr>: {live?.age ?? '—'} | <abbr title="Remaining hurt ticks">HURT</abbr>: {live?.hurtTime ?? '—'}</div>
            </div>
        {:else if !idk && armor.length}
            <div class="equipment" aria-label="Target armor">
                {#each armor as item}
                    {#if item?.identifier && item.identifier !== 'minecraft:air' && item.count > 0}
                        <img src={itemTextureUrl(item.identifier)} alt={item.identifier.replace(/^minecraft:/, '').replaceAll('_', ' ')}/>
                    {/if}
                {/each}
            </div>
        {/if}
        <div class="track" role="progressbar" aria-label="Target health" aria-valuenow={Number((healthRatio * 100).toFixed(1))} aria-valuemin={0} aria-valuemax={100}><div style:transform="scaleX({healthRatio})"></div>{#if idk}<span class="percentage"><PixelText text={percentage}/></span>{/if}</div>
    </div>
{/if}

<style>
    .targethud {
        width: 122px;
        height: 40px;
        position: relative;
        padding: 4px;
        border-radius: 6px;
        background: var(--opai-hud-panel, #080808b0);
        box-shadow: var(--opai-hud-shadow);
        backdrop-filter: var(--opai-hud-backdrop, var(--opai-backdrop-blur));
        color: white;
        font: 8px 'Google Sans', 'Opai CJK', sans-serif;
    }
    .targethud.legacy { width: 130px; border-radius: 4px; }
    .targethud.idk { width: 136px; height: 40px; padding: 3px; border-radius: 0; border: 1px solid #ffffff24; background: var(--opai-hud-panel, #16191ec9); }
    .idk .portrait { width: 34px; height: 34px; }
    .idk .portrait :global(.head), .idk .hit-tint { border-radius: 0; }
    .idk .name { top: 5px; left: 40px; right: 5px; height: 10px; }
    .idk .name :global(.pixel-text) { max-width: 100%; }
    .idk .track { left: 40px; right: 5px; top: 21px; bottom: auto; height: 10px; border-radius: 0; background: #30333e; }
    .idk .track > div { border-radius: 0; background: #c4c3ff; }
    .percentage { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: white; filter: drop-shadow(1px 1px 0 #30303c); }
    .portrait { position: relative; width: 26px; height: 26px; }
    .hit-tint { position: absolute; inset: 0; border-radius: 5px; background: #ff4545; opacity: 0; pointer-events: none; }
    .name { position: absolute; top: 5px; left: 33px; right: 4px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .name span { color: var(--accent-color); }
    .equipment, .details { position: absolute; top: 16px; left: 33px; right: 4px; white-space: nowrap; overflow: hidden; }
    .equipment { display: flex; align-items: center; gap: 2px; }
    .equipment img { display: block; width: 13px; height: 13px; image-rendering: pixelated; }
    .details { color: var(--opai-hud-muted); font-size: 7px; line-height: 7.4px; }
    abbr { text-decoration: none; }
    .track { position: absolute; left: 4px; right: 4px; bottom: 4px; height: 4px; background: var(--opai-hud-track, #0008); border-radius: 4px; overflow: hidden; }
    .track > div { height: 100%; border-radius: 4px; background: var(--accent-color); transform-origin: left; transition: transform 350ms ease; }
</style>
