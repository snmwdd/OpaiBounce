<script lang="ts">
    import {prefersReducedMotion} from './motionPlatform';
    import {requestMotionFrame,cancelMotionFrame} from './animation';
    import {onMount,tick} from 'svelte';
    import {Approach} from './motion';
    export let visible=false;
    let content:HTMLDivElement,height=0,active=false,rendered=visible;
    let refresh=()=>{};
    const motion=new Approach(visible?1:0,40);
    $: visible,refresh();
    onMount(()=>{
        let frame=0,natural=content.scrollHeight,alive=true;
        let fallback:ReturnType<typeof setTimeout>;
        function draw(now:number){
            frame=0;
            const destination=visible?1:0;
            const value=prefersReducedMotion()?destination:motion.value(destination,now);
            height=natural*value;active=value!==destination;
            if(!visible&&!active)rendered=false;
            if(active)frame=requestMotionFrame(draw);else clearTimeout(fallback);
        }
        // ResizeObserver supplies the measured box; never force a new layout in its callback.
        const observer=new ResizeObserver(entries=>{natural=entries[0].contentRect.height;});observer.observe(content);
        refresh=()=>{
            clearTimeout(fallback);
            active=motion.current!==(visible?1:0);height=natural*motion.current;
            if(visible)rendered=true;
            void tick().then(()=>{if(!alive)return;natural=content.scrollHeight;if(!frame&&(active||!visible))frame=requestMotionFrame(draw);
                if(active)fallback=setTimeout(()=>{
                    cancelMotionFrame(frame);frame=0;motion.current=motion.target=visible?1:0;motion.sampled=performance.now();
                    height=natural*motion.current;active=false;if(!visible)rendered=false;
                },300);});
        };
        refresh();
        return()=>{alive=false;refresh=()=>{};observer.disconnect();cancelMotionFrame(frame);clearTimeout(fallback);};
    });
</script>
<div class="reveal" class:visible data-motion-active={active} style:height={visible&&!active?'auto':`${height}px`} inert={!visible}><div class="section" bind:this={content}>{#if rendered}<slot/>{/if}</div></div>
<style>.reveal{overflow:clip;min-width:0}.section{display:flow-root;min-width:0}</style>
