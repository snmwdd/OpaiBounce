<script lang="ts">
    import {createEventDispatcher} from 'svelte';
    import VectorIcon from '../../../../opai/VectorIcon.svelte';
    export let value:boolean;
    export let title:string;
    const dispatch=createEventDispatcher();
</script>
<label class="switch-setting"><span class="label">{title}</span><input aria-label={title} type="checkbox" bind:checked={value} on:change={()=>dispatch('change')}/><span class="track"><span class="knob">{#if value}<VectorIcon name="check" size={6}/>{/if}</span></span></label>
<style>.switch-setting{display:flex;position:relative;align-items:center;justify-content:space-between;min-height:22px;gap:8px;cursor:pointer;font:9px 'Google Sans','Opai CJK',sans-serif;color:#ede0de}.label{flex:1;min-width:0}.switch-setting input{position:absolute;opacity:0;width:26px;height:16px;right:0;cursor:pointer}.track{position:relative;flex:none;width:26px;height:16px;border:1px solid #9e8d8b;border-radius:8px;background:#2e2625;color:var(--accent-color);pointer-events:none;transition:background-color 140ms,border-color 140ms}.knob{position:absolute;left:1px;top:1px;display:grid;place-items:center;width:12px;height:12px;border-radius:6px;background:#cdb7b4;transition:transform 140ms,background-color 140ms}input:checked+.track{background:var(--accent-color);border-color:var(--accent-color)}input:checked+.track .knob{transform:translateX(10px);background:#5f150f}input:focus-visible+.track{outline:1px solid var(--accent-color);outline-offset:2px}</style>
