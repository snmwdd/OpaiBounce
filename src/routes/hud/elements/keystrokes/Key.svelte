<script lang="ts">
    import {listen} from '../../../../integration/ws';
    import type {MinecraftKeybind} from '../../../../integration/types';
    import KeyPulse from '../../../../opai/KeyPulse.svelte';
    export let space=false;
    export let gridArea:string;
    export let key:MinecraftKeybind|undefined;
    let active=false,pulse=0;
    function input(name:string,action:number,screen?:unknown){
        if(name!==key?.key.translationKey)return;
        if(action===0){active=false;return;}
        if(!screen&&(action===1||action===-1)){if(!active)pulse++;active=true;}
    }
    listen('key',e=>input(e.key,e.action));
    listen('keyboardKey',e=>input(e.key,e.action,e.screen));
</script>
<svelte:window on:blur={()=>active=false}/>
<div class="key" class:space class:active style:grid-area={gridArea} data-key={key?.key.translationKey}>
    <KeyPulse {pulse}/>{#if space}<span class="space-line"></span>{:else}<span class="key-label">{key?.key.localized??''}</span>{/if}
</div>
<style>.key{height:50px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;border-radius:8px;background:var(--keystrokes-background-color);color:var(--keystrokes-text-color);font:700 20px 'Google Sans','Opai CJK',sans-serif;text-align:center;box-shadow:var(--opai-hud-shadow)}.key::after{content:"";position:absolute;inset:0;pointer-events:none;background:#ffffff06;opacity:0;transition:opacity 140ms}.key.active::after{opacity:1}.key-label,.space-line{position:relative}.space{height:30px}.space-line{height:2px;width:68%;background:currentColor;border-radius:1px}</style>
