<script lang="ts">
    import {onMount} from 'svelte';
    import VectorIcon from './VectorIcon.svelte';
    let message = '';
    function failure(event: Event) { message = (event as CustomEvent<string>).detail; }
    onMount(() => { window.addEventListener('opai-api-error',failure); return () => window.removeEventListener('opai-api-error',failure); });
</script>
{#if message}<div class="api-error" role="alert"><span>{message}</span><button aria-label="Dismiss error" on:click={() => message = ''}><VectorIcon name="close"/></button></div>{/if}
<style>.api-error{position:fixed;bottom:70px;left:50%;transform:translateX(-50%);max-width:600px;padding:12px 16px;z-index:2000000;display:flex;gap:16px;background:#191113ef;border:1px solid #85645d;border-radius:10px;color:#ffb4aa;font:14px 'Google Sans','Opai CJK',sans-serif}.api-error button{font-size:18px;background:none;border:0;color:inherit;cursor:pointer}</style>
