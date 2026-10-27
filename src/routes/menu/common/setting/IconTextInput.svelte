<script lang="ts">
    // Kept for compatibility with the upstream forms; Opai fields have no leading icon.
    export let icon:string;
    export let title:string;
    export let type='text';
    export let value='';
    export let maxLength:number|null=null;
    export let pattern:string|null=null;
    let focused=false;
</script>
<label class="icon-text-input" data-field-kind={icon} class:floating={focused||value.length>0}>
    <fieldset aria-hidden="true"><legend><span>{title}</span></legend></fieldset>
    <span class="field-label">{title}</span>
    {#if type==='password'}<input aria-label={title} {pattern} maxlength={maxLength} type="password" bind:value on:focus={()=>focused=true} on:blur={()=>focused=false} autocomplete="off"/>{:else}<input aria-label={title} {pattern} maxlength={maxLength} type="text" bind:value on:focus={()=>focused=true} on:blur={()=>focused=false} spellcheck="false" autocomplete="off"/>{/if}
    <span class="button-container"><slot/></span>
</label>
<style>
.icon-text-input{position:relative;display:flex;align-items:center;min-width:0;height:30px;flex-shrink:0;border-radius:3px;color:#c4b7b4;cursor:text}.icon-text-input fieldset{position:absolute;inset:-5px 0 0;min-width:0;margin:0;padding:0 8px;pointer-events:none;border:1px solid #8c8584;border-radius:3px}.icon-text-input legend{height:10px;max-width:0;padding:0;visibility:hidden;white-space:nowrap;font:9px 'Google Sans','Opai CJK',sans-serif;transition:max-width 140ms}.icon-text-input legend span{padding:0 4px}.icon-text-input.floating legend{max-width:100%;padding:0 1px}.field-label{position:absolute;left:10px;top:8px;max-width:calc(100% - 20px);overflow:hidden;white-space:nowrap;pointer-events:none;font:10px 'Google Sans','Opai CJK',sans-serif;line-height:14px;transform-origin:left center;transition:transform 140ms,top 140ms,color 140ms}.floating .field-label{top:-7px;transform:scale(.9)}.icon-text-input:focus-within fieldset{border-color:var(--accent-color)}.icon-text-input:focus-within .field-label{color:var(--accent-color)}input{position:relative;flex:1;width:0;min-width:0;height:100%;padding:0 10px;background:none;border:0;color:#ede0de;font:10px 'Google Sans','Opai CJK',sans-serif;outline:none}input:invalid{color:#ffb4aa}.button-container{display:flex;flex:none;align-items:center;padding-right:5px}
</style>
