<script lang="ts">
 import {createEventDispatcher,onDestroy} from 'svelte';
 import {setComponentAlignment} from '../../../integration/rest';
 import type {Alignment} from '../../../integration/types';
 import {HorizontalAlignment,VerticalAlignment} from '../../../integration/types';
 export let alignment:Alignment;
 export let componentId:string;
 export let componentName:string;
 export let inEditor=false;
 export let coordinateScale=1,viewportWidth=innerWidth,viewportHeight=innerHeight;
 const dispatch=createEventDispatcher();
 let alive=true;onDestroy(()=>alive=false);
 export let width:number|undefined=undefined;
 export let height:number|undefined=undefined;
 export let zIndex=0;
 let element:HTMLDivElement,dragging=false,pointerId=-1,dragScale=1,dragWidth=0,dragHeight=0,saving=false;
 let original:Alignment;
 $: if(dragging&&(dragScale!==coordinateScale||dragWidth!==viewportWidth||dragHeight!==viewportHeight))cancel();
 let fromX=0,fromY=0,pointerX=0,pointerY=0,boxWidth=0,boxHeight=0;
 $: left=alignment.horizontalAlignment===HorizontalAlignment.RIGHT ? undefined : alignment.horizontalAlignment===HorizontalAlignment.LEFT ? `${alignment.horizontalOffset}px` : `calc(50% + ${alignment.horizontalOffset}px)`;
 $: right=alignment.horizontalAlignment===HorizontalAlignment.RIGHT ? `${alignment.horizontalOffset}px` : undefined;
 $: top=alignment.verticalAlignment===VerticalAlignment.BOTTOM ? undefined : alignment.verticalAlignment===VerticalAlignment.TOP ? `${alignment.verticalOffset}px` : `calc(50% + ${alignment.verticalOffset}px)`;
 $: bottom=alignment.verticalAlignment===VerticalAlignment.BOTTOM ? `${alignment.verticalOffset}px` : undefined;
 $: transform=`translate(${alignment.horizontalAlignment===HorizontalAlignment.CENTER_TRANSLATED?'-50%':'0'},${alignment.verticalAlignment===VerticalAlignment.CENTER_TRANSLATED?'-50%':'0'})`;
 function press(e:PointerEvent){if(!inEditor||e.button!==0||saving)return;e.preventDefault();const r=element.getBoundingClientRect();const ratio=1/coordinateScale;original={...alignment};fromX=r.left*ratio;fromY=r.top*ratio;boxWidth=r.width*ratio;boxHeight=r.height*ratio;pointerX=e.clientX;pointerY=e.clientY;dragScale=coordinateScale;dragWidth=viewportWidth;dragHeight=viewportHeight;pointerId=e.pointerId;dragging=true;element.setPointerCapture(pointerId);}
 function move(e:PointerEvent){if(!dragging||e.pointerId!==pointerId)return;const ratio=1/coordinateScale;const x=Math.max(2,Math.min(viewportWidth*ratio-boxWidth-2,fromX+(e.clientX-pointerX)*ratio));const y=Math.max(2,Math.min(viewportHeight*ratio-boxHeight-2,fromY+(e.clientY-pointerY)*ratio));alignment={horizontalAlignment:HorizontalAlignment.LEFT,horizontalOffset:Math.round(x),verticalAlignment:VerticalAlignment.TOP,verticalOffset:Math.round(y)};}
 function uncapture(){dragging=false;if(element.hasPointerCapture(pointerId))element.releasePointerCapture(pointerId);}
 function cancel(){if(!dragging)return;uncapture();alignment=original;}
 async function release(){if(!dragging)return;uncapture();saving=true;try{await setComponentAlignment(componentId,{...alignment});}catch{if(alive){alignment=original;dispatch('saveError','HUD position could not be saved. Original position restored.');}}finally{saving=false;}}
</script>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="draggable-element" class:editor-mode={inEditor} class:dragging data-component={componentName} style:left style:right style:top style:bottom style:transform style:z-index={dragging?10000:zIndex} bind:this={element} on:pointerdown={press} on:pointermove={move} on:pointerup={release} on:pointercancel={cancel}>
 <div class="contained-element" style:width={width===undefined?undefined:`${width}px`} style:height={height===undefined?undefined:`${height}px`}><slot/></div>
</div>
<style>.draggable-element{position:absolute}.editor-mode{cursor:grab;touch-action:none}.editor-mode.dragging{cursor:grabbing}.contained-element{min-width:0;min-height:0}</style>
