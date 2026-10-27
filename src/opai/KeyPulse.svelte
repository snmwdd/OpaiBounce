<script lang="ts">
    import {prefersReducedMotion} from './motionPlatform';
    import {playMotion,type MotionHandle} from './animation';
    export let pulse=0;
    // One reusable compositor layer per key; no DOM allocation, timeout or RAF per click.
    function wave(node:HTMLElement,initial:number){
        let previous=initial,animation:MotionHandle|undefined;
        return {update(value:number){if(value===previous)return;previous=value;if(prefersReducedMotion())return;
            animation?.cancel();node.style.willChange='transform, opacity';
            const current=playMotion(node,[{transform:'translate(-50%,-50%) scale(.02)',opacity:.045},{transform:'translate(-50%,-50%) scale(1.4)',opacity:0}],450,'ease-out');animation=current;
            void current.finished.then(()=>{if(animation===current){animation=undefined;node.style.willChange='';}},()=>{});
        },destroy(){animation?.cancel();}};
    }
</script>
<span class="key-wave" use:wave={pulse} aria-hidden="true"></span>
<style>.key-wave{position:absolute;pointer-events:none;left:50%;top:50%;width:120%;aspect-ratio:1;border-radius:50%;background:#fff;opacity:0;transform:translate(-50%,-50%) scale(.02)}</style>
