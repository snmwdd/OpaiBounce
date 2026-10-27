<script lang="ts">
    import {onMount,createEventDispatcher,tick} from 'svelte';
    import {fly,fade} from 'svelte/transition';
    import {getModules,getModuleSettings,setModuleSettings,setModuleEnabled,browsePath,getClientInfo,getMinecraftKeybinds} from '../integration/rest';
    import {listen} from '../integration/ws';
    import type {Module,BindSetting,BooleanSetting} from '../integration/types';
    import {persistentDataLoaded} from '../integration/persistent_storage';
    import {loadProfile,readProfiles,type Profile} from './profiles';
    import {keyboard,keyboardCode} from './keyboard';
    import {convertToSpacedString} from '../theme/theme_config';
    import {highlightModuleName} from '../routes/clickgui/clickgui_store';
    import CommandIcon from './CommandIcon.svelte';
    import VectorIcon from './VectorIcon.svelte';
    export let maxWidth=1000,maxHeight=600;
    export function focusSearch(){if(!binding)search?.focus({preventScroll:true});}
    function focusInput(node:HTMLInputElement){let alive=true;queueMicrotask(()=>{if(alive)node.focus({preventScroll:true});});const timer=setTimeout(()=>{if(alive&&!binding)node.focus({preventScroll:true});},80);return{destroy(){alive=false;clearTimeout(timer);}};}
    const dispatch=createEventDispatcher();
    type Command={id:string;label:string;run:()=>Promise<void>};
    let modules:Module[]=[],profiles:Profile[]=[],query='',selected=0,busy=false,loading=true,message='',binding:Module|undefined;
    let used=new Set<string>();
    let gameKeys:string[]=[];
    let search:HTMLInputElement,list:HTMLDivElement,scroll={query:'',top:0};
    function scrollResults(event:Event){const node=event.currentTarget as HTMLDivElement|null;if(node)scroll={query,top:node.scrollTop};}
    function mountList(node:HTMLDivElement){queueMicrotask(()=>{if(node.isConnected)node.scrollTop=scroll.query===query?scroll.top:0;});}
    const rowHeight=44;
    $: first=Math.max(0,Math.min(Math.floor((scroll.query===query?scroll.top:0)/rowHeight)-3,results.length-1));
    $: last=Math.min(results.length,first+Math.ceil(Math.min(400,maxHeight-60)/rowHeight)+7);
    $: windowed=results.slice(first,last);

    const label=(m:Module)=>convertToSpacedString(m.name);
    let commands:Command[]=[];
    $: commands=[{id:'directory',label:'Open Config Directory',run:async()=>{const info=await getClientInfo();await browsePath(`${info.clientDir}/configs`);}},
        ...profiles.map(profile=>({id:`profile:${profile.name}`,label:`Load ${profile.name}.json`,run:()=>loadProfile(profile)})),
        ...modules.flatMap(m=>[
            ...(['Enable','Disable','Toggle'] as const).map(action=>({id:`${action}:${m.name}`,label:`${action} ${label(m)}`,run:async()=>{const current=(await getModules()).find(item=>item.name===m.name);if(!current)throw new Error('Module no longer available');const enabled=action==='Toggle'?!current.enabled:action==='Enable';if(current.enabled!==enabled)await setModuleEnabled(m.name,enabled);await refreshModules();}})),
            ...(['Hide','Reveal'] as const).map(action=>({id:`${action}:${m.name}`,label:`${action} ${label(m)}`,run:async()=>{const settings=await getModuleSettings(m.name),hidden=settings.value.find(s=>s.name==='Hidden') as BooleanSetting|undefined;if(!hidden)throw new Error('This module has no visibility setting');hidden.value=action==='Hide';await setModuleSettings(m.name,settings);await refreshModules();}})),
            {id:`show:${m.name}`,label:`Show ${label(m)}`,run:async()=>{highlightModuleName.set(m.name);dispatch('show');}},
            {id:`bind:${m.name}`,label:`Bind for ${label(m)}`,run:async()=>{binding=m;message='';}}
        ])];
    $: results=commands.filter(command=>query.toLowerCase().trim().split(/\s+/).every(part=>command.label.toLowerCase().replace(/\s/g,'').includes(part.replace(/\s/g,''))));
    function resetSearch(text:string){selected=0;if(list)list.scrollTop=0;}
    $: resetSearch(query);
    $: used=new Set([...gameKeys,...modules.map(m=>m.keyBind?.boundKey)].filter((key):key is string=>!!key&&key!=='key.keyboard.unknown'));
    async function refreshModules(){modules=await getModules();}
    onMount(()=>{
        let alive=true;
        void (async()=>{try{await persistentDataLoaded;await refreshModules();if(!alive)return;profiles=readProfiles();const keys=await getMinecraftKeybinds();if(alive)gameKeys=keys.map(k=>k.key.translationKey);}catch(e){if(alive)message=String(e);}finally{if(alive)loading=false;}})();
        search?.focus();
        return()=>{alive=false;};
    });
    async function execute(command:Command|undefined){if(!command||busy)return;busy=true;message='';try{await command.run();}catch(e){message=e instanceof Error?e.message:String(e);}finally{busy=false;}}
    async function bind(key:string){
        if(!binding||busy)return;busy=true;message='';
        try{const settings=await getModuleSettings(binding.name),setting=settings.value.find(s=>s.valueType==='BIND') as BindSetting|undefined;
            if(!setting)throw new Error('This module has no key binding');
            setting.value={...setting.value,boundKey:key,modifiers:[]};await setModuleSettings(binding.name,settings);
            await refreshModules();message=`${label(binding)} bound to ${key.replace('key.keyboard.','')}`;binding=undefined;await tick();search?.focus();
        }catch(e){message=e instanceof Error?e.message:String(e);}finally{busy=false;}
    }
    function escape(){if(binding){binding=undefined;tick().then(()=>search?.focus());}else dispatch('close');}
    function domKey(event:KeyboardEvent){
        if(event.repeat)return;
        if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();escape();return;}
        if(binding){event.preventDefault();const key=keyboardCode(event.code);if(key)void bind(key);return;}
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();selected=Math.max(0,Math.min(results.length-1,selected+(event.key==='ArrowDown'?1:-1)));if(list){const top=selected*rowHeight;if(top<list.scrollTop)list.scrollTop=top;else if(top+rowHeight>list.scrollTop+list.clientHeight)list.scrollTop=top+rowHeight-list.clientHeight;scroll={query,top:list.scrollTop};}}
        else if(event.key==='Enter'){event.preventDefault();void execute(results[selected]);}
    }
    // CEF normally sends DOM keys, but some Windows builds only forward native events while binding.
    listen('keyboardKey',e=>{if(binding&&e.action===1){if(e.key==='key.keyboard.escape')escape();else void bind(e.key);}});
    function capture(node:HTMLElement){window.addEventListener('keydown',domKey,true);return{destroy(){window.removeEventListener('keydown',domKey,true);}};}
