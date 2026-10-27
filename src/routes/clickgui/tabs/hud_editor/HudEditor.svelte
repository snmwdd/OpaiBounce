<script lang="ts">
 import {onMount} from 'svelte';
 import Hud from '../../../hud/Hud.svelte';
 import {darken} from '../../clickgui_store';
 onMount(()=>{$darken=false;return()=>{$darken=true;};});
</script>
<div class="opai-hud-editor"><Hud inEditor/></div>
<style>.opai-hud-editor{position:absolute;inset:0;animation:reveal 180ms ease-out}@keyframes reveal{from{opacity:0}to{opacity:1}}</style>
