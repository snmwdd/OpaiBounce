<script lang="ts">
    import {onMount} from 'svelte';
    import {listenAlways} from '../integration/ws';
    import {putPersistentStorageItem} from '../integration/rest';
    import {summarizeFrames} from './frameStats';
    let opened=false,gameFps=0,longTasks=0,paintProbe='normal',pauseScript=false;
    let probeTimer:ReturnType<typeof setInterval>;
    const probeKeys=new Map<string,number>();
    function probeKeyAction(key:string){if(!opened)return;const now=performance.now();if(now-(probeKeys.get(key)??-Infinity)<180)return;probeKeys.set(key,now);if(key==='F6'){const modes=['normal','shadows','hud'];setPaintProbe(modes[(modes.indexOf(paintProbe)+1)%3]);}else if(key==='F7')scriptProbe(!pauseScript);}
    const probeKey='opai.bridge.renderProbe';
    function setPaintProbe(value:string){paintProbe=value;document.documentElement.dataset.opaiPaintProbe=value;}
    function scriptProbe(value:boolean){pauseScript=value;clearInterval(probeTimer);const write=()=>void putPersistentStorageItem(probeKey,JSON.stringify({protocol:1,paused:value,at:Date.now()})).catch(()=>{});write();if(value)probeTimer=setInterval(write,500);}
    let stats=summarizeFrames([]);
    let toggle=()=>{},close=()=>{};
    onMount(()=>{
        let frame=0,last=0,started=0,samples:number[]=[],observer:PerformanceObserver|undefined,lastToggle=-Infinity;
        function stop(){if(pauseScript)scriptProbe(false);clearInterval(probeTimer);setPaintProbe('normal');opened=false;cancelAnimationFrame(frame);frame=0;observer?.disconnect();observer=undefined;}
        function draw(now:number){
            if(!opened)return;
            if(last)samples.push(now-last);last=now;
            if(now-started>=1000){stats=summarizeFrames(samples);samples=[];started=now;}
            frame=requestAnimationFrame(draw);
        }
        toggle=()=>{
            const now=performance.now();if(now-lastToggle<180)return;lastToggle=now;
            if(opened){stop();return;}
            opened=true;last=0;started=now;samples=[];longTasks=0;stats=summarizeFrames([]);
            if(PerformanceObserver.supportedEntryTypes.includes('longtask')){observer=new PerformanceObserver(entries=>longTasks+=entries.getEntries().length);observer.observe({type:'longtask'});}
            frame=requestAnimationFrame(draw);
        };
        close=stop;
        function key(event:KeyboardEvent){if(event.ctrlKey&&event.shiftKey&&!event.repeat){if(event.code==='F8'){event.preventDefault();toggle();}else if(opened&&['F6','F7'].includes(event.code)){event.preventDefault();probeKeyAction(event.code);}}}
        document.addEventListener('keydown',key);
        const offKey=listenAlways('keyboardKey',e=>{if(e.action!==1||(e.mods&3)!==3)return;if(e.key==='key.keyboard.f8'||e.keyCode===297)toggle();else if(e.key==='key.keyboard.f6'||e.keyCode===295)probeKeyAction('F6');else if(e.key==='key.keyboard.f7'||e.keyCode===296)probeKeyAction('F7');});
        const offFps=listenAlways('fps',e=>gameFps=e.fps);
        function visibility(){last=0;samples=[];started=performance.now();}
        document.addEventListener('visibilitychange',visibility);
        return()=>{stop();offKey();offFps();document.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',visibility);};
    });
</script>
{#if opened}
<aside class="frame-diagnostics" aria-label="Animation diagnostics"><header><strong>Animation diagnostics</strong><button type="button" aria-label="Close animation diagnostics" on:click={close}>×</button></header><dl><dt>Game FPS</dt><dd>{gameFps}</dd><dt>WebGUI RAF</dt><dd>{stats.rafHz.toFixed(1)} Hz</dd><dt>P95 interval</dt><dd>{stats.p95Ms.toFixed(1)} ms</dd><dt>Gaps &gt;25 ms</dt><dd>{stats.gapsOver25Ms}</dd><dt>Long tasks &gt;50 ms</dt><dd>{longTasks}</dd></dl><div class="probes"><label>网页对照<select aria-label="网页绘制对照" value={paintProbe} on:change={e=>setPaintProbe(e.currentTarget.value)}><option value="normal">正常显示</option><option value="shadows">关阴影 / 滤镜</option><option value="hud">隐藏网页 HUD</option></select></label><label><input aria-label="暂停脚本绘制" type="checkbox" checked={pauseScript} on:change={e=>scriptProbe(e.currentTarget.checked)}/>暂停脚本绘制</label><small>逐项切换并看 Game FPS；关闭此面板会恢复。Ctrl+Shift+F6 切换网页，F7 切换脚本（需 Bridge 1.4.2）。</small></div><p>RAF sampling; CEF texture presentation is not measured.</p><footer>Ctrl + Shift + F8</footer></aside>
{/if}
<style>.frame-diagnostics{position:fixed;right:12px;top:12px;width:255px;padding:12px;z-index:100010;border:1px solid #483a37;border-radius:10px;background:#171312f5;color:#ede0de;font:12px 'Google Sans','Opai CJK',sans-serif;box-shadow:0 4px 16px #0005}.probes{display:grid;gap:6px;font-size:11px}.probes label{display:flex;align-items:center;justify-content:space-between;gap:6px}.probes select{max-width:140px;background:#2e2625;color:#ede0de;border:1px solid #483a37;border-radius:4px;font:inherit}.probes small{color:#cdb7b4;font-size:10px;line-height:14px}header{display:flex;align-items:center;justify-content:space-between;gap:8px}button{background:none;border:0;color:var(--accent-color);font:20px 'Google Sans','Opai CJK',sans-serif;cursor:pointer;width:24px;height:24px}dl{display:grid;grid-template-columns:1fr auto;gap:6px;margin:10px 0}dd{color:var(--accent-color)}p,footer{color:#cdb7b4;font-size:10px;line-height:14px}footer{margin-top:8px}</style>
