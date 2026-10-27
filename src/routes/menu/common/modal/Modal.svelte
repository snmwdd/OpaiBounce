<script lang="ts">
    import {fade,fly} from 'svelte/transition';
    import {createEventDispatcher,onMount,setContext} from 'svelte';
    import {portal} from '../../../../integration/util';
    import {getGameWindow} from '../../../../integration/rest';
    import {listen} from '../../../../integration/ws';
    export let title:string;
    export let visible:boolean;
    const dispatch=createEventDispatcher();
    setContext('opai-dialog-close',close);
    let appearing=true;
    let gameScale=2,viewportWidth=innerWidth,viewportHeight=innerHeight;
    $: scale=Math.max(.5,Math.min(gameScale,(viewportWidth-24)/250));
    onMount(()=>{getGameWindow().then(w=>gameScale=w.scaleFactor).catch(()=>{});});
    listen('scaleFactorChange',e=>gameScale=e.scaleFactor);
    function close(){appearing=true;dispatch('close');visible=false;}
    function focusDialog(node:HTMLElement){
        const before=document.activeElement as HTMLElement;
        queueMicrotask(()=>node.querySelector<HTMLElement>('input,select,textarea,button')?.focus());
        function keyboard(event:KeyboardEvent){
            if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
            if(event.key==='Tab'){
                const items=Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(el=>el.getClientRects().length);
                const next=event.shiftKey?items.at(-1):items[0];
                if((event.shiftKey&&document.activeElement===items[0])||(!event.shiftKey&&document.activeElement===items.at(-1))){event.preventDefault();next?.focus();}
            }
        }
        node.addEventListener('keydown',keyboard);
        return{destroy(){node.removeEventListener('keydown',keyboard);before?.focus();}};
    }
</script>
<svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight}/>
{#if visible}
    <div class="modal-wrapper" transition:fade={{duration:140}} use:portal>
        <div class="modal opai-dialog" data-motion-active={appearing} on:introstart={()=>appearing=true} on:introend={()=>appearing=false} role="dialog" aria-modal="true" aria-label={title} tabindex="-1" style:zoom={scale} style:--dialog-max-height="{(viewportHeight-24)/scale}px" in:fly={{duration:180,y:8}} out:fade={{duration:120}} use:focusDialog>
            <h2>{title}</h2>
            <div class="content"><slot/></div>
        </div>
    </div>
{/if}
<style>
.modal-wrapper{position:fixed;inset:0;display:grid;place-items:center;background:#0009;z-index:100000;font:9px 'Google Sans','Opai CJK',sans-serif;color:#ede0de}.modal{display:flex;flex-direction:column;width:250px;max-height:var(--dialog-max-height);overflow:auto;padding:10px;border:1px solid #483a3750;border-radius:12px;background:#171312;box-shadow:0 8px 30px #0006}.modal h2{flex:none;font:700 14px 'Google Sans','Opai CJK',sans-serif;line-height:20px;margin:0 0 12px;color:#f7eeec}.content{display:flex;flex-direction:column;gap:10px;min-width:0;min-height:0;overflow:auto;padding-top:6px}.content :global(>*){flex-shrink:0}.content :global(.dialog-actions){order:10}
</style>
