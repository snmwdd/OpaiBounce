<script lang="ts">
    import {createEventDispatcher} from 'svelte';
    import VectorIcon from '../../../../../opai/VectorIcon.svelte';
    export let options:string[];
    export let value:string;
    export let title:string;
    let open=false;
    const dispatch=createEventDispatcher<{change:{value:string}}>();
    function choose(option:string){value=option;open=false;dispatch('change',{value});}
</script>
<div class="opai-select"><span class="label">{title}</span><button type="button" class="field" aria-label={title} aria-expanded={open} on:click={()=>open=!open}><span>{value}</span><span class="arrow" class:open><VectorIcon name="back" size={8}/></span></button>{#if open}<div class="options">{#each options as option}<button type="button" class:chosen={option===value} on:click={()=>choose(option)}>{#if option===value}<VectorIcon name="check" size={8}/>{/if}<span>{option}</span></button>{/each}</div>{/if}</div>
<style>.label{display:block;color:#cdb7b4;font:9px 'Google Sans','Opai CJK',sans-serif;line-height:14px;margin-bottom:3px}.field{width:100%;display:flex;justify-content:space-between;align-items:center;height:24px;padding:0 8px;border:0;border-bottom:1px solid #9e8d8b;border-radius:3px 3px 0 0;background:#2e2625;color:#ede0de;font:9px 'Google Sans','Opai CJK',sans-serif;cursor:pointer}.arrow{transform:rotate(-90deg);transition:transform 140ms}.arrow.open{transform:rotate(90deg)}.options{background:#2e2625;border-radius:0 0 4px 4px;padding:3px;max-height:140px;overflow:auto}.options button{display:flex;align-items:center;gap:6px;width:100%;text-align:left;min-height:22px;padding:3px 6px;border:0;border-radius:3px;background:none;color:#ede0de;font:9px 'Google Sans','Opai CJK',sans-serif;cursor:pointer}.options button:hover,.options button.chosen{background:#483a37;color:var(--accent-color)}</style>
