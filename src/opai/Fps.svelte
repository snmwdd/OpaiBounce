<script lang="ts">
    import {onMount} from 'svelte';
    import {getClientInfo,itemTextureUrl} from '../integration/rest';
    import {listen} from '../integration/ws';
    let fps:number|null=null,eventSeen=false;
    onMount(()=>{let alive=true;getClientInfo().then(info=>{if(alive&&!eventSeen)fps=info.fps;}).catch(()=>{});return()=>{alive=false;};});
    listen('fps',e=>{eventSeen=true;fps=e.fps;});
</script>
<div class="fps-card" aria-label="FPS counter"><span class="fps-icon"><img src={itemTextureUrl('minecraft:compass')} alt=""/></span><span class="fps-value">FPS: {fps??'—'}</span></div>
<style>.fps-card{display:flex;gap:1px;color:var(--opai-hud-text,#ede0de);font:9px/22px 'Google Sans','Opai CJK',sans-serif;white-space:nowrap;font-variant-numeric:tabular-nums}.fps-icon,.fps-value{display:block;height:22px;border-radius:7px;background:var(--opai-hud-surface,#0009)}.fps-icon{width:22px;display:grid;place-items:center}.fps-icon img{width:16px;height:16px;image-rendering:pixelated}.fps-value{min-width:58px;padding:0 10px;text-align:center}</style>