</script>
<section class="command-palette" aria-label="Command palette" use:capture style:max-width="{maxWidth}px" style:max-height="{maxHeight}px">
    {#key binding?.name??'commands'}<div class="palette-page" in:fly={{duration:180,x:8}}>
    {#if binding}
        <div class="keyboard-title"><span title="Bind for {label(binding)}">Press or Click a Key to bind</span><div class="keyboard-tools"><button class="unbind" disabled={busy} on:click={()=>bind('key.keyboard.unknown')}>Clear binding</button><button aria-label="Back to commands" on:click={()=>{binding=undefined;tick().then(()=>search?.focus());}}><VectorIcon name="back"/></button></div></div>
        <div class="virtual-keyboard" aria-label="Key binding keyboard">
            {#each keyboard as row}<div class="keyboard-row">{#each row as key}<button class="keyboard-key" class:bound={used.has(key.key)} disabled={busy} style:flex={key.units} aria-label="Bind {key.label}" aria-pressed={used.has(key.key)} on:click={()=>bind(key.key)}>{key.label}</button>{/each}</div>{/each}
        </div>
    {:else}
        <div class="search-row"><input use:focusInput bind:this={search} bind:value={query} aria-label="Search commands" placeholder="Search commands…" autocomplete="off" spellcheck="false"/><button aria-label="Close commands" on:click={()=>dispatch('close')}><VectorIcon name="close" size={14}/></button></div>
        <div class="command-results" use:mountList bind:this={list} role="listbox" aria-label="Commands" aria-busy={busy||loading} style:min-height={loading?`${Math.min(400,maxHeight-65)}px`:undefined} style:max-height="{Math.min(400,maxHeight-65)}px" on:scroll={scrollResults}>
            <div class="command-spacer" style:height="{first*rowHeight}px" aria-hidden="true"></div>
            {#each windowed as command,i (command.id)}<button class="command-row" class:selected={selected===first+i} data-index={first+i} aria-posinset={first+i+1} aria-setsize={results.length} role="option" aria-selected={selected===first+i} disabled={busy} on:mouseenter={()=>selected=first+i} on:click={()=>execute(command)}><CommandIcon name={command.id.split(':')[0]}/><span>{command.label}</span></button>{/each}
            <div class="command-spacer" style:height="{(results.length-last)*rowHeight}px" aria-hidden="true"></div>
            {#if loading}<div class="palette-loading" role="status">Loading commands…</div>{/if}
            {#if !loading&&!results.length}<div class="no-results">No matching commands</div>{/if}
        </div>
    {/if}
    </div>{/key}
    {#if message}<div class="palette-message" role="status">{message}</div>{/if}
</section>
<style>
.command-palette{position:relative;width:560px;padding:5px;border-radius:12px;background:transparent;color:#ede0de;font:18px 'Google Sans','Opai CJK',sans-serif;pointer-events:auto;overflow:auto}.command-palette:has(.virtual-keyboard){width:930px}.search-row{display:flex;gap:5px;align-items:center}.search-row input{width:100%;min-width:0;height:40px;border:1px solid var(--accent-color);border-radius:5px;background:#121113;color:#ede0de;font:inherit;padding:0 10px;outline:0}.search-row>button,.keyboard-title button{display:grid;place-items:center;width:30px;height:32px;flex:none;border:0;background:none;color:inherit;cursor:pointer}.command-results{max-height:400px;overflow:auto;overscroll-behavior:contain}.command-row{display:flex;align-items:center;gap:10px;width:100%;height:44px;min-height:44px;padding:8px 10px;white-space:nowrap;text-align:left;background:transparent;color:inherit;border:0;border-radius:6px;font:inherit;cursor:pointer;transition:background-color 110ms}.command-row>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis}.command-spacer{width:1px;pointer-events:none}.palette-loading{padding:8px 12px;color:#cdb7b4;font-size:13px}.command-row.selected{background:#59423b55}.no-results{padding:30px 10px;text-align:center;color:#cdb7b4}.keyboard-title{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 7px 6px;font-size:20px;min-height:38px}.keyboard-title>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.keyboard-tools{display:flex;align-items:center;gap:8px}.keyboard-tools .unbind{width:auto;font:11px 'Google Sans','Opai CJK',sans-serif;color:#cdb7b4;padding:0 4px}.virtual-keyboard{container-type:inline-size}.keyboard-row{display:flex;gap:clamp(2px,.65cqw,6px);margin-bottom:clamp(2px,.65cqw,6px)}.keyboard-row:last-child{margin-bottom:0}.keyboard-key{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;height:clamp(22px,5.9cqw,54px);border:0;border-radius:clamp(4px,1.1cqw,10px);padding:0 2px;color:#f2eeeb;background:#484449cc;font:clamp(9px,2.18cqw,20px) 'Google Sans','Opai CJK',sans-serif;cursor:pointer;transition:background-color 120ms,transform 120ms}.keyboard-key.bound{background:#005a0bb0}.keyboard-key:hover{background:#76615b}.keyboard-key:active{transform:scale(.93)}.palette-message{padding:8px 10px;color:var(--accent-color);font-size:12px}button:disabled{opacity:.55;cursor:wait}
</style>
