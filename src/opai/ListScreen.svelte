<script lang="ts">
    import {onMount} from 'svelte';
    import * as api from '../integration/rest';
    import type {Account, Proxy, Server, World, Protocol} from '../integration/types';
    import {listen} from '../integration/ws';
    import {isStatic} from '../integration/host';
    import {push} from '../integration/router';
    import {ripple} from './motion';
    import {sortableRow,type SortDrag} from './sortableRow';
    import {parseOrder,ordered,moveOrder} from './listOrder';
    import {savePersistentItem} from '../integration/persistent_storage';
    import {portal} from '../integration/util';
    import {menuMotion,enterList,transitionMenu,menuTransform} from './menuMotion';
    import Icon from './Icon.svelte';
    import ViaSelector from './ViaSelector.svelte';
    import AddServer from '../routes/menu/multiplayer/AddServerModal.svelte';
    import EditServer from '../routes/menu/multiplayer/EditServerModal.svelte';
    import DirectConnect from '../routes/menu/multiplayer/DirectConnectModal.svelte';
    import AddAccount from '../routes/menu/altmanager/addaccount/AddAccountModal.svelte';
    import DirectLogin from '../routes/menu/altmanager/directLogin/DirectLoginModal.svelte';
    import AddProxy from '../routes/menu/proxymanager/AddProxyModal.svelte';
    import Modal from '../routes/menu/common/modal/Modal.svelte';
    export let kind: 'multiplayer' | 'altmanager' | 'proxymanager' | 'singleplayer';
    let servers: Server[] = [], accounts: Account[] = [], proxies: Proxy[] = [], worlds: World[] = [];
    let protocols: Protocol[] = [], protocol: Protocol | undefined;
    let order:string[]=[],drag:SortDrag|null=null,listReady=false;
    $: orderKey='opai.order.'+kind+'.v1';
    function rowKey(row:{id:number}){return kind==='multiplayer'?servers.find(s=>s.id===row.id)?.address+'|'+servers.find(s=>s.id===row.id)?.name:kind==='singleplayer'?worlds.find(w=>w.id===row.id)?.name??String(row.id):String(row.id);}
    function sorting(row:{id:number;title:string}){const key=rowKey(row);return{key,label:row.title,enabled:()=>!busy&&(kind==='multiplayer'||kind==='singleplayer'),change:(value:SortDrag|null)=>drag=value,drop:(target:string,before:boolean)=>{void run(async()=>{const next=moveOrder(rows.map(rowKey),key,target,before);await savePersistentItem(orderKey,JSON.stringify(next));order=next;});}};}
    let selected = -1, add = false, edit = false, direct = false, via = false, confirm = false;
    let error = '', busy = false, leaving = false;
    let currentProxy: Proxy | null = null;
    $: fade=Math.max(0,Math.min(1,($menuMotion.phase-.79)/.21));
    $: title = ({multiplayer:'Server Selector',altmanager:'Alt Manager',proxymanager:'Proxy Manager',singleplayer:'Select World'})[kind];
    $: listWidth = kind === 'multiplayer' || kind === 'singleplayer' ? 320 : 240;
    $: rawRows = kind === 'multiplayer' ? servers.map(s => ({id:s.id,title:s.name,detail:s.online ? `${s.players.online}/${s.players.max} players · ${s.ping} ms` : 'Not pinged',extra:s.address,image:s.icon ? `data:image/png;base64,${s.icon}` : 'opai/minecraft/unknown_server.png'}))
        : kind === 'altmanager' ? accounts.map(a => ({id:a.id,title:a.username,detail:a.type,extra:a.favorite ? 'Favorite' : '',image:a.avatar}))
        : kind === 'proxymanager' ? proxies.map(p => ({id:p.id,title:`${p.host}:${p.port}`,detail:p.type,extra:currentProxy?.id === p.id ? 'Connected' : '',image:''}))
        : worlds.map(w => ({id:w.id,title:w.displayName,detail:`${w.gameMode} · ${w.version}`,extra:w.name,image:w.icon ? `data:image/png;base64,${w.icon}` : ''}));
    $: rows=ordered(rawRows,order,rowKey);
    $: shown = listReady?rows:[];
    $: chosen = rows.find(r => r.id === selected);
    async function run(action: () => Promise<unknown>) {
        if (busy) return; busy = true; error = '';
        try { await action(); } catch (e) { error = e instanceof Error ? e.message : String(e); }
        finally { busy = false; }
    }
    async function refresh() {
        if(kind === 'multiplayer') { servers = await api.getServers(); currentProxy = await api.getCurrentProxy(); }
        else if(kind === 'altmanager') accounts = await api.getAccounts();
        else if(kind === 'proxymanager') { proxies = await api.getProxies(); currentProxy = await api.getCurrentProxy(); }
        else worlds = await api.getWorlds();
    }
    async function back() {
        if (leaving) return; leaving = true;
        transitionMenu(false,()=>{if(isStatic)push('/title');else api.openScreen('title').catch(()=>{leaving=false;transitionMenu(true);});});
    }
    function keyboard(e: KeyboardEvent) { if(e.key === 'Escape' && !add && !direct && !edit && !via && !confirm) back(); }
    onMount(() => { enterList();run(async()=>{try{await refresh();order=parseOrder(await api.getPersistentStorageItem(orderKey));}finally{listReady=true;}}); });
    listen('serverPinged', e => { servers = servers.map(s => s.address === e.server.address ? {...e.server,id:s.id,name:s.name,resourcePackPolicy:s.resourcePackPolicy} : s); });
    listen('accountManagerAddition', () => { add = false; run(refresh); });
    listen('accountManagerRemoval', () => run(refresh));
    listen('accountManagerLogin', e => { direct = false; error = e.error ?? ''; });
    listen('proxyCheckResult', e => { error = e.error ?? ''; add = false; run(refresh); });
    function activate(id: number) {
        selected = id;
        run(async () => {
            if (kind === 'multiplayer') { const address=servers.find(s => s.id === id)!.address; await api.connectToServer(address); sessionStorage.setItem('opai.server',address); }
            else if (kind === 'altmanager') await api.loginToAccount(id);
            else if (kind === 'proxymanager') { await api.connectToProxy(id); await refresh(); }
            else await api.openWorld(worlds.find(w => w.id === id)!.name);
        });
    }
    async function remove() {
        confirm = false;
        await run(async () => {
            if(kind === 'multiplayer') await api.removeServer(selected);
            else if(kind === 'altmanager') await api.removeAccount(selected);
            else if(kind === 'proxymanager') await api.removeProxy(selected);
            else await api.removeWorld(worlds.find(w => w.id === selected)!.name);
            selected = -1; await refresh();
        });
    }
    async function openVia() { await run(async () => { protocols = await api.getProtocols(); protocol = await api.getSelectedProtocol(); via = true; }); }
