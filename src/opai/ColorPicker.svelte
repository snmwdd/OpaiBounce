<script lang="ts">
    import {createEventDispatcher} from 'svelte';
    import {intToRgba,rgbaToInt} from '../integration/util';
    import {rgbToHsv,hsvToRgb} from './color';
    export let value:number;
    export let label:string;
    const dispatch=createEventDispatcher();
    let hue=0,saturation=0,brightness=1,alpha=255,last:number|undefined;
    let surface:HTMLDivElement,dragging=false,rect:DOMRect;
    $: if(value!==last){const [r,g,b,a]=intToRgba(value),hsv=rgbToHsv(r,g,b);if(hsv.s>0)hue=hsv.h;saturation=hsv.s;brightness=hsv.v;alpha=a;last=value;}
    $: rgb=hsvToRgb(hue,saturation,brightness);
    function update(){last=rgbaToInt([...hsvToRgb(hue,saturation,brightness),alpha]);value=last;dispatch('input');}
    function commit(){dispatch('change');}
    function move(event:PointerEvent){if(!dragging)return;saturation=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));brightness=1-Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));update();}
    function press(event:PointerEvent){if(event.button!==0)return;event.preventDefault();surface.focus({preventScroll:true});rect=surface.getBoundingClientRect();dragging=true;surface.setPointerCapture(event.pointerId);move(event);}
    function release(event:PointerEvent){if(!dragging)return;if(event.type!=='pointercancel')move(event);dragging=false;if(surface.hasPointerCapture(event.pointerId))surface.releasePointerCapture(event.pointerId);commit();}
    function keys(event:KeyboardEvent){const step=event.shiftKey?0.1:0.01;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();
        if(event.key==='ArrowLeft')saturation=Math.max(0,saturation-step);if(event.key==='ArrowRight')saturation=Math.min(1,saturation+step);if(event.key==='ArrowUp')brightness=Math.min(1,brightness+step);if(event.key==='ArrowDown')brightness=Math.max(0,brightness-step);if(event.key==='Home')saturation=0;if(event.key==='End')saturation=1;update();commit();}
</script>
<div class="color-picker" data-color={value} aria-label="{label} color picker">
    <div class="color-plane">
        <div class="sv" bind:this={surface} role="slider" tabindex="0" aria-label="{label} saturation and brightness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(saturation*100)} aria-valuetext="Saturation {Math.round(saturation*100)}%, brightness {Math.round(brightness*100)}%" style:background-color="hsl({hue} 100% 50%)" on:pointerdown={press} on:pointermove={move} on:pointerup={release} on:pointercancel={release} on:keydown={keys}>
            <span class="color-point" style:left="{saturation*100}%" style:top="{(1-brightness)*100}%"></span>
        </div>
        <input class="hue" aria-label="{label} hue" type="range" min="0" max="360" step="1" value={hue} on:input={e=>{hue=Number(e.currentTarget.value);update();}} on:change={commit}/>
    </div>
    <div class="alpha-track"><span style:background="linear-gradient(to right,rgba({rgb.join(',')},0),rgb({rgb.join(',')}))"></span><input class="alpha" aria-label="{label} opacity" type="range" min="0" max="255" step="1" value={alpha} on:input={e=>{alpha=Number(e.currentTarget.value);update();}} on:change={commit}/></div>
</div>
<style>.color-picker{width:100%;padding:3px 0 8px}.color-plane{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 16px;gap:5px;align-items:stretch}.sv{position:relative;aspect-ratio:2.08;background-image:linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent);touch-action:none;cursor:crosshair}.color-point{position:absolute;pointer-events:none;width:7px;height:7px;border:1.5px solid #fff;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 1px #0008}.hue,.alpha{appearance:none;border:0;border-radius:0;padding:0;margin:0;cursor:crosshair;min-width:0}.hue{position:absolute;right:0;top:0;writing-mode:vertical-lr;direction:ltr;width:16px;height:100%;background:linear-gradient(to bottom,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)}.hue::-webkit-slider-thumb{appearance:none;width:20px;height:2px;border:0;border-radius:0;background:#fff;box-shadow:0 0 1px #0008}.alpha-track{height:12px;position:relative;margin-top:8px;background:repeating-conic-gradient(#ddd 0 25%,#929292 0 50%) 0/8px 8px}.alpha-track>span{position:absolute;inset:0;pointer-events:none}.alpha{position:absolute;inset:0;width:100%;height:12px;background:transparent}.alpha::-webkit-slider-thumb{appearance:none;width:2px;height:16px;border:0;border-radius:0;background:#fff;box-shadow:0 0 1px #0008}</style>
