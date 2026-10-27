<script lang="ts">
    import {musicViewState as musicState,musicCurrentLyric,musicWidgets,musicActive} from './music';
    import MusicIcon from './MusicIcon.svelte';
    import {prefersReducedMotion} from './motionPlatform';
    import {requestMotionFrame,cancelMotionFrame} from './animation';
    import {onMount,tick} from 'svelte';
    import {getClientInfo,getSession,getModules,getMinecraftKeybinds} from '../integration/rest';
    import {listen} from '../integration/ws';
    import {convertToSpacedString,spaceSeperatedNames} from '../theme/theme_config';
    import {paletteSession} from './paletteIntent';
    import {Morph} from './motion';
    import {latencyColor} from './latency';
    import {bridgeState} from './scriptBridge';
    import Icon from './Icon.svelte';
    import {BlockStats} from './blockStats';
    import IslandNoticeIcon from './IslandNoticeIcon.svelte';
    import type {AccountNotice} from './accountNotice';
    import {islandActivity,type ContainerActivity} from './islandActivity';
    import ChestIsland from './ChestIsland.svelte';
    export let noticeOnly=false;
    export let accountTypes:Record<string,string>={};
    export let accountNotice:AccountNotice|null=null;
    let lastAccountNotice:AccountNotice|null=null;
    $: if(accountNotice&&accountNotice!==lastAccountNotice){lastAccountNotice=accountNotice;post('Alt Manager',accountNotice.text,'',accountNotice.kind!=='warning',2600,accountNotice.kind,'account-manager');}
    export let notifying=false;
    let username = 'Player', fps = 0,sessionRevision=0;
    $: server=$bridgeState?.inWorld?($bridgeState.serverAddress??($bridgeState.singleplayer?'singleplayer':'Minecraft')):'Minecraft';
    type Notice = {key:string;title:string;detail:string;status:string;enabled:boolean;deadline:number;kind:'toggle'|'success'|'warning'|'info'};
    let notices:Notice[] = [];
    const blocks=new BlockStats();
    let scaffoldEnabled=false,scaffoldEventSeen=false,awaitingBlocks=false,count:number|null=null,maximum=0,progress=0,rate=0;
    let playerListHeld=false,playerListKey='key.keyboard.tab',scaffoldContent:HTMLDivElement;
    let lastContainer:ContainerActivity|null=null;
    let breakingContent:HTMLDivElement,chestContent:HTMLDivElement;
    $: if($islandActivity?.container)lastContainer=$islandActivity.container;
    $: breaking=noticeOnly?null:$islandActivity?.breaking;
    $: kind=!noticeOnly&&$islandActivity?.container?'chest':breaking?'breaking':notices.length?'notice':!noticeOnly&&scaffoldEnabled&&(count!==null||awaitingBlocks)?'scaffold':'idle';
    $: scaffoldVisible=kind==='scaffold';
    $: breakingVisible=kind==='breaking';
    $: chestVisible=kind==='chest';
    $: musicVisible=$musicActive&&!!$musicState?.track&&$musicWidgets.island;
    $: musicLine=($musicWidgets.islandLyrics?$musicCurrentLyric:'')||$musicState?.track?.name||'';
    $: hasNotice=kind!=='idle';
    function resetBlocks(){blocks.reset();awaitingBlocks=false;count=null;maximum=0;progress=0;rate=0;}
    function playerListInput(key:string,action:number){if(key===playerListKey)playerListHeld=action!==0;}
    function domPlayerList(event:KeyboardEvent){if(event.code==='Tab'&&playerListKey==='key.keyboard.tab'){playerListHeld=event.type==='keydown';}}
    async function updatePlayerListKey(){try{const binds=await getMinecraftKeybinds();playerListKey=binds.find(b=>b.bindName==='key.playerlist')?.key.translationKey??'key.keyboard.tab';}catch{}}
    listen('key',e=>playerListInput(e.key,e.action));
    listen('keyboardKey',e=>playerListInput(e.key,e.action));
    listen('keybindChange',()=>{playerListHeld=false;void updatePlayerListKey();});
    listen('blockCountChange',e=>{
        awaitingBlocks=false;
        if(e.count==null){resetBlocks();return;}
        blocks.update(e.count);count=blocks.count;maximum=blocks.maximum;progress=blocks.progress;rate=blocks.rate();
    });
    let box:HTMLDivElement,ink:HTMLDivElement,idleContent:HTMLDivElement,noticeContent:HTMLDivElement;
    let available=400;
    let layoutWidth=215,layoutHeight=23;
    let width = 215, height = 23;
    const w = new Morph(), h = new Morph();
    $: notifying=hasNotice||animating||height!==23;
    let wasIdle = true, animating = false,previousKind='idle';
    let refresh = () => {};
    $: notices, kind, breaking?.name, lastContainer?.rows, musicVisible, musicLine, refresh();
    function post(title: string, text: string, state = '', on = true, duration = 800,kind:Notice['kind']='toggle',key=title) {
        const item = {key,title,detail:text,status:state,enabled:on,kind,deadline:performance.now()+duration};
        const existing = notices.findIndex(n=>n.key===key);
        notices = existing < 0 ? [...notices,item].slice(-3) : notices.map((n,i)=>i===existing?item:n);
    }
    listen('fps', e => fps = e.fps);
    listen('session', e => {sessionRevision++;username=e.session.username;});
    listen('accountManagerLogin',e=>{
        if(e.error){post('Alt Manager',e.error,'',false,3000,'warning','account-manager');return;}
        if(!e.username)return;
        sessionRevision++;username=e.username;
        const type=accountTypes[e.username.toLowerCase()];
        post('Alt Manager',`Successfully login as ${e.username}${type?' ('+type+')':''}`,'',true,2600,'success','account-manager');
    });
    listen('disconnect', () => {resetBlocks();scaffoldEnabled=false;playerListHeld=false;bridgeState.set(null);sessionStorage.removeItem('opai.server');});
    listen('moduleToggle', e => {
        if(noticeOnly||e.moduleName==='TritiumMusic')return;
        if(e.moduleName==='Scaffold') {scaffoldEventSeen=true;scaffoldEnabled=e.enabled;awaitingBlocks=e.enabled&&count===null;if(!e.enabled)resetBlocks();return;}
        post('Module Toggled', `${$spaceSeperatedNames?convertToSpacedString(e.moduleName):e.moduleName} has been `, e.enabled ? 'Enabled' : 'Disabled', e.enabled,800,'toggle',`module:${e.moduleName}`);
    });
    listen('notification', e => {
        if(noticeOnly)return;
        if(e.severity === 'ENABLED' || e.severity === 'DISABLED') return;
        post(e.title,e.message,'',e.severity !== 'ERROR',3000,e.severity==='ERROR'?'warning':e.severity==='SUCCESS'?'success':'info');
    });
    onMount(() => {
        if(!noticeOnly){
        getClientInfo().then(c => {fps = c.fps;}).catch(() => {});
        const initialRevision=sessionRevision;getSession().then(s => {if(sessionRevision===initialRevision)username=s.username;}).catch(() => {});
        void updatePlayerListKey();
        getModules().then(modules=>{if(alive&&!scaffoldEventSeen)scaffoldEnabled=modules.some(m=>m.name==='Scaffold'&&m.enabled);}).catch(()=>{});
        }
        const consumptionTimer=setInterval(()=>{if(scaffoldEnabled&&count!==null)rate=blocks.rate();},250);
        let frame = 0, expiry: ReturnType<typeof setTimeout>;
        let targetWidth = 215, targetHeight = 23, impulse = 0, alive = true;
        function render(){
            const sx=Math.max(.01,width/layoutWidth),sy=Math.max(.01,height/layoutHeight);
            // Scale only the shell. Counter-scale the ink so icons and text retain their size.
            box.style.transform=`translate3d(${(layoutWidth-width)/2}px,0,0) scale(${sx},${sy})`;
            ink.style.transform=`scale(${1/sx},${1/sy})`;
        }
        function animate(now: number) {
            frame = 0;
            width = Math.max(1,Math.min(available,w.value(targetWidth,now,prefersReducedMotion(),impulse)));
            height = h.value(targetHeight,now,prefersReducedMotion(),impulse);
            impulse = 0;render();
            animating = !w.settled || !h.settled;
            if(animating) frame = requestMotionFrame(animate);
        }
        function measure() {
            const idle = !hasNotice;
            impulse = idle!==wasIdle||kind!==previousKind ? (idle?5.5:7.25) : 0;
            wasIdle = idle;previousKind=kind;
            targetWidth = Math.min(available,idle?idleContent.scrollWidth+21.5:chestVisible?190:breakingVisible?breakingContent.scrollWidth:scaffoldVisible?scaffoldContent.scrollWidth:noticeContent.scrollWidth);
            targetHeight = idle ? 23 : chestVisible?(lastContainer?.rows??3)*20+12:breakingVisible?48:scaffoldVisible?50:notices.length*36;
            layoutWidth=targetWidth;layoutHeight=targetHeight;render();
            if(!frame) frame = requestMotionFrame(animate);
        }
        const observer = new ResizeObserver(measure);
        observer.observe(idleContent);observer.observe(noticeContent);observer.observe(scaffoldContent);observer.observe(breakingContent);observer.observe(chestContent);
        function resize(){const parent=box.parentElement!;const ratio=parent.getBoundingClientRect().width/parent.offsetWidth||2;available=Math.max(80,Math.min(400,innerWidth/ratio-16));measure();}
        window.addEventListener('resize',resize);resize();
        refresh = () => {
            clearTimeout(expiry);
            if(notices.length) expiry = setTimeout(() => {
                const now=performance.now();
                notices=notices.filter(n=>n.deadline>now);
            },Math.max(1,Math.min(...notices.map(n=>n.deadline))-performance.now()));
            tick().then(()=>{if(alive)measure();});
        };
        refresh();
        return () => { alive=false;refresh=()=>{};observer.disconnect();window.removeEventListener('resize',resize);cancelMotionFrame(frame);clearTimeout(expiry);clearInterval(consumptionTimer); };
    });
