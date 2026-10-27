<script lang="ts">
 import {createEventDispatcher} from 'svelte';
 export let title:string;
 export let icon:string;
 const dispatch=createEventDispatcher();
</script>
<button type="button" class="icon-button" aria-label={title} title={title} on:click={()=>dispatch('click')}><img src="img/menu/icon-{icon}.svg" alt=""/></button>
<style>.icon-button{display:grid;place-items:center;flex:none;width:24px;height:22px;border:0;border-radius:4px;background:none;cursor:pointer}.icon-button:hover{background:#483a37}.icon-button img{width:12px;height:12px;display:block;object-fit:contain}</style>
