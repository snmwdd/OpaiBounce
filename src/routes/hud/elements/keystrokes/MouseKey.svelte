<script lang="ts">
    import KeyPulse from '../../../../opai/KeyPulse.svelte';
    import {onDestroy} from 'svelte';
    import {fade,fly} from 'svelte/transition';
    import {listen} from '../../../../integration/ws';
    export let button:0|1;
    let active=false,cps=0,clicks:number[]=[],pulse=0;
    let expiry:ReturnType<typeof setTimeout>|undefined;
    function expire(){expiry=undefined;const now=performance.now();while(clicks.length&&now-clicks[0]>=1000)clicks.shift();cps=clicks.length;if(cps)expiry=setTimeout(expire,Math.max(1,clicks[0]+1001-now));}
    function pressed(){
        active=true;const now=performance.now();clicks.push(now);cps=clicks.length;if(!expiry)expiry=setTimeout(expire,1001);
        pulse++;
    }
    listen('mouseButton',e=>{if(e.button!==button)return;if(e.action===0)active=false;else if(e.action===1&&!e.screen)pressed();});
    onDestroy(()=>{clearTimeout(expiry);});
</script>
<svelte:window on:blur={()=>active=false}/>
<div class="mouse-key" class:active data-button={button===0?'LMB':'RMB'} aria-label="{button===0?'Left':'Right'} mouse button {cps} CPS">
    <KeyPulse {pulse}/>
    {#key cps>0}<span class="mouse-label" in:fly={{duration:150,y:5}} out:fade={{duration:100}}>{cps?String(cps):button===0?'LMB':'RMB'}</span>{/key}
</div>
<style>
.mouse-key{position:relative;display:grid;place-items:center;flex:1;height:34px;overflow:hidden;border-radius:8px;background:var(--keystrokes-background-color);color:var(--keystrokes-text-color);font:700 18px 'Google Sans','Opai CJK',sans-serif;box-shadow:var(--opai-hud-shadow)}.mouse-key::after{content:"";position:absolute;inset:0;pointer-events:none;background:#ffffff06;opacity:0;transition:opacity 140ms}.mouse-key.active::after{opacity:1}.mouse-label{position:absolute}</style>
