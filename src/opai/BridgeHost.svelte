<script lang="ts">
    import {onMount} from 'svelte';
    import {location} from 'svelte-spa-router';
    import {isStatic, isPreview} from '../integration/host';
    import {refreshOpaiPreferences} from './preferences';
    import {listen} from '../integration/ws';
    import {installActivityMonitor,islandActivity} from './islandActivity';
    import {installBridgeAPI,refreshBridge,bridgeState} from './scriptBridge';
    let refresh=()=>{};
    const releases = 'https://github.com/snmwdd/OpaiBounce/releases';
    let missingScript=false, scriptDialog:HTMLDialogElement, releaseAddress:HTMLInputElement;
    let copyStatus='';
    const canPrompt = (route:string) => ['/title','/multiplayer','/singleplayer','/altmanager','/clickgui','/basicmenu','/hud'].includes(route);
    $: if (missingScript && scriptDialog && !scriptDialog.open) scriptDialog.showModal();
    $: if (!missingScript) copyStatus='';

    async function copyReleaseAddress() {
        try {
            await navigator.clipboard.writeText(releases);
            copyStatus='已复制下载链接';
            return;
        } catch {
            // CEF builds can disable the Clipboard API. Copy the selected field instead.
        }
        if (!releaseAddress?.isConnected) return;
        releaseAddress.focus();
        releaseAddress.select();
        try {
            if (document.execCommand('copy')) {
                copyStatus='已复制下载链接';
                return;
            }
        } catch {
            // Keep the URL selected for the platform's copy shortcut.
        }
        copyStatus='链接已选中，请按 Ctrl+C 或 ⌘C 复制';
    }
    listen('virtualScreen',()=>refresh());listen('disconnect',()=>{islandActivity.set(null);refresh();});
    onMount(()=>{
        const uninstall=installBridgeAPI();const stopActivity=installActivityMonitor(()=>['/hud','/clickgui'].includes($location)&&$bridgeState?.capabilities.activity===true);let alive=true;
        let lastPreferencePoll = 0;
        let missingSince:number|null=null, checking=false;
        async function checkScript() {
            if (checking) return;
            checking=true;
            try {
                await refreshBridge();
                if (!alive) return;
                if (isPreview || !canPrompt($location) || $bridgeState) {
                    missingSince=null;
                    missingScript=false;
                } else {
                    missingSince ??= Date.now();
                    missingScript=Date.now()-missingSince>=4000;
                }
            } finally { checking=false; }
        }
        function poll() {
            if (!alive) return;
            if (canPrompt($location)) void checkScript();
            else { missingSince=null; missingScript=false; }
            // Native HUD and ClickGUI may be separate CEF views.
            if (isStatic && !isPreview && $location === '/hud' && Date.now() - lastPreferencePoll >= 2000) {
                lastPreferencePoll = Date.now();
                void refreshOpaiPreferences().catch(() => {});
            }
        }
        refresh=poll;poll();const timer=setInterval(poll,250);const unsubscribe=location.subscribe(()=>poll());
        return()=>{alive=false;refresh=()=>{};clearInterval(timer);unsubscribe();uninstall();stopActivity();};
    });
</script>

{#if missingScript}
    <dialog bind:this={scriptDialog} aria-labelledby="opai-script-title" on:cancel={(event)=>event.preventDefault()}>
        <h2 id="opai-script-title">缺少 OpaiBounce 脚本</h2>
        <p>从 GitHub Releases 下载 <code>OpaiBounceScript.js</code>，放入 LiquidBounce 的 scripts 文件夹，再重新启动游戏。</p>
        <div class="download-actions">
            <a href={releases}>前往 GitHub Releases 下载脚本</a>
            <button type="button" on:click={copyReleaseAddress}>复制链接</button>
        </div>
        <input aria-label="脚本下载链接" bind:this={releaseAddress} value={releases} readonly on:focus={(event)=>event.currentTarget.select()}/>
        <div class="copy-status" role="status">{copyStatus}</div>
    </dialog>
{/if}

<style>
    dialog{position:fixed;inset:0;margin:auto;max-width:min(410px,calc(100vw - 32px));padding:22px;border:1px solid var(--accent-color);border-radius:14px;background:#1c1514;color:#f8edeb;font:14px/1.6 'Google Sans','Opai CJK',sans-serif}
    dialog::backdrop{background:#0007}
    h2{margin:0;font-size:19px}
    p{margin:8px 0 16px}
    .download-actions{display:flex;flex-wrap:wrap;gap:8px}
    a,button{padding:7px 12px;border:0;border-radius:7px;background:var(--accent-color);color:var(--opai-enabled-text,#211816);font:inherit;font-weight:700;cursor:pointer}
    button{background:#3b2b29;color:inherit}
    input{box-sizing:border-box;width:100%;margin-top:12px;padding:7px 9px;border:1px solid #6d514d;border-radius:7px;background:#251b1a;color:inherit;font:inherit}
    .copy-status{min-height:1.6em;margin-top:4px}
</style>
