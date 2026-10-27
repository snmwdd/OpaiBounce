<script lang="ts">
    import {onMount,onDestroy} from 'svelte';
    import * as api from '../integration/rest';
    import type {Account} from '../integration/types';
    import {listen} from '../integration/ws';
    import {savePersistentItem,persistentDataLoaded} from '../integration/persistent_storage';
    import {isStatic} from '../integration/host';
    import {push} from '../integration/router';
    import {portal} from '../integration/util';
    import {ripple} from './motion';
    import {menuMotion,enterList,transitionMenu,menuTransform} from './menuMotion';
    import {ACCOUNT_FOLDERS_KEY,accountKey,parseFolders,folderCount,folderPath,createFolder,renameFolder,moveFolder,deleteFolder,assignAccount,descendants,type AccountFolderLayout} from './accountFolders';
    import VectorIcon from './VectorIcon.svelte';
    import Icon from './Icon.svelte';
    import Island from './Island.svelte';
    import {accountDrag,type AccountDrag} from './accountDrag';
    import {parseOrder,ordered,moveOrder} from './listOrder';
    import type {AccountNotice} from './accountNotice';
    import Modal from '../routes/menu/common/modal/Modal.svelte';
    import AddAccount from '../routes/menu/altmanager/addaccount/AddAccountModal.svelte';
    import DirectLogin from '../routes/menu/altmanager/directLogin/DirectLoginModal.svelte';
    let loginNotifying=false,drag:AccountDrag|null=null,accountNotice:AccountNotice|null=null;
    function notify(text:string,kind:AccountNotice['kind']='success'){accountNotice={id:Date.now()+Math.random(),text,kind};}
    let order:string[]=[];
    let accounts:Account[]=[], layout:AccountFolderLayout={version:1,folders:[],assignments:{}};
    let current:string|null=null, selected='', ready=false, busy=false, leaving=false, error='';
    let deleteTarget:{name:string;folder:string|null;account:string|null}|null=null;
    let add=false,direct=false,confirm=false,editName=false,renaming=false,name='';
    let storageAvailable=true;
    let corruptRaw:string|null=null,addTarget:string|null=null,addKeys=new Set<string>(),alive=true,refreshTicket=0;
    onDestroy(()=>{alive=false;refreshTicket++;});
    $: fade=Math.max(0,Math.min(1,($menuMotion.phase-.79)/.21));
    $: chosenFolder=selected.startsWith('f:')?layout.folders.find(f=>f.id===selected.slice(2)):undefined;
    $: chosenAccount=selected.startsWith('a:')?accounts.find(a=>accountKey(a)===selected.slice(2)):undefined;
    $: children=layout.folders.filter(f=>f.parent===current);
    $: shownAccounts=ordered(accounts.filter(a=>(layout.assignments[accountKey(a)]??null)===current),order,accountKey);
    $: accountTypes=Object.fromEntries(accounts.map(a=>[a.username.toLowerCase(),/cracked|offline/i.test(a.type)?'Offline':a.type]));
    async function run(action:()=>Promise<unknown>){if(busy)return;busy=true;error='';try{await action();}catch(e){if(alive){error=e instanceof Error?e.message:String(e);notify(error,'warning');}}finally{if(alive)busy=false;}}
    async function refresh(){const ticket=++refreshTicket;const next=await api.getAccounts();if(alive&&ticket===refreshTicket)accounts=next;return next;}
    async function initialize(){await persistentDataLoaded;await refresh();let raw:string|null;try{raw=await api.getPersistentStorageItem(ACCOUNT_FOLDERS_KEY);}catch(e){storageAvailable=false;ready=true;throw e;}if(!alive)return;try{layout=parseFolders(raw,accounts);}catch(e){corruptRaw=raw;error=e instanceof Error?e.message:String(e);}order=parseOrder(await api.getPersistentStorageItem('opai.order.accounts.v1'));ready=true;}
    async function save(next:AccountFolderLayout){
        if(!storageAvailable)throw new Error('Folder storage is unavailable. Reopen Alt Manager before saving folders.');
        if(corruptRaw!==null){await savePersistentItem(`${ACCOUNT_FOLDERS_KEY}.recovery`,corruptRaw);corruptRaw=null;}
        await savePersistentItem(ACCOUNT_FOLDERS_KEY,JSON.stringify(next));if(alive)layout=next;
    }
    function openFolder(id:string|null){current=id;selected='';}
    function activate(){if(chosenFolder){openFolder(chosenFolder.id);return;}if(chosenAccount){const key=accountKey(chosenAccount);void run(async()=>{const fresh=await refresh();const account=fresh.find(a=>accountKey(a)===key);if(!account)throw new Error('Account no longer exists.');await api.loginToAccount(account.id);});}}
    function newFolder(){renaming=false;name='';editName=true;}
    function rename(){if(!chosenFolder)return;renaming=true;name=chosenFolder.name;editName=true;}
    function submitName(){void run(async()=>{const next=renaming&&chosenFolder?renameFolder(layout,chosenFolder.id,name):createFolder(layout,name,current,crypto.randomUUID());await save(next);notify(`${renaming?'Renamed folder to':'Created folder'} ${name.trim()}`);editName=false;});}
    function dragOptions(key:string,label:string){return{key,label,blocked:()=>busy||!ready,allowed:(target:string|null)=>{
        if(target===current)return false;
        return !key.startsWith('f:')||target===null||!descendants(layout,key.slice(2)).has(target);
    },change:(value:AccountDrag|null)=>drag=value,drop:(target:string|null)=>{void run(async()=>{
        const next=key.startsWith('f:')?moveFolder(layout,key.slice(2),target):assignAccount(layout,key.slice(2),target);
        await save(next);selected='';notify(`Moved ${label} to ${folderPath(layout,target)}`);
    });},reorder:(target:string,before:boolean)=>{if(!key.startsWith('a:'))return;void run(async()=>{const keys=shownAccounts.map(accountKey),visible=new Set(keys),existing=new Set(accounts.map(accountKey));const next=[...order.filter(k=>!visible.has(k)&&existing.has(k)),...moveOrder(keys,key.slice(2),target,before)];await savePersistentItem('opai.order.accounts.v1',JSON.stringify(next));order=next;notify('Account order updated');});}};}
    function requestDelete(){deleteTarget=chosenFolder?{name:chosenFolder.name,folder:chosenFolder.id,account:null}:chosenAccount?{name:chosenAccount.username,folder:null,account:accountKey(chosenAccount)}:null;confirm=deleteTarget!==null;}
    function remove(){const folder=deleteTarget?.folder;const key=deleteTarget?.account;void run(async()=>{if(folder)await save(deleteFolder(layout,folder));else if(key){const fresh=await refresh();const account=fresh.find(a=>accountKey(a)===key);if(!account)throw new Error('Account no longer exists.');await api.removeAccount(account.id);await refresh();}notify(`Deleted ${deleteTarget?.name??'entry'}`);selected='';confirm=false;});}
    function openAdd(){addTarget=current;addKeys=new Set(accounts.map(accountKey));add=true;}
    async function addition(event:{error:string|null}){
        if(event.error){error=event.error;notify(error,'warning');return;}
        const wasAdding=add;add=false;if(wasAdding)busy=true;
        try{const next=await refresh();if(wasAdding){let changed=layout;for(const a of next)if(!addKeys.has(accountKey(a)))changed=assignAccount(changed,accountKey(a),layout.folders.some(f=>f.id===addTarget)?addTarget:null);if(changed!==layout)await save(changed);notify('Account added successfully');}}catch(e){error=e instanceof Error?e.message:String(e);}finally{if(wasAdding)busy=false;}
    }
    async function back(){if(current!==null){openFolder(layout.folders.find(f=>f.id===current)?.parent??null);return;}if(leaving)return;leaving=true;transitionMenu(false,()=>{if(isStatic)push('/title');else api.openScreen('title').catch(()=>{leaving=false;transitionMenu(true);});});}
    function keyboard(e:KeyboardEvent){if(e.key==='Escape'&&!add&&!direct&&!confirm&&!editName)void back();}
    onMount(()=>{enterList();void run(initialize);});
    listen('accountManagerAddition',e=>void addition(e));
    listen('accountManagerRemoval',()=>{void refresh().catch(e=>error=String(e));});
    listen('accountManagerLogin',e=>{if(!e.error)direct=false;error=e.error??'';});
    listen('accountManagerMessage',e=>notify(e.message,'info'));
