<script lang="ts">
    import {location} from 'svelte-spa-router';
    import {onMount} from 'svelte';
    import {getGameWindow,getClientInfo} from '../../../integration/rest';
    import {listen} from '../../../integration/ws';
    import Notifications from './header/Notifications.svelte';
    import Intro from '../../../opai/Intro.svelte';
    import {menuMotion,menuAnimating,softwareMenu,setMenuPlatform,stopMenuMotion} from '../../../opai/menuMotion';
    import {onDestroy} from 'svelte';
    onDestroy(stopMenuMotion);
    let scale = 2;
    $: title = $location === '/title';
    onMount(() => { getGameWindow().then(w => scale = w.scaleFactor).catch(() => {});getClientInfo().then(info=>setMenuPlatform(info.os)).catch(()=>{}); });
    listen('scaleFactorChange', e => scale = e.scaleFactor);
</script>
<div class="opai-menu" data-motion-active={$menuAnimating} data-projection={$softwareMenu?'software':'3d'} class:title style:--opai-scale={scale}>
    <div class="backdrop" style:transform="scale({1+$menuMotion.zoom/10})"></div>
    <div class="menu-wrapper"><slot/></div>
    <Notifications/>
</div>
<Intro/>
<style>
    .opai-menu{position:fixed;inset:0;color:var(--text-color);font-family:'Google Sans',sans-serif;isolation:isolate}.backdrop{position:absolute;inset:-2px;background:linear-gradient(#0007,#0007),url('/opai/image/background.png') center/cover no-repeat;z-index:-1}.opai-menu:not(.title) .backdrop{background-image:linear-gradient(#0005,#0005),url('/opai/image/background.png')}.menu-wrapper{position:absolute;inset:0;zoom:var(--opai-scale)}
</style>
