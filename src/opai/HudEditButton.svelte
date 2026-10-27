<script lang="ts">
    import {prefersReducedMotion,softwareMotion} from './motionPlatform';
 import {playMotion,type MotionHandle} from './animation';
 import {createEventDispatcher,onMount} from 'svelte';
 import {hudGeometry} from './hudGeometry';
 import {listen} from '../integration/ws';
 
 import VectorIcon from './VectorIcon.svelte';
 const dispatch=createEventDispatcher();
 export let editing=false;
 let element:HTMLButtonElement;
 $: scale=$hudGeometry.gameScale*$hudGeometry.density;
 let running:MotionHandle|undefined;
 function rise(){if(element&&!editing&&!prefersReducedMotion()){running?.cancel();running=playMotion(element,[{transform:`translateY(${element.offsetHeight+20}px)`,opacity:0},{transform:'translateY(0px)',opacity:1}],380,'ease-out');}}
 function entrance(node:HTMLButtonElement){element=node;rise();return{destroy(){running?.cancel();}};}
 onMount(()=>{const offPlatform=softwareMotion.subscribe(software=>{if(software)rise();});window.addEventListener('opai-clickgui-open',rise);return()=>{offPlatform();window.removeEventListener('opai-clickgui-open',rise);};});


</script>
{#if !editing}<button use:entrance class="hud-edit-button" style:--scale={scale} aria-label="HUD Editor" title="HUD Editor" on:click={()=>dispatch('edit')}><VectorIcon name="pencil" size={21*scale}/></button>{/if}
<style>.hud-edit-button{position:fixed;right:calc(8px * var(--scale));bottom:calc(8px * var(--scale));width:calc(26.7px * var(--scale));height:calc(26.7px * var(--scale));border:0;border-radius:calc(5px * var(--scale));background:var(--accent-color);color:#101014;display:grid;place-items:center;cursor:pointer;z-index:10000}@keyframes rise{from{opacity:0;transform:translateY(calc(100% + 20px))}to{opacity:1;transform:none}}</style>
