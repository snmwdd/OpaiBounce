<script lang="ts">
    import Router, {location} from "svelte-spa-router";
    import Hud from "./routes/hud/Hud.svelte";
    import {getClientInfo, getMetadata, getTheme, getVirtualScreen, openScreen, confirmVirtualScreen} from "./integration/rest";
    import {cleanupListeners, listenAlways} from "./integration/ws";
    import {onMount,tick} from "svelte";
    import {insertPersistentData} from "./integration/persistent_storage";
    import {isStatic,isPreview} from "./integration/host";
    import Inventory from "./routes/inventory/Inventory.svelte";
    import Title from "./routes/menu/title/Title.svelte";
    import Multiplayer from "./routes/menu/multiplayer/Multiplayer.svelte";
    import AltManager from "./routes/menu/altmanager/AltManager.svelte";
    import Singleplayer from "./routes/menu/singleplayer/Singleplayer.svelte";
    import ProxyManager from "./routes/menu/proxymanager/ProxyManager.svelte";
    import None from "./routes/none/None.svelte";
    import Disconnected from "./routes/menu/disconnected/Disconnected.svelte";
    import BasicMenu from "./routes/menu/basicmenu/BasicMenu.svelte";
    import Browser from "./routes/browser/Browser.svelte";
    import TabbedClickGui from "./routes/clickgui/TabbedClickGui.svelte";
    import {intToRgba, rgbaToHex} from "./integration/util";
    import type {ThemeColorChangeEvent} from "./integration/events";
    import Menu from "./routes/menu/common/Menu.svelte";
    import MenuContent from "./routes/menu/common/MenuContent.svelte";
    import {push} from "./integration/router";

    import {requestPalette,cancelPalette} from './opai/paletteIntent';
    import BridgeHost from './opai/BridgeHost.svelte';
    import FrameDiagnostics from './opai/FrameDiagnostics.svelte';
    import {setMotionPlatform} from './opai/motionPlatform';
    import MusicPanel from './opai/MusicPanel.svelte';
    import {musicOpen,installMusicMonitor} from './opai/music';
    import Errors from "./opai/Errors.svelte";
    const menuRoutes = {
        "/title": Title,
        "/multiplayer": Multiplayer,
        "/altmanager": AltManager,
        "/singleplayer": Singleplayer,
        "/proxymanager": ProxyManager,
    };

    const routes = {
        "/clickgui": TabbedClickGui,
        "/hud": Hud,
        "/inventory": Inventory,
        "/none": None,
        "/disconnected": Disconnected,
        "/basicmenu": BasicMenu,
        "/browser": Browser
    };

    let previewBackdrop = false;
    const SURFACE_TINT_MIX = 18;

    function isMenuRoute(route: string): boolean {
        return route in menuRoutes;
    }

    let routing=0;
    async function changeRoute(name: string) {
        const sequence=++routing;
        getClientInfo().then(c => {setMotionPlatform(c.os);previewBackdrop = !c.inGame;}).catch(() => {});
        const nextRoute = `/${name}`;
        if($location===nextRoute){if(!isStatic)void confirmVirtualScreen(name).catch(()=>{});return;}
        if (!isMenuRoute($location) || !isMenuRoute(nextRoute)) {
            cleanupListeners();
        }

        console.log(`[Router] Redirecting to ${name}`);
        await push(nextRoute);await tick();
        if(sequence===routing&&!isStatic)void confirmVirtualScreen(name).catch(()=>{});
    }

    function setThemeColor(name: string, value: string) {
        document.documentElement.style.setProperty(`--${name}`, value);
    }

    function themeColorToHex(value: number) {
        return rgbaToHex(intToRgba(value));
    }

    function mixColors(leftColor: string, rightColor: string, strength: number) {
        return `color-mix(in srgb, ${leftColor} ${100 - strength}%, ${rightColor})`;
    }

    function applyAccentColor(color: number) {
        setThemeColor("accent-color", themeColorToHex(color));
    }

    function applyTintColor(defaultSurfaceColor: string, color: number) {
        setThemeColor("surface-color", mixColors(defaultSurfaceColor, themeColorToHex(color), SURFACE_TINT_MIX));
    }

    onMount(() => {
        let alive = true;
        const stopMusicMonitor=installMusicMonitor();
        const remove: (() => void)[] = [];
        let paletteOpening=false,screenRevision=0;
        async function showPalette(){
            if($location!=='/hud'||paletteOpening)return;
            paletteOpening=true;let requestId:string|undefined;
            try{const request=await requestPalette();if(!request)return;requestId=request.id;
                if(isPreview)await changeRoute('clickgui');else await openScreen('clickgui');
            }catch{if(requestId)void cancelPalette(requestId).catch(()=>{});}finally{paletteOpening=false;}
        }
        const period=(event:KeyboardEvent)=>{if(event.code==='Period'&&!event.repeat&&$location==='/hud'&&!(event.target instanceof HTMLInputElement)&&!(event.target instanceof HTMLTextAreaElement)){event.preventDefault();void showPalette();}};
        document.addEventListener('keydown',period);
        remove.push(()=>document.removeEventListener('keydown',period));
        remove.push(listenAlways('keyboardKey',event=>{if(event.action===1&&!event.screen&&event.key==='key.keyboard.period')void showPalette();}));
        if(isStatic&&!isPreview)remove.push(listenAlways('virtualScreen',e=>{if(e.action==='close')void cancelPalette().catch(()=>{});}));
        // Register routing before any REST request. A failed theme/storage request
        // must not leave the WebView ignoring screen events on startup/reconnect.
        async function syncScreen() {
            const revision=screenRevision,screen = await getVirtualScreen();
            if(alive&&revision===screenRevision){if(screen.name!=='clickgui')void cancelPalette().catch(()=>{});await changeRoute(screen.name || "none");}
        }
        async function appearance() {
            const metadata = await getMetadata();
            const theme = await getTheme(metadata.id);
            if(!alive)return;
            applyAccentColor(theme.colors.accent);
            applyTintColor(metadata.colors.Tint,theme.colors.tint);
        }
        remove.push(listenAlways("themeColorChange", (event: ThemeColorChangeEvent) => {
            if (event.themeId !== 'opai') return;
            if(event.name==='Accent')applyAccentColor(event.value);
            if(event.name==='Tint')applyTintColor('#1a1413',event.value);
        }));
        if(!isStatic) {
            remove.push(listenAlways("socketReady", () => {
                void syncScreen().catch(()=>{});
                void appearance().catch(()=>{});
            }));
            remove.push(listenAlways("virtualScreen", async (event: any) => {
            console.log(`[Router] Virtual screen change to ${event.screenName}`);
            screenRevision++;
            const action = event.action;

            switch (action) {
                case "close":
                    void cancelPalette().catch(()=>{});
                    await changeRoute("none");
                    break;
                case "open":
                    await changeRoute(event.screenName || "none");
                    break;
            }
            }));
            void syncScreen().catch(()=>{});
        }
        void appearance().catch(()=>{});
        void insertPersistentData();
        getClientInfo().then(c => {if(alive){setMotionPlatform(c.os);previewBackdrop=!c.inGame;}}).catch(()=>{});
        return () => { alive=false;stopMusicMonitor();remove.forEach(unsubscribe=>unsubscribe()); };
    });
</script>

{#if $musicOpen}<MusicPanel/>{/if}
<Errors/>
<FrameDiagnostics/>
<main>
    {#if previewBackdrop && ($location === '/clickgui' || $location === '/hud')}<div class="opai-preview-backdrop"></div>{/if}
    {#if isMenuRoute($location)}
        <Menu>
            {#key $location}
                <MenuContent>
                    <svelte:component this={menuRoutes[$location as keyof typeof menuRoutes]}/>
                </MenuContent>
            {/key}
        </Menu>
    {:else}
        <Router {routes}/>
    {/if}
</main>

<style>.opai-preview-backdrop{position:fixed;inset:0;z-index:-1;background:linear-gradient(#0009,#0009),url('/opai/image/background.png') center/cover no-repeat}</style>

<BridgeHost/>
