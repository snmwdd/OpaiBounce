<script lang="ts">
 import {onMount} from 'svelte';
 import type {ContainerActivity} from './islandActivity';
 import {sendContainerView,clickContainer} from './islandActivity';
 import ItemStackView from '../routes/hud/elements/inventory/ItemStackView.svelte';
 import SlotRipple from './SlotRipple.svelte';
 export let container:ContainerActivity|null=null;
 let grid:HTMLDivElement,busy=false,alive=false;
 $: session=container?.session??'';
 $: feedback=new Map(container?.feedback.map(f=>[f.slot,f])??[]);
 async function publish(){if(!alive||busy||!container?.open||!container.interactive||!grid)return;const r=grid.getBoundingClientRect();if(r.width<=0)return;busy=true;try{await sendContainerView(container,{x:r.x,y:r.y,width:r.width,height:r.height});}catch{}finally{busy=false;}}
 $: session,container?.interactive,void publish();
 onMount(()=>{alive=true;void publish();const observer=new ResizeObserver(()=>void publish());observer.observe(grid);const timer=setInterval(()=>void publish(),500);window.addEventListener('resize',publish);return()=>{alive=false;observer.disconnect();clearInterval(timer);window.removeEventListener('resize',publish);};});
</script>
<div class="chest-grid" bind:this={grid} role="group" aria-label="Chest items">
 {#each container?.stacks??[] as stack,i (session+':'+i)}
  {@const f=feedback.get(i)}
  <button class="chest-slot" aria-label="Take {stack.identifier} slot {i+1}" disabled={!container?.interactive||stack.count===0} on:click={()=>container&&void clickContainer(container,i).catch(()=>{})}>
   {#if stack.count>0}<div class="stack"><ItemStackView {stack}/></div>{/if}
   <SlotRipple token={f?.id??''} x={f?.x??.5} y={f?.y??.5}/>
  </button>
 {/each}
</div>
<style>.chest-grid{display:grid;grid-template-columns:repeat(9,20px);grid-auto-rows:20px;width:180px}.chest-slot{position:relative;display:grid;place-items:center;width:20px;height:20px;border:0;padding:0;margin:0;background:none;border-radius:3px;overflow:hidden;cursor:pointer;isolation:isolate}.chest-slot:disabled{cursor:default;opacity:1}.chest-slot:focus-visible{outline:1px solid var(--accent-color);outline-offset:-1px}.stack{zoom:.5;pointer-events:none}</style>
