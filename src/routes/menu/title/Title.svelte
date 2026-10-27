<script lang="ts">
    import {onMount} from 'svelte';
    import {exitClient,getClientInfo,openScreen} from '../../../integration/rest';
    import {isStatic} from '../../../integration/host';
    import {push} from '../../../integration/router';
    import Icon from '../../../opai/Icon.svelte';
    import Logo from '../../../opai/Logo.svelte';
    import {ripple} from '../../../opai/motion';
    import {menuMotion,enterTitle,transitionMenu,menuTransform} from '../../../opai/menuMotion';
    let element: HTMLDivElement;
    let width = 1000, height = 550, leaving = false;
    $: ({phase,rotation}=$menuMotion);
    let version = 'LiquidBounce';

    const buttons = [
        ['Single player','single_player','singleplayer'],
        ['Multi player','multi_player','multiplayer'],
        ['Alt Manager','alt_manager','altmanager'],
        ['Proxy Manager','proxy_manager','proxymanager'],
        ['Options','options','options'],['Shutdown','shutdown','shutdown']
    ];
    onMount(() => {
        enterTitle();
        const observer = new ResizeObserver(() => { width = element.clientWidth; height = element.clientHeight; });
        observer.observe(element);
        getClientInfo().then(c => version = `Minecraft ${c.gameVersion}`).catch(() => {});
        return () => { observer.disconnect(); };
    });
    async function go(screen: string) {
        if (leaving) return;
        if (screen === 'shutdown') { if (!isStatic) await exitClient(); return; }
        if (screen === 'options') { if (!isStatic) await openScreen(screen); return; }
        if(screen==='clickgui') {
            if(isStatic)await push('/'+screen);else await openScreen(screen).catch(()=>{});
            return;
        }
        leaving = true;
        transitionMenu(true,()=>{
            if(isStatic)push('/'+screen);
            else openScreen(screen).catch(()=>{leaving=false;transitionMenu(false);});
        });
    }

    function keyboard(e: KeyboardEvent) { if(e.key==='Escape' && leaving){leaving=false;transitionMenu(false);}if(e.code === 'ShiftRight') go('clickgui'); }
</script>
<svelte:window on:keydown={keyboard}/>
<div class="title-screen" bind:this={element}>
    {#if phase * 200 <= 40}<Logo {width} {height} y={height / 2 - 126 + Math.min(135,phase*200)}/><h1 style:top="{height / 2 - 72}px" style:transform="translate(-50%,{Math.min(135,phase*200)}px)">Opai</h1>{/if}
    <div class="menu-buttons" style:top="{height / 2 - 40}px" style:transform={menuTransform(rotation,1+phase*.69,1+phase*((height-100)/150-1))}>
        {#each buttons as [label,icon,screen]}<button use:ripple on:click={() => go(screen)} disabled={leaving}><span><Icon name={icon}/><span>{label}</span></span></button>{/each}
    </div>
    <footer style:transform="translateX(-50%) translateY({Math.min(50,phase*200)}px)"><div>Opai Client b26.40</div><div>{version} · LiquidBounce theme</div><div>Made by StylesFoundation</div></footer>
</div>
<style>
    .title-screen{position:absolute;inset:0}h1{position:absolute;left:50%;transform:translateX(-50%);font-size:24px;font-weight:400;line-height:29px;color:var(--accent-color)}.menu-buttons{position:absolute;left:50%;width:140px;height:148.2px;border-radius:12px;overflow:hidden;background:#0009;transform-origin:center;}.menu-buttons button{position:relative;overflow:hidden;isolation:isolate;display:flex;align-items:center;justify-content:center;width:140px;height:25px;color:var(--accent-color);font:400 10px 'Google Sans','Opai CJK',sans-serif;border:0;background:transparent;cursor:pointer;transition:background-color 120ms}.menu-buttons button>span{display:flex;align-items:center;gap:4px;pointer-events:none}.menu-buttons button:hover{background:#ffffff28}footer{position:absolute;left:50%;bottom:4px;width:200px;height:36px;border-radius:4px;background:#0009;text-align:center;color:white;font-size:9px;line-height:10px;padding-top:3px}
</style>
