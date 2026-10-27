<script lang="ts">
    import {prefersReducedMotion} from './motionPlatform';
    import {onMount} from 'svelte';
    import {getGameWindow} from '../integration/rest';
    let visible=!sessionStorage.getItem('opai.intro'),finishing=false,joined=false;
    let width=innerWidth/2,height=innerHeight/2,scale=2;
    $: size=width/6.4;
    onMount(()=>{
        if(!visible)return;
        let alive=true;const timers:ReturnType<typeof setTimeout>[]=[],started=performance.now();
        function later(run:()=>void,delay:number){timers.push(setTimeout(()=>{if(alive)run();},delay));}
        function resize(){width=innerWidth/scale;height=innerHeight/scale;}
        function complete(){visible=false;sessionStorage.setItem('opai.intro','1');}
        resize();window.addEventListener('resize',resize);
        void getGameWindow().then(w=>{if(alive){scale=w.scaleFactor;resize();}}).catch(()=>{});
        const assets=['opai/image/background.png','opai/image/logo.svg',...[2,3,4].map(id=>`opai/image/logo/part${id}.svg`)];
        void Promise.all([document.fonts.ready,...assets.map(src=>{const img=new Image();img.src=src;return img.decode().catch(()=>{});})]).then(()=>{
            if(!alive)return;
            if(prefersReducedMotion()){complete();return;}
            later(()=>{finishing=true;later(()=>joined=true,650);later(complete,1200);},Math.max(0,900-(performance.now()-started)));
        });
        return()=>{alive=false;timers.forEach(clearTimeout);window.removeEventListener('resize',resize);};
    });
</script>
{#if visible}
<div class="intro" class:finishing class:joined aria-label="Loading Opai theme">
    <div class="stage" style:zoom={scale} style:width="{width}px" style:height="{height}px" style:--size="{size}px" style:--logo-scale={48/size}>
        <svg class="spinner" viewBox="0 0 200 200" aria-hidden="true"><g class="spin"><path d="M100 20A80 80 0 1 1 99.99 20" pathLength="360"/></g></svg>
        <div class="logo-assembly">{#if joined}<span class="whole" style:mask-image="url('opai/image/logo.svg')"></span>{:else}<span class="core"></span>{#each [2,3,4] as id,i}<span class="part" style:--dx={[-1,1,0][i]} style:--dy={[-1,-1,1][i]} style:--delay="{i*45}ms" style:mask-image="url('opai/image/logo/part{id}.svg')"></span>{/each}{/if}</div>
        <div class="loading-bar"><span></span></div><div class="cover"></div>
    </div>
</div>
{/if}
<style>
.intro{position:fixed;inset:0;z-index:1000000;background:#191113}.stage{position:relative;overflow:hidden}.spinner,.logo-assembly{position:absolute;width:var(--size);height:var(--size);left:calc(50% - var(--size)/2);top:calc(50% - var(--size)/2)}.spinner{overflow:visible;transition:opacity 220ms,transform 500ms cubic-bezier(.2,.8,.2,1)}.spin{transform-origin:100px 100px;animation:spin 1400ms linear infinite}.spin path{fill:none;stroke:var(--accent-color);stroke-width:8;stroke-dasharray:20 340;animation:arc 1400ms cubic-bezier(.4,0,.2,1) infinite}.part,.whole{position:absolute;inset:0;background:var(--accent-color);mask-size:contain;mask-repeat:no-repeat;mask-position:center}.part{opacity:0;transform:translate(calc(var(--dx)*30px),calc(var(--dy)*30px)) scale(.6)}.core{position:absolute;left:36.5%;top:36.5%;width:27%;height:27%;border-radius:50%;background:var(--accent-color);opacity:0;transform:scale(.3)}.finishing .core{animation:assemble 450ms cubic-bezier(.2,.8,.2,1) both}.finishing .spinner{opacity:0;transform:scale(.25)}.finishing .part{animation:assemble 550ms cubic-bezier(.2,.8,.2,1) var(--delay) both}.joined .logo-assembly{animation:depart 550ms cubic-bezier(.2,.8,.2,1) both}.joined{animation:fade 550ms ease-out both}.cover{position:absolute;inset:0;background:#000;transform-origin:bottom;animation:uncover 500ms cubic-bezier(.2,.8,.2,1) both;pointer-events:none}.loading-bar{position:absolute;left:0;right:0;top:0;height:calc(100% / 70);background:#3c3235;overflow:hidden;transition:opacity 250ms}.loading-bar span{position:absolute;inset:0;width:35%;background:var(--accent-color);animation:progress 1300ms linear infinite}.finishing .loading-bar{opacity:0}@keyframes spin{to{transform:rotate(360deg)}}@keyframes arc{0%,100%{stroke-dasharray:20 340;stroke-dashoffset:0}50%{stroke-dasharray:280 80;stroke-dashoffset:-90}100%{stroke-dashoffset:-360}}@keyframes assemble{to{opacity:1;transform:translate(0,0) scale(1)}}@keyframes depart{to{transform:translateY(-96px) scale(var(--logo-scale))}}@keyframes fade{to{opacity:0}}@keyframes uncover{to{transform:scaleY(0)}}@keyframes progress{from{transform:translateX(-100%)}to{transform:translateX(386%)}}
</style>
