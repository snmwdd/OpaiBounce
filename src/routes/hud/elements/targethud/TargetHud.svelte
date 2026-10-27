<script lang="ts">
 import Head from '../../../../opai/Head.svelte';
 import {getPlayerData} from '../../../../integration/rest';
 import {onMount,onDestroy} from 'svelte';
 import {listen} from '../../../../integration/ws';
 import type {PlayerData} from '../../../../integration/types';
 import {REST_BASE} from '../../../../integration/host';
 export let inEditor=false;
 let preview:PlayerData|null=null;
 let target: PlayerData | null = null;
 onMount(()=>{if(inEditor)getPlayerData().then(p=>{preview=p;target=p;}).catch(()=>{});});
 let timer: ReturnType<typeof setTimeout>;
 listen('targetChange',e => { target = e.target ?? (inEditor?preview:null); clearTimeout(timer); if(target && !inEditor) timer = setTimeout(() => target = null,1000); });
 onDestroy(() => clearTimeout(timer));
</script>
{#if target}<div class="targethud"><Head src="{REST_BASE}/api/v1/client/resource/skin?uuid={target.uuid}" size={26}/><div class="name">{target.username} <span>{Math.ceil(target.actualHealth)}</span></div><div class="track"><div style:width="{Math.max(0,Math.min(100,target.actualHealth / Math.max(1,target.maxHealth) * 100))}%"></div></div></div>{/if}
<style>.targethud{width:122px;height:40px;position:relative;background:#080808b0;border-radius:6px;box-shadow:var(--opai-hud-shadow);backdrop-filter:blur(2px);padding:4px;font:8px 'Google Sans','Opai CJK',sans-serif;color:#fff}.name{position:absolute;top:5px;left:33px;right:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.name span{color:var(--accent-color)}.track{position:absolute;left:4px;right:4px;bottom:4px;height:4px;background:#0008;border-radius:4px;overflow:hidden}.track>div{height:100%;border-radius:4px;background:var(--accent-color);transition:width 500ms ease}</style>