</script>
<svelte:window on:keydown={keyboard}/>
<section class="opai-list" class:leaving style:--list-width="280px" aria-label="Alt Manager">
    <h1 style:opacity={loginNotifying?0:fade}>Alt Manager</h1>
    <div class="rows" style:transform={menuTransform($menuMotion.rotation+180,$menuMotion.phase)} aria-busy={!ready}>
        {#if current!==null}<button data-drop-folder={layout.folders.find(f=>f.id===current)?.parent??''} class:drop-target={drag?.target!==undefined&&drag.target===(layout.folders.find(f=>f.id===current)?.parent??null)} class="row parent" on:click={()=>openFolder(layout.folders.find(f=>f.id===current)?.parent??null)}><span class="row-icon"><VectorIcon name="folder" size={22}/></span><span class="row-title">Root folder</span><span class="detail">..</span><span class="extra">{folderPath(layout,current)}</span></button>{/if}
        {#each children as folder (folder.id)}<button data-drop-folder={folder.id} class:drop-target={drag?.target===folder.id} class:drag-source={drag?.key===`f:${folder.id}`} use:accountDrag={dragOptions(`f:${folder.id}`,folder.name)} class="row folder" class:selected={selected===`f:${folder.id}`} on:click={()=>selected=`f:${folder.id}`} on:dblclick={()=>openFolder(folder.id)} aria-label="Folder {folder.name}"><span class="row-icon"><VectorIcon name="folder" size={22}/></span><span class="row-title">{folder.name}</span><span class="detail">{folderCount(layout,accounts,folder.id)} accounts.</span><span class="extra"></span></button>{/each}
        {#each shownAccounts as account (accountKey(account))}<button data-order-key={accountKey(account)} class:drop-before={drag?.orderTarget===accountKey(account)&&drag?.before} class:drop-after={drag?.orderTarget===accountKey(account)&&!drag?.before} class:drag-source={drag?.key===`a:${accountKey(account)}`} use:accountDrag={dragOptions(`a:${accountKey(account)}`,account.username)} class="row account" class:selected={selected===`a:${accountKey(account)}`} on:click={()=>selected=`a:${accountKey(account)}`} on:dblclick={()=>{selected=`a:${accountKey(account)}`;activate();}} aria-label="Account {account.username}">{#if account.avatar}<img class="row-icon" src={account.avatar} alt=""/>{:else}<span class="row-icon"><Icon name="user" size={28}/></span>{/if}<span class="row-title">{account.username}</span><span class="detail">{account.type}</span><span class="extra">{account.favorite?'Favorite':''}</span></button>{/each}
        {#if ready&&!children.length&&!shownAccounts.length}<p class="empty">This folder is empty.</p>{/if}
    </div>
    <button class="opai-list-button restore" style:opacity={fade} use:ripple disabled={busy} on:click={()=>run(api.restoreSession)}>Restore Session</button>
    <div class="controls" style:opacity={fade}>
        <div><button class="opai-list-button" use:ripple disabled={!ready||busy||(!chosenFolder&&!chosenAccount)} on:click={activate}>{chosenFolder?'Open Folder':'Login'}</button><button class="opai-list-button" use:ripple disabled={!ready||busy} on:click={openAdd}>Add Account</button><button class="opai-list-button" use:ripple disabled={!ready||busy} on:click={()=>direct=true}>Direct Login</button><button class="opai-list-button" use:ripple disabled={!ready||busy} on:click={newFolder}>New Folder</button></div>
        <div><button class="opai-list-button" use:ripple disabled={busy||!chosenFolder} on:click={rename}>Rename</button><button class="opai-list-button" use:ripple disabled={busy||(!chosenFolder&&!chosenAccount)} on:click={requestDelete}>Delete</button><button class="opai-list-button" use:ripple disabled={busy} on:click={back}>Back</button></div>
    </div>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>
{#if drag}<div use:portal class="drag-ghost" style:left="{drag.x+12}px" style:top="{drag.y+12}px"><VectorIcon name="folder" size={16}/>{drag.label}</div>{/if}
<div class="login-notice"><Island noticeOnly {accountTypes} {accountNotice} bind:notifying={loginNotifying}/></div>
<AddAccount bind:visible={add}/><DirectLogin bind:visible={direct}/>
<Modal title={renaming?'Rename Folder':'New Folder'} bind:visible={editName}><form on:submit|preventDefault={submitName}><label>Folder name<input aria-label="Folder name" bind:value={name} maxlength="40" required/></label><button class="opai-list-button" disabled={busy} type="submit">Save Folder</button></form></Modal>
<Modal title="Delete {deleteTarget?.name??''}?" bind:visible={confirm}><p>{deleteTarget?.folder?'Only the folder is removed. Its accounts and subfolders move to the parent folder.':'This removes the selected account from the client.'}</p><button class="opai-list-button" disabled={busy} on:click={remove}>Delete</button></Modal>
<style lang="scss">
    @use './listScreen.scss';
    .row{touch-action:none;user-select:none}.row.drop-target{background:#ffb4aa38;outline:1px solid var(--accent-color)}.row.drop-before{box-shadow:0 -2px var(--accent-color)}.row.drop-after{box-shadow:0 2px var(--accent-color)}.row.drag-source{opacity:.4}.drag-ghost{position:fixed;z-index:2000001;pointer-events:none;display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:8px;background:#211b1af0;color:var(--accent-color);font-size:14px;box-shadow:0 3px 12px #0005}.login-notice{position:absolute;left:50%;top:0;transform:translateX(-50%);z-index:100;pointer-events:none;--opai-hud-shadow:0 0 4px 2px var(--hud-shadow-color)}.restore{position:absolute;top:10px;left:10px}.empty{text-align:center;font-size:10px;color:#b9b9b9;padding:20px 4px}.folder .detail{color:#ede0de}form,label{display:flex;flex-direction:column;gap:8px}input{font:inherit;color:#ede0de;background:#302827;border:1px solid #735954;border-radius:5px;padding:7px;width:100%;box-sizing:border-box}
</style>
