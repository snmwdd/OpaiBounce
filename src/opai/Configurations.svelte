<script lang="ts">
    import {onMount} from 'svelte';
    import {drag} from './drag';
    import {listen} from '../integration/ws';
    import Reveal from './Reveal.svelte';
    import {fly,fade} from 'svelte/transition';
    import {getGlobalSettings,setGlobalSettings} from '../integration/rest';
    import {setItem,persistentDataLoaded} from '../integration/persistent_storage';
    import type {ConfigurableSetting} from '../integration/types';
    import GenericSetting from '../routes/clickgui/setting/common/GenericSetting.svelte';
    import {ripple} from './motion';
    import VectorIcon from './VectorIcon.svelte';
    import {scaleFactor} from '../routes/clickgui/clickgui_store';
    import {type Profile,readProfiles,captureProfile,loadProfile,writeProfiles} from './profiles';
    let profiles: Profile[] = [], selected = '', input = '', page = 'Configurations', open = false, appearing = true, busy = false, message = '';
    let global: ConfigurableSetting | undefined;
    let popup:HTMLElement,x:number|undefined,y:number|undefined;
    function clampSavedPosition(){if(x!==undefined)x=Math.max(4,Math.min(window.innerWidth*2/$scaleFactor-308,x));if(y!==undefined)y=Math.max(4,Math.min(window.innerHeight*2/$scaleFactor-80,y));}
    $: $scaleFactor,clampSavedPosition();
    const dragging={
        scale:()=>$scaleFactor/2,
        get:()=>({x:x??window.innerWidth*2/$scaleFactor-312,y:y??window.innerHeight*2/$scaleFactor*.112-4}),
        move:(left:number,top:number)=>{x=Math.max(4,Math.min(window.innerWidth*2/$scaleFactor-308,left));y=Math.max(4,Math.min(window.innerHeight*2/$scaleFactor-80,top));},
        end:()=>{void setItem('opai.config.position',JSON.stringify({x,y}));}
    };
    let groupIndex=-1;
    $: group=global?.value[groupIndex] as ConfigurableSetting|undefined;
    const label=(name:string)=>name.replace(/([a-z])([A-Z])/g,'$1 $2');
    onMount(() => { persistentDataLoaded.then(() => {try{profiles=readProfiles();const saved=JSON.parse(localStorage.getItem('opai.config.position')??'null');if(Number.isFinite(saved?.x)&&Number.isFinite(saved?.y)){x=saved.x;y=saved.y;clampSavedPosition();}}catch{profiles=[];}}); });
    async function run(action:()=>Promise<void>) { if(busy)return;busy=true;message='';try{await action();}catch(e){message=e instanceof Error?e.message:String(e);}finally{busy=false;} }
    async function save(update = false) {
        await run(async () => {
            const name = (update ? selected : input).trim();
            if(!name || name.length>48) throw new Error('Use a name between 1 and 48 characters.');
            if(!update && profiles.some(p=>p.name===name)) throw new Error('That configuration already exists.');
            const snapshot=await captureProfile(name);
            profiles=[...profiles.filter(p=>p.name!==name),snapshot].sort((a,b)=>a.name.localeCompare(b.name));
            await writeProfiles(profiles);selected=name;page='Configurations';input='';message='Saved';
        });
    }
    async function load() {
        await run(async()=>{
            const snapshot=profiles.find(p=>p.name===selected);if(!snapshot)return;
            await loadProfile(snapshot);message='Loaded';
        });
    }
    async function remove() { await run(async()=>{profiles=profiles.filter(p=>p.name!==selected);selected='';await writeProfiles(profiles);}); }
    async function showSettings() { await run(async()=>{global=await getGlobalSettings();page='Settings';}); }
    async function saveGlobal() {if(global)await run(async()=>{await setGlobalSettings(global!);global=await getGlobalSettings();});}
