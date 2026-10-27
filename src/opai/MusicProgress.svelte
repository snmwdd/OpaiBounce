<script lang="ts">
 import {musicPosition,musicTime} from './music';
 export let duration=0,seekable=false;
 export let onSeek:(position:number)=>Promise<unknown>=async()=>{};
 let draft:number|null=null,epoch=0;
 async function seek(value:number){const ticket=++epoch;draft=value;try{await onSeek(value);}finally{if(ticket===epoch)draft=null;}}
</script>
{#if seekable}
<div class="progress player-progress"><small>{musicTime($musicPosition)}</small><input type="range" aria-label="播放进度" min="0" max={Math.max(1,duration)} value={draft??(duration?$musicPosition:0)} disabled={!duration} on:pointerdown={e=>draft=Number(e.currentTarget.value)} on:pointercancel={()=>draft=null} on:input={e=>draft=Number(e.currentTarget.value)} on:change={e=>seek(Number(e.currentTarget.value))}/><small>{duration?musicTime(duration):'—:—'}</small></div>
{:else}
<div class="progress hud-progress"><span style:transform="scaleX({duration?Math.min(1,$musicPosition/duration):0})"></span></div><div class="times"><span>{musicTime($musicPosition)}</span><span>{duration?musicTime(duration):'—:—'}</span></div>
{/if}
<style>
.player-progress{display:flex;align-items:center;gap:8px;color:#888}.player-progress input{flex:1;min-width:0;height:12px;accent-color:#ddd;cursor:pointer}.player-progress small{font-size:10px;min-width:32px;text-align:center}
.hud-progress{height:3.5px;border-radius:2px;background:#ffffff55;overflow:hidden;margin:1px 0 3px}.hud-progress span{display:block;width:100%;height:100%;background:#e4e4e4;transform-origin:left center;transition:transform 90ms linear}.times{display:flex;justify-content:space-between;font-size:7.5px;color:#aaa}
</style>
