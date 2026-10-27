<script lang="ts">
    import {onMount} from 'svelte';
    import {listen} from '../integration/ws';
    import {getPlayerData,getClientInfo} from '../integration/rest';
    import type {PlayerData} from '../integration/types';
    import {bridgeState} from './scriptBridge';
    let player:PlayerData|null=null,eventSeen=false;
    onMount(()=>{let alive=true;getClientInfo().then(info=>info.inGame?getPlayerData():null).then(data=>{if(alive&&!eventSeen)player=data;}).catch(()=>{});return()=>{alive=false;};});
    listen('clientPlayerData',e=>{eventSeen=true;player=e.playerData;});listen('disconnect',()=>player=null);
    const coordinate=(value:number|undefined)=>Number.isFinite(value)?value!.toFixed(1):'—';
    $: facing=Number.isFinite(player?.yaw)?['SOUTH','WEST','NORTH','EAST'][Math.floor((((player!.yaw%360)+360)%360+45)/90)%4]:'—';
    $: biome=$bridgeState?.worldInfo?.biome??null;
    $: biomeName=biome?biome.split(':').at(-1)!.split('_').map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' '):'—';
    $: biomeColor=biome&&/desert|badlands|savanna/.test(biome)?'#c99963':biome&&/snow|ice|frozen/.test(biome)?'#9cc9e0':biome&&/nether|crimson|basalt/.test(biome)?'#db8b77':'#80ad55';
</script>
<div class="player-info" aria-label="Coordinates and world information">
    <div>X: {coordinate(player?.position?.x)}</div><div>Y: {coordinate(player?.position?.y)}</div><div>Z: {coordinate(player?.position?.z)}</div>
    <div>Biome: <span style:color={biomeColor}>{biomeName}</span></div><div>Facing: {facing}</div>
</div>
<style>.player-info{width:max-content;min-width:120px;border-radius:7px;padding:5px 7px;background:var(--opai-hud-surface,#0009);font:9px/14px 'Google Sans','Opai CJK',sans-serif;color:var(--opai-hud-text,#ede0de);font-variant-numeric:tabular-nums;white-space:nowrap}</style>
