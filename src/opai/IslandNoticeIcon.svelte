<script lang="ts">
    import {prefersReducedMotion} from './motionPlatform';
    import {requestMotionFrame,cancelMotionFrame} from './animation';
    import {onMount,onDestroy} from 'svelte';
    import {Tween} from './motion';
    // DynamicIslandPainter.drawIcon / DynamicIslandState.Transition, in original logical units.
    export let kind:'toggle'|'success'|'warning'|'info'='toggle';
    export let enabled=true;
    let value=0,frame=0,mounted=false;
    const tween=new Tween(200);
    const mix=(a:number[],b:number[],t:number)=>`rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')})`;
    function target(){
        if(!mounted)return;
        const now=performance.now();cancelMotionFrame(frame);tween.tick(now);
        tween.easing=enabled?t=>t>=1?1:1-Math.pow(2,-10*t):t=>t;
        tween.to(enabled?1:0,now);
        if(prefersReducedMotion()){tween.reset(enabled?1:0,now);value=tween.current;return;}
        function draw(at:number){value=tween.tick(at);if(!tween.done)frame=requestMotionFrame(draw);}
        frame=requestMotionFrame(draw);
    }
    $: enabled,target();
    onMount(()=>{mounted=true;target();});
    onDestroy(()=>cancelMotionFrame(frame));
</script>
<svg class="notice-icon" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" data-kind={kind} data-toggle={value}>
    <g class="notice-glyph" transform="translate(18 18) scale(1.12) translate(-18 -18)">
    {#if kind==='toggle'}
        <rect x="5" y="10" width="26" height="16" rx="8" fill="color-mix(in srgb,#9e8d8b,var(--accent-color) {value*100}%)"/>
        <rect x="6" y="11" width="24" height="14" rx="7" fill="color-mix(in srgb,#36343b,var(--accent-color) {value*100}%)"/>
        <rect class="toggle-knob" class:moving={value>0&&value<1} x="8.5" y="13.5" width="8" height="8" rx="4" style:transform="translate({8.5*value}px,{-1.25*value}px) scale({1+3.5/8*value})" style:transform-origin="8.5px 13.5px" fill={mix([133,132,136],[24,19,22],value)}/>
    {:else}
        <rect x="7" y="8" width="24" height="24" rx="7" fill={kind==='success'?'#5f8f50c8':kind==='warning'?'#8f5050c8':'#307593c8'}/>
        {#if kind==='success'}<path d="M13 20L18 25L26 14" fill="none" stroke="#fff" stroke-width="2"/>
        {:else if kind==='warning'}<path d="M19 13V22" stroke="#fff" stroke-width="2"/><rect x="18" y="25" width="2" height="2" rx="1" fill="#fff"/>
        {:else}<path d="M19 16V26" stroke="#fff" stroke-width="2"/><rect x="18" y="12" width="2" height="2" rx="1" fill="#fff"/>{/if}
    {/if}
    </g>
</svg>
<style>.notice-icon{display:block;flex:none;width:36px;height:36px;overflow:visible}.toggle-knob.moving{will-change:transform}</style>