</script>
<svelte:window on:resize={clampSavedPosition}/>
<div class="config-dock" style:--gui-scale={$scaleFactor}>
    <button class="chip" on:click={() => {appearing=true;open=!open;}} use:ripple>Configurations</button>
    {#if open}<section class="config-popup" data-motion-active={appearing} on:introend={()=>appearing=false} bind:this={popup} style:left={x===undefined?undefined:`${x}px`} style:top={y===undefined?undefined:`${y}px`} style:right={x===undefined?undefined:'auto'} in:fly={{duration:220,y:8}} out:fade={{duration:160}} aria-label="Configurations panel">
        <header use:drag={dragging}>{#if page!=='Configurations'}<button aria-label="Back to configurations" on:click={() => {page=groupIndex>=0?'Settings':'Configurations';groupIndex=-1;}}><VectorIcon name="back"/></button>{/if}<span>{page}</span>{#if page==='Configurations'}<button aria-label="Add configuration" on:click={() => page='Add'}><VectorIcon name="plus"/></button><button aria-label="Configuration settings" on:click={showSettings}><VectorIcon name="gear"/></button>{/if}<button aria-label="Close configurations" on:click={() => open=false}><VectorIcon name="close"/></button></header>
        <div class="config-body">
            {#key page}<div class="config-page" in:fly={{x:8,duration:180}}>
            {#if page==='Configurations'}
                <div class="profile-list">{#if !profiles.length}<div class="empty">No configurations</div>{/if}{#each profiles as profile}<button class:chosen={selected===profile.name} on:click={() => selected=profile.name} on:dblclick={load}>{profile.name}.json</button>{/each}</div>
                <div class="actions"><button disabled={!selected || busy} on:click={load}>Load</button><button disabled={!selected || busy} on:click={() => save(true)}>Update</button><button disabled={!selected || busy} on:click={remove}>Delete</button></div>
            {:else if page==='Add'}
                <label for="profile-name">Name</label><input id="profile-name" placeholder="Configuration name" bind:value={input} maxlength={48}/><button class="create" disabled={busy || !input.trim()} on:click={() => save()}>Create</button>
            {:else if page==='Settings' && global}
                {#each global.value as setting,i}
                    {#if setting.valueType==='CONFIGURABLE'||setting.valueType==='TOGGLEABLE'}<button class="setting-row" on:click={()=>{groupIndex=i;page=label(setting.name);}}>{label(setting.name)} <span class="forward"><VectorIcon name="back"/></span></button>
                    {:else}<GenericSetting path="opai.global" bind:setting={global.value[i]} on:change={saveGlobal}/>{/if}
                {/each}
                <button class="setting-row" on:click={() => page='Configurations'}>Configurations <span class="forward"><VectorIcon name="back"/></span></button>
            {:else if group && global}<div class="settings">{#each group.value as setting,i}<GenericSetting path="opai.global.{group.name}" bind:setting={group.value[i]} on:change={saveGlobal}/>{/each}</div>{/if}
            </div>{/key}
            {#if busy}<div class="message" role="status">Working…</div>{:else if message}<div class="message" role="status">{message}</div>{/if}
        </div>
    </section>{/if}
</div>
<style>
    .config-dock{position:absolute;inset:0;pointer-events:none;z-index:9999;font-family:'Google Sans','Opai CJK',sans-serif;color:var(--text-color)}button{font-family:inherit;cursor:pointer;border:0;color:inherit}.chip{position:absolute;right:0;top:calc(11.2% - 4px);pointer-events:auto;overflow:hidden;background:#131316;border-radius:8px 0 0 8px;font-size:14.5px;padding:4px 8px}.config-popup{position:absolute;right:8px;top:calc(11.2% - 4px);pointer-events:auto;width:304px;border-radius:14px;overflow:hidden;box-shadow:0 2px 15px #0004}header{height:42px;cursor:grab;touch-action:none;display:flex;align-items:center;gap:8px;padding:0 12px;background:#161110;font-size:18.4px}header>span{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}header button{display:grid;place-items:center;flex:none;width:24px;height:28px;padding:0;font-size:20px;background:none;border-radius:5px}header button:hover{background:#483a37}.config-page{min-width:0}.config-body{padding:6px 16px 12px;background:#1a1413ed;font-size:16.6px;max-height:min(650px,calc(80vh * 2 / var(--gui-scale)));overflow:auto}.profile-list{border-radius:16px;background:#2b2525;overflow:auto;max-height:240px}.profile-list button{display:block;width:100%;text-align:left;height:48px;padding:0 12px;font-size:16.6px;background:transparent}.profile-list button.chosen{background:var(--accent-color);color:#5f150f}.empty{padding:12px;color:#cdb7b4}.actions{display:flex;gap:5px;margin-top:6px}.actions button,.create{height:36px;border-radius:10px;flex:1;font-size:16px;background:#483a37;color:var(--accent-color)}button:disabled{opacity:.4;cursor:default}.config-body label{display:block;margin:5px 0}.config-body input{font-family:inherit;font-size:16.6px;border:0;border-bottom:2px solid var(--accent-color);color:var(--text-color);background:#2e2625;padding:10px;width:100%;border-radius:4px}.create{width:100%;margin-top:10px}.message{font-size:14px;color:var(--accent-color);margin-top:8px}.setting-row{display:block;width:100%;text-align:left;background:none;height:40px;font-size:16.6px}.setting-row span{float:right}.forward{transform:rotate(180deg)}@keyframes open{from{opacity:0;transform:scale(.95);transform-origin:top right}to{opacity:1;transform:scale(1)}}
</style>