</script>
<svelte:window on:keydown={keyboard}/>
<section class="opai-list" class:leaving style:--list-width="{listWidth}px" aria-label={title}>
    <h1 style:opacity={fade}>{title}</h1>
    <div class="rows" style:transform={menuTransform($menuMotion.rotation+180,$menuMotion.phase)}>
        {#each shown as row (row.id)}
            <button data-order-key={rowKey(row)} use:sortableRow={sorting(row)} class:drop-before={drag?.target===rowKey(row)&&drag?.before&&drag.key!==rowKey(row)} class:drop-after={drag?.target===rowKey(row)&&!drag?.before&&drag.key!==rowKey(row)} class:drag-source={drag?.key===rowKey(row)} class="row" class:selected={selected === row.id} on:click={() => selected = row.id} on:dblclick={() => activate(row.id)}>
                {#if row.image}<img class="row-icon" src={row.image} alt=""/>{:else}<span class="row-icon"><Icon name={kind === 'multiplayer' ? 'server' : kind === 'proxymanager' ? 'proxy_manager' : 'user'} size={28}/></span>{/if}
                <span class="row-title">{row.title}</span><span class="detail">{row.detail}</span><span class="extra">{row.extra}</span>
            </button>
        {/each}
    </div>
    <div class="controls" style:opacity={fade}>
        {#if kind === 'multiplayer'}
            <div><button class="opai-list-button" use:ripple disabled={!chosen || busy} on:click={() => activate(selected)}>Join Server</button><button class="opai-list-button" use:ripple on:click={() => direct = true}>Direct Connect</button><button class="opai-list-button" use:ripple on:click={() => add = true}>Add Server</button></div>
            <div><button class="opai-list-button" use:ripple disabled={!chosen} on:click={() => edit = true}>Edit</button><button class="opai-list-button" use:ripple disabled={!chosen} on:click={() => confirm = true}>Delete</button><button class="opai-list-button" use:ripple on:click={() => run(refresh)}>Refresh</button><button class="opai-list-button" use:ripple on:click={back}>Back</button></div>
        {:else if kind === 'altmanager'}
            <div><button class="opai-list-button" use:ripple disabled={!chosen || busy} on:click={() => activate(selected)}>Login</button><button class="opai-list-button" use:ripple on:click={() => add = true}>Add Account</button><button class="opai-list-button" use:ripple on:click={() => direct = true}>Direct Login</button></div>
            <div><button class="opai-list-button" use:ripple disabled={!chosen} on:click={() => confirm = true}>Delete</button><button class="opai-list-button" use:ripple on:click={() => run(api.restoreSession)}>Restore Session</button><button class="opai-list-button" use:ripple on:click={back}>Back</button></div>
        {:else if kind === 'proxymanager'}
            <div><button class="opai-list-button" use:ripple on:click={() => add = true}>Add</button><button class="opai-list-button" use:ripple disabled={!chosen} on:click={() => confirm = true}>Delete</button><button class="opai-list-button" use:ripple on:click={back}>Back</button></div>
            <div><button class="opai-list-button" use:ripple disabled={!chosen || busy} on:click={() => activate(selected)}>Connect</button><button class="opai-list-button" use:ripple disabled={!currentProxy} on:click={() => run(async () => { await api.disconnectFromProxy(); await refresh(); })}>Disconnect</button></div>
        {:else}
            <div><button class="opai-list-button" use:ripple disabled={!chosen || busy} on:click={() => activate(selected)}>Play Selected World</button><button class="opai-list-button" use:ripple on:click={() => api.openScreen('create_world')}>Create New World</button></div>
            <div><button class="opai-list-button" use:ripple disabled={!chosen} on:click={() => api.editWorld(worlds.find(w => w.id === selected)!.name)}>Edit</button><button class="opai-list-button" use:ripple disabled={!chosen} on:click={() => confirm = true}>Delete</button><button class="opai-list-button" use:ripple on:click={back}>Back</button></div>
        {/if}
    </div>
    {#if kind === 'multiplayer'}<button class="opai-list-button via" style:opacity={fade} use:ripple on:click={openVia}>Via Version</button><div class="proxy-label" style:opacity={fade}>Proxy: {currentProxy ? `${currentProxy.host}:${currentProxy.port}` : 'Not Connected'}</div>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>
{#if drag}<div use:portal class="list-drag-ghost" style:left="{drag.x+12}px" style:top="{drag.y+12}px">{drag.label}</div>{/if}
{#if kind === 'multiplayer'}
    <AddServer bind:visible={add} on:serverAdd={() => run(refresh)}/><DirectConnect bind:visible={direct}/>
    {#if edit && chosen}{@const s = servers.find(s => s.id === selected)!}<EditServer bind:visible={edit} id={s.id} name={s.name} address={s.address} resourcePackPolicy={s.resourcePackPolicy} on:serverEdit={() => run(refresh)}/>{/if}
{:else if kind === 'altmanager'}<AddAccount bind:visible={add}/><DirectLogin bind:visible={direct}/>
{:else if kind === 'proxymanager'}<AddProxy bind:visible={add}/>{/if}
<Modal title="Delete {chosen?.title ?? ''}?" bind:visible={confirm}><p>This removes the selected entry from the client.</p><button class="opai-list-button" on:click={remove}>Delete</button></Modal>
{#if via}<ViaSelector {protocols} bind:selected={protocol} on:close={()=>via=false}/>{/if}
<style lang="scss">@use './listScreen.scss';.row{touch-action:none;user-select:none}.row.drop-before{box-shadow:0 -2px var(--accent-color)}.row.drop-after{box-shadow:0 2px var(--accent-color)}.row.drag-source{opacity:.4}.list-drag-ghost{position:fixed;z-index:2000001;pointer-events:none;padding:8px 12px;border-radius:8px;background:#211b1af0;color:var(--accent-color);font-size:14px;box-shadow:0 3px 12px #0005}.via{position:absolute;left:10px;top:10px;width:83px}.proxy-label{position:absolute;left:10px;bottom:12px;font-size:8px;color:white}</style>
