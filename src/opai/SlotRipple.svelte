<script lang="ts">
 import {onDestroy} from 'svelte';
 import {playMotion,type MotionHandle} from './animation';
 export let token='';export let x=.5,y=.5;
 let node:HTMLSpanElement,last='',animation:MotionHandle|undefined;
 $: if(node&&token&&token!==last){last=token;animation?.cancel();animation=playMotion(node,[{transform:'translate(-50%,-50%) scale(0)',opacity:.34,borderRadius:'50%'},{offset:.32,transform:'translate(-50%,-50%) scale(1)',opacity:.25,borderRadius:'4px'},{transform:'translate(-50%,-50%) scale(1)',opacity:0,borderRadius:'4px'}],380,'ease-out');}
 onDestroy(()=>animation?.cancel());
</script>
<span class="slot-ripple" bind:this={node} style:left="{Math.max(0,Math.min(1,x))*100}%" style:top="{Math.max(0,Math.min(1,y))*100}%"></span>
<style>.slot-ripple{position:absolute;pointer-events:none;width:40px;height:40px;opacity:0;background:#dcdcdc;border-radius:50%;transform:translate(-50%,-50%) scale(0)}</style>
