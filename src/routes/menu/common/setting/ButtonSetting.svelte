<script lang="ts">
    import {createEventDispatcher,getContext} from 'svelte';
    import CircleLoader from '../CircleLoader.svelte';
    import {ripple} from '../../../../opai/motion';
    export let title:string;
    export let disabled=false;
    export let secondary=false;
    export let inset=false;
    export let listenForEnter=false;
    export let loading=false;
    const dispatch=createEventDispatcher();
    const closeDialog=getContext<(()=>void)|undefined>('opai-dialog-close');
    $: footer=!!closeDialog&&!secondary;
    function click(){if(!disabled&&!loading)dispatch('click');}
    function keyboard(e:KeyboardEvent){if(listenForEnter&&e.key==='Enter'&&!e.defaultPrevented&&!(e.target instanceof HTMLButtonElement)){e.preventDefault();click();}}
</script>
<svelte:window on:keydown={keyboard}/>
{#if footer}
    <div class="dialog-actions"><button type="button" class="cancel" on:click={closeDialog} disabled={loading} use:ripple>Cancel</button><button class="confirm" type="button" on:click={click} disabled={disabled||loading} use:ripple>{#if loading}<CircleLoader/>{/if}{listenForEnter?'Confirm':title}</button></div>
{:else}
    <button class="button-setting" class:inset class:secondary type="button" on:click={click} disabled={disabled||loading} use:ripple>{#if loading}<CircleLoader/>{/if}{title}</button>
{/if}
<style>
button{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:6px;min-height:24px;padding:5px 10px;border:0;border-radius:6px;color:var(--accent-color);font:9px 'Google Sans','Opai CJK',sans-serif;cursor:pointer;transition:background-color 140ms}.button-setting{background:#483a37}.button-setting:hover:not(:disabled){background:#61463f}.secondary{background:#2e2625;color:#cdb7b4}.inset{margin:0}button:disabled{opacity:.4;cursor:default}.dialog-actions{position:sticky;bottom:0;z-index:1;background:#171312;display:flex;flex:none;align-items:center;justify-content:flex-end;gap:12px;margin-top:10px;order:10}.dialog-actions button{background:none;min-width:50px}.dialog-actions button:hover:not(:disabled){background:#483a3760}
</style>