</script>
<svelte:window on:keydown={domPlayerList} on:keyup={domPlayerList} on:blur={()=>playerListHeld=false}/>
<div class="island-visibility" class:palette-suspended={$paletteSession?.phase==='ready'||$paletteSession?.phase==='closing'} class:player-list-hidden={playerListHeld} class:notice-only-hidden={noticeOnly&&!hasNotice&&!animating&&height===23} aria-hidden={playerListHeld||(noticeOnly&&!hasNotice&&!animating&&height===23)}>
<div class="island" class:notice={hasNotice} data-motion-active={animating} bind:this={box} style:width="{layoutWidth}px" style:height="{layoutHeight}px" role="status">
    <div class="island-ink" bind:this={ink}>
    <div class="idle-content" class:hidden={hasNotice} bind:this={idleContent} style:max-width="{available-21.5}px">
        <span class="brand"><Icon name="logo" size={12}/>Opai</span><span>·</span><span class="user"><Icon name="user" size={12}/><span class="username">{username}</span></span><span>·</span>{#if musicVisible}<span class="music-island"><MusicIcon name="note" size={12}/><span class="music-lyric">{musicLine}</span></span>{:else}<span class="network">{#if $bridgeState?.ping!=null}<span class="latency" style:color={latencyColor($bridgeState.ping)}><Icon name="server" size={12}/><span class="ping">{$bridgeState.ping} ms</span></span><span class="to">to</span>{:else}<Icon name="server" size={12}/>{/if}<span class="connection" title={$bridgeState?.serverIP??server}>{server}</span></span><span>·</span><span class="fps"><Icon name="frame" size={12}/>{fps} fps</span>{/if}
    </div>
    <div class="notice-content" aria-hidden={kind!=='notice'} class:content-hidden={kind!=='notice'} bind:this={noticeContent}>
        {#each notices as n (n.key)}<div class="notice-row" class:account-success={n.key==='account-manager'&&n.kind==='success'}><IslandNoticeIcon kind={n.kind} enabled={n.enabled}/><div class="notice-text" style:max-width="{available-41.5}px"><div class="title">{n.title}</div><div class="detail"><span class="prefix">{n.detail}</span><span class="status" class:off={!n.enabled}>{n.status}</span>{#if n.kind==='toggle'}<span class="punctuation">!</span>{/if}</div></div></div>{/each}
    </div>
    <div class="breaking-content" aria-hidden={!breakingVisible} class:content-hidden={!breakingVisible} bind:this={breakingContent} style:max-width="{available}px">
        <div class="breaking-row"><div class="bed-tile"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2 4H4V14H22V20H20V17H4V20H2ZM5 8A2.5 2.5 0 1 0 10 8A2.5 2.5 0 1 0 5 8M11 6H18C20.2 6 22 7.8 22 10V13H11Z"/></svg></div><div class="breaking-text"><div class="breaking-title">Breaking {breaking?.name??''}</div><div class="breaking-detail">Break Progress: {Math.floor((breaking?.progress??0)*100+.0001)}%</div><div class="breaking-measure" aria-hidden="true">Break Progress: 100%</div></div></div>
        <div class="breaking-bar" role="progressbar" aria-label="Block breaking progress" aria-valuenow={Math.floor((breaking?.progress??0)*100+.0001)} aria-valuemin={0} aria-valuemax={100}><span style:transform="scaleX({breaking?.progress??0})"></span></div>
    </div>
    <div class="chest-content" class:content-hidden={!chestVisible} aria-hidden={!chestVisible} bind:this={chestContent}>{#if chestVisible}<ChestIsland container={lastContainer}/>{/if}</div>
    <div class="scaffold-content" aria-hidden={!scaffoldVisible} class:content-hidden={!scaffoldVisible} bind:this={scaffoldContent} style:max-width="{available}px">
        <div class="scaffold-row"><div class="cube-tile"><svg viewBox="0 0 28 28" aria-hidden="true"><!-- DynamicIslandPainter.drawCube from supplied Opai source --><path d="M14 7L20.3 10.5L14 14L7.7 10.5L14 7M7.7 10.5V17.5L14 21L20.3 17.5V10.5M14 14V21" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg></div><div class="scaffold-text"><div class="title">Scaffold Toggled</div><div class="detail">{#if awaitingBlocks}Waiting for block count…{:else}{count??0} blocks left - {rate.toFixed(1)} block/s{/if}</div></div></div>
        <div class="block-progress" role="progressbar" aria-label="Remaining blocks" aria-valuenow={count??0} aria-valuemin={0} aria-valuemax={maximum}><span style:transform="scaleX({progress})"></span></div>
    </div>

    </div>
</div>
</div>
<style>
.breaking-content{position:absolute;left:0;top:0;width:max-content;height:48px;transition:opacity 160ms}.breaking-row{display:flex;align-items:center;height:34px;padding:0 8px 0 4px;gap:5px}.bed-tile{width:27px;height:27px;flex:none;display:grid;place-items:center;border-radius:7px;background:#141616c8;color:var(--accent-color)}.bed-tile svg{width:20px;height:20px}.breaking-text{position:relative;min-width:0;white-space:nowrap}.breaking-title{font-size:9px;line-height:12px;color:var(--accent-color)}.breaking-detail,.breaking-measure{font-size:8px;line-height:12px;color:#fff}.breaking-measure{height:0;visibility:hidden}.breaking-bar{position:absolute;left:4px;right:4px;top:35px;height:7.5px;border-radius:4px;background:#34343d70;overflow:hidden}.breaking-bar span{display:block;width:100%;height:100%;border-radius:inherit;background:var(--accent-color);transform-origin:left center;transition:transform 120ms linear}.chest-content{position:absolute;top:0;left:0;padding:6px 5px;width:190px;box-sizing:border-box;transition:opacity 160ms}.music-island{display:flex;align-items:center;gap:4px;min-width:0;color:#99ed32}.music-lyric{max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e4e1e6}

.island-visibility.notice-only-hidden{visibility:hidden;pointer-events:none}.island-visibility{transition:opacity 150ms,transform 180ms;transform-origin:top center}.island-visibility.palette-suspended{visibility:hidden;pointer-events:none}.island-visibility.player-list-hidden{opacity:0;transform:translateY(-5px) scale(.96);pointer-events:none}.content-hidden{opacity:0;pointer-events:none}.scaffold-content{position:absolute;left:0;top:0;width:max-content;min-width:0;height:50px;transition:opacity 160ms}.scaffold-row{display:flex;align-items:center;height:36px;padding:0 7px 0 4px;gap:6px}.cube-tile{width:28px;height:28px;flex:none;background:#141616c8;border-radius:7px;color:var(--accent-color)}.cube-tile svg{display:block;width:100%;height:100%}.scaffold-text{min-width:0}.scaffold-text .title{color:var(--accent-color)}.block-progress{position:absolute;left:4px;right:4px;top:37px;height:8px;background:#343636;border-radius:4px;overflow:hidden}.block-progress span{display:block;width:100%;height:100%;background:var(--accent-color);border-radius:inherit;transform-origin:left center;transition:transform 220ms cubic-bezier(.2,.7,.2,1)}.island{position:relative;transform-origin:top left;contain:layout style;background:#080808b0;box-shadow:var(--opai-hud-shadow);border-radius:23px;overflow:hidden;color:#e4e1e6;transition:border-radius 250ms;font:8px 'Google Sans','Opai CJK',sans-serif;min-height:23px}.island[data-motion-active=true],.island[data-motion-active=true] .island-ink{will-change:transform}.island-ink{position:absolute;inset:0;transform-origin:top left}.island.notice{border-radius:8.5px}.idle-content{display:flex;width:max-content;min-width:0;align-items:center;gap:3.5px;position:absolute;left:9px;top:0;height:23px;white-space:nowrap;transition:opacity 160ms}.idle-content.hidden{opacity:0;pointer-events:none}.brand,.user,.network,.latency,.fps{display:flex;align-items:center;gap:3.5px;min-width:0}.brand,.fps{flex:none}.brand{color:var(--accent-color)}.latency,.to{flex:none}.latency{gap:1px;transition:color 200ms linear}.username,.connection{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.notice-content{position:absolute;left:0;top:0;width:max-content}.notice-row{display:flex;align-items:flex-start;height:36px;min-height:36px;animation:appear 160ms ease-out}.account-success .title{color:#a0e7cd}.account-success :global(.notice-icon rect){fill:#00543b}.account-success :global(.notice-icon path){stroke:#b6f5d9}.notice-text{min-width:0;padding:6.5px 5.5px 0 0}.title{font-size:10px;line-height:13px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.detail{display:flex;white-space:pre;font-size:9px;line-height:11.5px;color:#fff}.prefix{min-width:0;overflow:hidden;text-overflow:ellipsis}.status{flex:none;color:#5f5}.status.off{color:#f55}@keyframes appear{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}
</style>
