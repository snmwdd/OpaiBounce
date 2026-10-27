<script lang="ts">
    import {prefersReducedMotion} from './motionPlatform';
    import {onMount,createEventDispatcher,tick} from 'svelte';
    import {scaleFactor} from '../routes/clickgui/clickgui_store';
    import {playMotion,type MotionHandle} from './animation';
    import {islandKeyframes} from './motion';
    import {markPalette,cancelPalette,type PaletteSession} from './paletteIntent';
    import CommandPalette from './CommandPalette.svelte';
    export let session:PaletteSession;
    const dispatch=createEventDispatcher();
    let box:HTMLDivElement,ink:HTMLDivElement,content:HTMLDivElement,commands:CommandPalette;
    let viewportWidth=innerWidth,viewportHeight=innerHeight,layoutWidth=session.anchor.width,layoutHeight=session.anchor.height;
    let active=false,ready=false,closing=false;
    let measure=()=>{},close=()=>{};
    $: ratio=$scaleFactor/2;
    $: ratio,viewportWidth,viewportHeight,measure();
    onMount(()=>{
        let alive=true,initialized=false,sequence=0,running:MotionHandle[]=[],completed=false;
        let target={x:session.anchor.x,y:session.anchor.y,width:layoutWidth,height:layoutHeight};
        let fallback:ReturnType<typeof setTimeout>;
        function finish(){if(completed||!alive)return;completed=true;clearTimeout(fallback);active=false;void cancelPalette(session.id).catch(()=>{});dispatch('close');}
        box.style.transform=`translate3d(${target.x}px,${target.y}px,0)`;
        async function animate(next:typeof target,resizeLayout=true){
            const id=++sequence,rect=box.getBoundingClientRect();
            running.forEach(a=>a.cancel());running=[];
            target=next;if(resizeLayout){layoutWidth=next.width;layoutHeight=next.height;}
            await tick();if(!alive||id!==sequence)return;
            const frames=islandKeyframes(rect,next,{width:layoutWidth,height:layoutHeight},closing?480:560);
            box.style.transform=String(frames.box.at(-1)!.transform);ink.style.transform=String(frames.ink.at(-1)!.transform);
            if(prefersReducedMotion()){active=false;if(closing)finish();return;}
            active=true;
            const outer=playMotion(box,frames.box,frames.duration);
            const inner=playMotion(ink,frames.ink,frames.duration);running=[outer,inner];
            try{await outer.finished;if(alive&&id===sequence){running=[];active=false;if(closing)finish();}}catch{}
        }
        function resize(rect:DOMRectReadOnly){
            if(closing||!alive||rect.width<1||rect.height<1)return;
            const width=Math.min(viewportWidth-16,rect.width),height=Math.min(viewportHeight-16,rect.height);
            const center=Math.max(width/2+8,Math.min(viewportWidth-width/2-8,session.anchor.x+session.anchor.width/2));
            const next={width,height,x:center-width/2,y:Math.max(8,Math.min(viewportHeight-height-8,session.anchor.y))};
            if(initialized&&Object.keys(next).every(key=>Math.abs(next[key as keyof typeof next]-target[key as keyof typeof target])<.5))return;
            void animate(next);
            if(!initialized){initialized=true;ready=true;void markPalette(session.id,'ready').catch(()=>{});commands?.focusSearch();}
        }
        const observer=new ResizeObserver(entries=>resize(entries[0].contentRect));observer.observe(content);
        measure=()=>{if(content)resize(content.getBoundingClientRect());};
        close=()=>{if(closing)return;closing=true;ready=false;void markPalette(session.id,'closing').catch(()=>{});
            fallback=setTimeout(finish,prefersReducedMotion()?0:650);void animate(session.anchor,false);};
        function visibility(){if(!document.hidden&&!closing)commands?.focusSearch();}
        document.addEventListener('visibilitychange',visibility);
        return()=>{alive=false;sequence++;measure=()=>{};close=()=>{};observer.disconnect();running.forEach(a=>a.cancel());document.removeEventListener('visibilitychange',visibility);clearTimeout(fallback);void cancelPalette(session.id).catch(()=>{});};
    });
    function show(){dispatch('show-requested');close();}
</script>
<svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight}/>
<div class="palette-island" bind:this={box} class:ready data-motion-active={active} style:--source-radius="{session.anchor.height/2}px" data-origin="dynamic-island" data-closing={closing} style:width="{layoutWidth}px" style:height="{layoutHeight}px">
    <div class="palette-ink" bind:this={ink} class:ready>
        <div class="palette-content" bind:this={content}><div style:zoom={ratio}><CommandPalette bind:this={commands} maxWidth={Math.max(240,viewportWidth/ratio-24)} maxHeight={Math.max(160,viewportHeight/ratio-24)} on:close={()=>close()} on:show={show}/></div></div>
    </div>
</div>
<style>.palette-island{position:fixed;left:0;top:0;z-index:100000;transform-origin:top left;overflow:hidden;background:#080808b0;box-shadow:var(--opai-hud-shadow);border-radius:var(--source-radius);transition:border-radius 180ms;pointer-events:auto}.palette-island.ready:not([data-closing=true]){border-radius:12px}.palette-island[data-motion-active=true],.palette-island[data-motion-active=true] .palette-ink{will-change:transform}.palette-ink{position:absolute;inset:0;transform-origin:top left;opacity:0;transition:opacity 150ms}.palette-ink.ready{opacity:1}.palette-content{width:max-content;display:flow-root}</style>
