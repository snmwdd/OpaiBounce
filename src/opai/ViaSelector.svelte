<script lang="ts">
    import {createEventDispatcher,onMount} from 'svelte';
    import {fade,fly} from 'svelte/transition';
    import {portal} from '../integration/util';
    import {getGameWindow,setSelectedProtocol} from '../integration/rest';
    import {listen} from '../integration/ws';
    import type {Protocol} from '../integration/types';
    import {protocolArt} from './protocolArt';
    import {ripple} from './motion';
    export let protocols:Protocol[];
    export let selected:Protocol|undefined;
    const dispatch=createEventDispatcher();
    let dialog:HTMLDivElement;
    let appearing=true;
    let draft=selected,page=0,direction=1,busy=false,error='',gameScale=2;
    let viewportWidth=innerWidth,viewportHeight=innerHeight;
    $: pages=Math.max(1,Math.ceil(protocols.length/16));
    $: cards=protocols.slice(page*16,page*16+16);
    $: scale=Math.max(.4,Math.min(gameScale,(viewportWidth-24)/420,(viewportHeight-24)/340));
    onMount(()=>{dialog.focus();const index=protocols.findIndex(p=>p.version===selected?.version);page=index<0?0:Math.floor(index/16);getGameWindow().then(w=>gameScale=w.scaleFactor).catch(()=>{});});
    listen('scaleFactorChange',e=>gameScale=e.scaleFactor);
    function turn(delta:number){const next=Math.max(0,Math.min(pages-1,page+delta));if(next===page)return;direction=delta;page=next;}
    function keyboard(e:KeyboardEvent){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!busy)dispatch('close');}if(e.key==='ArrowLeft')turn(-1);if(e.key==='ArrowRight')turn(1);}
    async function confirm(){if(!draft||busy)return;busy=true;error='';try{await setSelectedProtocol(draft);selected=draft;dispatch('close');}catch(e){error=e instanceof Error?e.message:String(e);}finally{busy=false;}}
</script>
<svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight}/>
<div class="via-overlay" transition:fade={{duration:140}} use:portal>
    <div class="via-selector" data-motion-active={appearing} on:introend={()=>appearing=false} bind:this={dialog} role="dialog" aria-modal="true" aria-label="Protocol Selector" tabindex="-1" style:zoom={scale} on:keydown={keyboard} in:fly={{duration:220,y:10}} out:fade={{duration:120}}>
        <h2>Protocol Selector</h2>
        <div class="card-viewport">
            {#key page}<div class="version-grid" data-page={page} in:fly={{x:direction*20,duration:180,delay:70}} out:fly={{x:-direction*20,duration:140}}>
                {#each cards as protocol (protocol.version)}{@const art=protocolArt(protocol.name)}<button type="button" class="version-card" class:chosen={draft?.version===protocol.version} aria-pressed={draft?.version===protocol.version} aria-label={protocol.name} title={protocol.name} on:click={()=>draft=protocol} use:ripple>{#if art}<img src={art} alt="" draggable="false"/>{/if}<span style:font-size="{protocol.name.length>12?10:protocol.name.length>8?12:18}px">{protocol.name}</span></button>{/each}
            </div>{/key}
        </div>
        {#if error}<p class="error" role="alert">{error}</p>{/if}
        <footer><div class="pagination"><button type="button" aria-label="Previous page" disabled={page===0||busy} on:click={()=>turn(-1)} use:ripple>&lt;</button><span class="page-count" aria-live="polite">{page+1} / {pages}</span><button type="button" aria-label="Next page" disabled={page===pages-1||busy} on:click={()=>turn(1)} use:ripple>&gt;</button></div><button class="confirm" type="button" disabled={!draft||busy} on:click={confirm} use:ripple>Confirm</button></footer>
    </div>
</div>
<style>
.via-overlay{position:fixed;inset:0;display:grid;place-items:center;background:#0006;z-index:100001;color:#fff;font-family:'Google Sans','Opai CJK',sans-serif}.via-selector{position:relative;width:420px;height:340px;border-radius:15px;background:#171312;overflow:hidden}h2{position:absolute;left:12px;top:10px;font-size:13px;font-weight:700;line-height:20px}.card-viewport{position:absolute;left:10px;top:40px;width:400px;height:218px;overflow:hidden}.version-grid{position:absolute;inset:0;display:grid;grid-template-columns:repeat(4,88px);grid-auto-rows:44px;column-gap:16px;row-gap:14px;align-content:start}.version-card{position:relative;overflow:hidden;width:88px;height:44px;border:0;border-radius:8px;background:#2e2625;display:grid;place-items:center;cursor:pointer;color:#fff;font-family:inherit;font-weight:700;isolation:isolate}.version-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}.version-card:after{content:'';position:absolute;inset:0;background:#0005;z-index:0;pointer-events:none}.version-card:hover:after{background:#0002}.version-card>span{position:relative;z-index:1;max-width:84px;text-align:center;line-height:1.15;overflow-wrap:anywhere;text-shadow:0 1px 3px #0008}.version-card.chosen{color:#00ff00}.version-card:focus-visible{outline-offset:-2px}footer{position:absolute;left:12px;right:12px;bottom:12px;display:flex;align-items:center;justify-content:space-between;height:28px}.pagination{display:flex;align-items:center;gap:6px}.pagination button,.confirm{position:relative;overflow:hidden;display:grid;place-items:center;min-width:26px;height:26px;border:0;border-radius:6px;background:none;color:var(--accent-color);font:16px 'Google Sans','Opai CJK',sans-serif;cursor:pointer}.pagination button:hover,.confirm:hover{background:#ffffff0c}.pagination button:disabled{opacity:.25;cursor:default}.page-count{font-size:8px;color:#b9b9b9;min-width:27px;text-align:center}.confirm{font-size:10px;padding:0 8px}.confirm:disabled{opacity:.4;cursor:default}.error{position:absolute;bottom:48px;left:12px;right:12px;font-size:8px;color:#ffb4aa}
</style>
