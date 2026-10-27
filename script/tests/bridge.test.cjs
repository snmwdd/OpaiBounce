const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../OpaiBounceScript.js'),'utf8');
const exportsModule={exports:{}};
new Function('module',source)(exportsModule);
const core=exportsModule.exports;
function host(arity=9,musicSupport=false){
 const counters={widths:0,fontLookups:0};
 const music={starts:0,closes:0,loaderCloses:0,fail:false,configs:[],opens:0,clears:0,worldCalls:0,worldScene:[]};
 let clock=100000,enabled=false,hooks=[],draws=[],messages=[];let registeredModule=null;const moduleEvents={};const events={};
 const makeStore=()=>{const value=new Map();value.put=(key,item)=>value.set(key,item);value.remove=key=>value.delete(key);return value;};let store=makeStore();
 const legacy={handler:'legacy'};hooks.push({event:'OverlayRenderEvent',hook:legacy});
 const emit=(event,data)=>{if(event==='GameTickEvent')clock+=50;for(const h of [...hooks].filter(h=>h.event===event).sort((a,b)=>b.hook.priority-a.hook.priority))if(h.hook!==legacy)h.hook.callback(data);};
 const nativeTags={getEnabled:()=>enabled,setEnabled(value){enabled=value;emit('ModuleToggleEvent',{getModuleName:()=> 'Nametags'});}};
 const tagsType={INSTANCE:nativeTags,class:{getDeclaredField(name){assert.equal(name,'overlayRenderHandler');return{setAccessible(){},get:()=>legacy};}}};
 const manager={registerEventHook(event,hook){assert(!hooks.some(x=>x.event===event&&x.hook===hook));hooks.push({event,hook});},unregisterEventHook(event,hook){hooks=hooks.filter(x=>x.event!==event||x.hook!==hook);}};
 const vec=(x,y,z)=>({x:()=>x,y:()=>y,z:()=>z,add(){return this;},distanceTo:()=>65});
 const entity={isAlive:()=>true,getUUID:()=> 'id',getPose:()=> 'standing',getEyeHeight:()=>1.6,position:()=>vec(1,2,3),getHealth:()=>20,getMaxHealth:()=>20,getAbsorptionAmount:()=>0};
 const player={...entity,getUUID:()=> 'self'};const entities=[entity];let screen=null;
 const exact=(...values)=>values.forEach(v=>{assert.equal(typeof v,'number');assert.equal(v,Math.fround(v),'Lossy Java float: '+v);});
 const font={getHeight:()=>43,getScaleToVanillaFont:()=>9/43,getStringWidth:(component,scale)=>{counters.widths++;exact(scale);return component.text.length*20*scale;},draw(...args){assert.equal(args.length,9);exact(args[2],args[3],args[6]);draws.push(['text',...args]);}};
 const ctx={},mc={player,level:{},gameRenderer:{mainCamera:()=>({position:()=>vec(0,0,0)})},gui:{screen:()=>screen},getWindow:()=>({getGuiScaledWidth:()=>1000,getGuiScaledHeight:()=>550}),hasSingleplayerServer:()=>false,getCurrentServer:()=>({ip:'play.example.org:25565'}),getConnection:()=>({getConnection:()=>({getRemoteAddress:()=>({getAddress:()=>({getHostAddress:()=> '203.0.113.10'})})}),getPlayerInfo:()=>({getLatency:()=>37})})};
 const className=name=>name.split('.').at(-1);
 const setting=o=>{let v=o.default;return{get:()=>v,set:n=>v=n};};
 const types={ModuleClickGui:{INSTANCE:{onEnabled(){}}},Render3DKt:{submitTextAlwaysOnTop(...args){exact(args[2],args[3]);draws.push(['worldText',...args]);}},'Font$DisplayMode':{SEE_THROUGH:'see-through'},ScriptSetting:{INSTANCE:{boolean:setting,float:setting,choose:o=>setting({...o,default:{getTag:()=>o.default}})}},
 EventManager:{INSTANCE:manager},EventHook:class{constructor(owner,priority,callback){Object.assign(this,{owner,priority,callback});}},EventListener:class{},Consumer:function(f){return f;},Component:{literal:text=>({text,getVisualOrderText:()=>({text})})},PersistentLocalStorage:{INSTANCE:{getMap:()=>store}},ModuleNametags:tagsType,
 RenderedEntities:{INSTANCE:{iterator(){let i=0;return{hasNext:()=>i<entities.length,next:()=>entities[i++]};}}},EntityExtensionsKt:{getActualHealth:()=>20,hasHealthScoreboard:()=>false,getSimpleDisplayName:e=>({text:e===player?'ProtectedSelf':'ProtectedName'}),interpolateCurrentPosition:()=>vec(0,0,0)},WorldToScreen:{calculateScreenPos:()=>vec(500,100,.5)},
 FontManager:{INSTANCE:{fontFace:()=>{counters.fontLookups++;return{getRenderer:()=>font};}},getFONT_RENDERER:()=>font},Render2DKt:{class:{getMethods:()=>[{getName:()=> 'drawRoundedRect',getParameterCount:()=>arity}]},drawQuad(...args){exact(...args.slice(1,5));draws.push(['quad',...args]);},drawRoundedRect(...args){assert.equal(args.length,arity);exact(...args.slice(1,6),args.at(-1));draws.push(['rounded',...args]);}},Color4b:class{constructor(...values){this.values=values;}},InventoryScreen:{extractEntityInInventoryFollowsMouse(...args){assert.equal(args.length,10);exact(...args.slice(6,9));draws.push(['model',...args]);}},ModuleESP:{INSTANCE:{getColor:()=> 'actual-esp-color'}},System:{currentTimeMillis:()=>clock}
 };
 if(musicSupport){
  const service={getClass:()=>serviceType,configureModule:json=>music.configs.push(JSON.parse(json)),openPlayer:()=>music.opens++,clearWorldLyrics:()=>music.clears++,worldLyrics:()=>{music.worldCalls++;return JSON.stringify(music.worldScene);}};
  const serviceType={getMethod(name){return{invoke(target,path){if(name==='start'){music.starts++;assert(String(path).endsWith('opai-music'));return service;}if(name==='descriptor')return JSON.stringify({protocol:1,url:'http://127.0.0.1:61939',token:'fixture-only-token'});if(name==='close'){music.closes++;return;}}};}};
  types.ConfigSystem={INSTANCE:{getRootFolder:()=>'/fixture/LiquidBounce',getClass:()=>({getClassLoader:()=>null})}};
  types.File=class{constructor(root,path){this.path=root+'/'+path;}isFile(){return true;}toURI(){return{toURL:()=>this.path};}getAbsolutePath(){return this.path;}};
  types.URLClassLoader=class{loadClass(){if(music.fail)throw new Error('bad music JAR');return serviceType;}close(){music.loaderCloses++;}};types.String={class:'java.lang.String'};
 }
 vm.runInNewContext(source,{Java:{to:value=>value,type(name){const key=className(name);if(types[key])return types[key];if(/Event$/.test(key))return{class:key};throw new Error('Unknown host type '+name);},extend(){return class{constructor(options){Object.assign(this,options);}};}},mc,Client:{displayChatMessage:m=>messages.push(m)},registerScript(info){assert.equal(info.name,'OpaiBridge');return{on:(name,callback)=>events[name]=callback,registerModule(info,cb){assert.equal(info.name,'TritiumMusic');let enabled=false;registeredModule={...info,getEnabled:()=>enabled,setEnabled:v=>{enabled=v;moduleEvents[v?'enable':'disable']?.();},on:(n,f)=>moduleEvents[n]=f};cb(registeredModule);}};},console});
 return {types,counters,music,get registeredModule(){return registeredModule;},moduleEvents,events,emit,get store(){return store;},replaceStore(){const previous=store;store=makeStore();return previous;},draws,messages,mc,ctx,nativeTags,legacy,get hooks(){return hooks;},advance(t){clock+=t;},clock:()=>clock,setScreen(value){screen=value;}};
}
test('validates preview protocol, lease, bounds, numeric values and scaled viewport',()=>{
 const request={protocol:1,at:100,module:'ESP',viewport:{width:2000,height:1100},rect:{x:1500,y:200,width:400,height:600}};
 assert.deepEqual(core.previewRequest(JSON.stringify(request),100,1000,550).rect,{x:750,y:100,width:200,height:300});
 for(const bad of [{...request,at:-2000},{...request,at:5000},{...request,protocol:2},{...request,module:'KillAura'},{...request,rect:{x:0,y:0,width:null,height:300}}])assert.equal(core.previewRequest(JSON.stringify(bad),100,1000,550),null);
 assert.equal(core.previewRequest('bad',100,1000,550),null);assert.equal(core.healthColor(20),0x80d900);assert.equal(core.healthColor(9),0xffc83d);assert.equal(core.healthColor(3),0xff615b);
});
test('auto-start registers only the requested music module, provides real connection data, and cleans up on unload/reload',()=>{
 const h=host();h.events.enable();h.emit('GameTickEvent',{});assert.equal(h.nativeTags.getEnabled(),true);assert.equal(h.hooks.length,5);const data=JSON.parse(h.store.get('opai.bridge.snapshot'));assert.equal(data.serverAddress,'play.example.org:25565');assert.equal(data.ping,37);assert.equal(data.serverIP,'203.0.113.10');assert.equal(data.capabilities.nametags,true);
 h.events.enable();h.emit('GameTickEvent',{});assert.equal(h.hooks.length,5);h.events.disable();assert.equal(h.hooks.length,1);assert.equal(h.hooks[0].hook,h.legacy);assert.equal(h.nativeTags.getEnabled(),false);assert.equal(h.store.has('opai.bridge.snapshot'),false);h.events.enable();h.emit('GameTickEvent',{});h.events.disable();assert.equal(h.hooks.length,1);
});
test('world labels use projected coordinates, protected real names and three separate pills',()=>{
 const h=host();h.events.enable();h.emit('GameTickEvent',{});h.emit('GameTickEvent',{});h.emit('OverlayRenderEvent',{getTickDelta:()=>.5,getContext:()=>h.ctx});
 assert.equal(h.draws.filter(x=>x[0]==='rounded').length,3);const labels=h.draws.filter(x=>x[0]==='text').map(x=>x[2].text);assert.deepEqual(labels,['20','ProtectedName','65m']);h.events.disable();
});
test('native entity preview uses the real model, actual color, geometry and expires',()=>{
 const h=host();h.events.enable();h.emit('GameTickEvent',{});h.setScreen({});h.store.set('opai.bridge.preview',JSON.stringify({protocol:1,owner:'theme',at:h.clock(),module:'ESP',viewport:{width:2000,height:1100},rect:{x:1200,y:200,width:400,height:600}}));h.emit('GameTickEvent',{});const event={getContext:()=>h.ctx};h.emit('ScreenRenderEvent',event);assert.equal(h.draws.filter(x=>x[0]==='model').length,1);const model=h.draws.find(x=>x[0]==='model');assert.equal(model[2],600);assert.equal(model[3],100);assert.equal(model.at(-1),h.mc.player);assert(h.draws.some(x=>x[0]==='quad'&&x.at(-1)==='actual-esp-color'));
 h.advance(1500);h.emit('ScreenRenderEvent',event);assert.equal(h.draws.filter(x=>x[0]==='model').length,1);h.events.disable();
});
test('manual change of existing Nametags is respected when unloading',()=>{const h=host();h.events.enable();h.emit('GameTickEvent',{});h.nativeTags.setEnabled(false);h.nativeTags.setEnabled(true);h.events.disable();assert.equal(h.nativeTags.getEnabled(),true);});
test('feature controls restore the original nametag handler without stopping telemetry',()=>{const h=host();h.events.enable();h.emit('GameTickEvent',{});h.store.set('opai.bridge.features',JSON.stringify({protocol:1,nametags:false,preview:false}));for(let i=0;i<11;i++)h.emit('GameTickEvent',{});assert.equal(h.nativeTags.getEnabled(),false);assert(h.hooks.some(x=>x.hook===h.legacy));const data=JSON.parse(h.store.get('opai.bridge.snapshot'));assert.equal(data.capabilities.preview,false);assert.equal(data.serverAddress,'play.example.org:25565');h.events.disable();});
test('disconnect clears address and latency rather than showing a stale server',()=>{const h=host();h.events.enable();h.emit('GameTickEvent',{});h.mc.player=null;h.mc.level=null;for(let i=0;i<11;i++)h.emit('GameTickEvent',{});const state=JSON.parse(h.store.get('opai.bridge.snapshot'));assert.equal(state.inWorld,false);assert.equal(state.serverAddress,null);assert.equal(state.ping,null);h.events.disable();});

test('client shutdown cleans hooks and native state before the Script API closes the context',()=>{const h=host();h.events.enable();h.emit('GameTickEvent',{});h.emit('ClientShutdownEvent',{});assert.equal(h.hooks.length,1);assert.equal(h.nativeTags.getEnabled(),false);assert.equal(h.store.has('opai.bridge.snapshot'),false);});

test('both host rounded rectangle signatures use exact float32 coordinates',()=>{
 for(const arity of [9,10]){const h=host(arity);h.events.enable();h.emit('GameTickEvent',{});h.emit('OverlayRenderEvent',{getTickDelta:()=>.5,getContext:()=>h.ctx});assert.equal(h.draws.filter(x=>x[0]==='rounded').length,3);assert.equal(h.messages.filter(x=>x.includes('Nametags:')).length,0);h.events.disable();}
});
test('screen-only frames read fresh previews and publish telemetry while world ticks are paused',()=>{
 const h=host();h.events.enable();h.setScreen({});h.mc.getCurrentServer=()=>({ip:'second.example.org'});
 h.store.set('opai.bridge.preview',JSON.stringify({protocol:1,owner:'theme',at:h.clock(),module:'ESP',viewport:{width:2000,height:1100},rect:{x:1200,y:200,width:400,height:600}}));
 h.advance(300);h.emit('ScreenRenderEvent',{getContext:()=>h.ctx});assert.equal(h.draws.filter(x=>x[0]==='model').length,1);const state=JSON.parse(h.store.get('opai.bridge.snapshot'));assert.equal(state.serverAddress,'second.example.org');assert.equal(state.at,h.clock());h.events.disable();
});
test('a transient model failure retries and clears its diagnostic without disabling the feature',()=>{
 const h=host();h.events.enable();h.setScreen({});h.store.set('opai.bridge.preview',JSON.stringify({protocol:1,at:h.clock(),module:'ESP',viewport:{width:2000,height:1100},rect:{x:1200,y:200,width:400,height:600}}));
 h.mc.player.getMaxHealth=()=>{throw new Error('temporarily unavailable');};const event={getContext:()=>h.ctx};h.emit('ScreenRenderEvent',event);assert.equal(JSON.parse(h.store.get('opai.bridge.snapshot')).capabilities.preview,true);assert.match(JSON.parse(h.store.get('opai.bridge.snapshot')).previewError,/temporarily unavailable/);
 h.mc.player.getMaxHealth=()=>20;h.advance(1100);h.emit('ScreenRenderEvent',event);assert.equal(JSON.parse(h.store.get('opai.bridge.snapshot')).previewError,null);h.events.disable();
});
test('failed address mapping cannot kill Ping or the preview heartbeat',()=>{
 const h=host();h.mc.getCurrentServer=()=>{throw new Error('unavailable address');};h.events.enable();const state=JSON.parse(h.store.get('opai.bridge.snapshot'));assert.equal(state.ping,37);assert.equal(state.serverAddress,'203.0.113.10');assert.equal(state.capabilities.preview,true);h.events.disable();
});
test('singleplayer mode is explicit rather than inferred from a missing address',()=>{
 const h=host();h.mc.hasSingleplayerServer=()=>true;h.mc.getCurrentServer=()=>null;h.mc.getConnection=()=>null;h.events.enable();const state=JSON.parse(h.store.get('opai.bridge.snapshot'));assert.equal(state.singleplayer,true);assert.equal(state.serverAddress,null);h.events.disable();
});

test('cold startup config load replaces the map: heartbeat must write to the REST-visible map',()=>{
 const h=host();h.events.enable();const startup=h.store;assert(startup.has('opai.bridge.snapshot'));
 h.replaceStore();h.advance(300);h.emit('GameTickEvent',{});
 const raw=h.store.get('opai.bridge.snapshot');assert(raw,'Snapshot was written to a discarded startup map, so the native REST endpoint cannot see it');assert.equal(JSON.parse(raw).at,h.clock());h.events.disable();assert.equal(h.store.has('opai.bridge.snapshot'),false);
});
test('preview and feature requests use the replacement map after a config reload',()=>{
 const h=host();h.events.enable();h.replaceStore();h.setScreen({});h.store.set('opai.bridge.features',JSON.stringify({protocol:1,nametags:false}));
 h.store.set('opai.bridge.preview',JSON.stringify({protocol:1,at:h.clock(),module:'ESP',viewport:{width:2000,height:1100},rect:{x:1200,y:200,width:400,height:600}}));
 h.advance(300);h.emit('ScreenRenderEvent',{getContext:()=>h.ctx});assert.equal(h.draws.filter(x=>x[0]==='model').length,1,'Preview request is in the current map, not the discarded startup map');assert.equal(JSON.parse(h.store.get('opai.bridge.snapshot')).capabilities.nametags,false);h.events.disable();
});

test('world telemetry reads the actual biome and dimension and clears when leaving a world',()=>{
 const h=host();h.mc.player.blockPosition=()=> 'actual-block-position';
 h.mc.level.getBiome=position=>{assert.equal(position,'actual-block-position');return{unwrapKey:()=>({orElse:()=>({identifier:()=> 'minecraft:plains'})})};};
 h.mc.level.dimension=()=>({identifier:()=> 'minecraft:overworld'});h.events.enable();
 let state=JSON.parse(h.store.get('opai.bridge.snapshot'));assert.deepEqual(state.worldInfo,{biome:'minecraft:plains',dimension:'minecraft:overworld'});
 h.mc.player=null;h.mc.level=null;h.advance(300);h.emit('GameTickEvent',{});state=JSON.parse(h.store.get('opai.bridge.snapshot'));assert.equal(state.worldInfo,null);h.events.disable();
});
test('unavailable optional biome API never interrupts server, Ping or preview',()=>{
 const h=host();h.mc.level.getBiome=()=>{throw new Error('optional metadata unavailable');};h.events.enable();const state=JSON.parse(h.store.get('opai.bridge.snapshot'));assert.equal(state.worldInfo.biome,null);assert.equal(state.ping,37);assert.equal(state.serverAddress,'play.example.org:25565');assert.equal(state.capabilities.preview,true);h.events.disable();
});

test('optional music service loads once, restores discovery after storage-map replacement, and closes on unload',()=>{
 const h=host(9,true);h.events.enable();assert.equal(h.music.starts,1);assert.equal(JSON.parse(h.store.get('opai.bridge.music')).protocol,1);
 const old=h.replaceStore();h.advance(300);h.emit('GameTickEvent',{});assert.equal(JSON.parse(h.store.get('opai.bridge.music')).url,'http://127.0.0.1:61939');assert.notEqual(old,h.store);assert.equal(h.music.starts,1);
 h.events.disable();assert.equal(h.music.closes,1);assert.equal(h.music.loaderCloses,1);assert.equal(h.store.has('opai.bridge.music'),false);assert.equal(h.store.has('opai.bridge.snapshot'),false);
});
test('a failed music JAR leaves native server information and ESP preview available',()=>{
 const h=host(9,true);h.music.fail=true;h.events.enable();const data=JSON.parse(h.store.get('opai.bridge.snapshot'));assert.equal(data.serverAddress,'play.example.org:25565');assert.equal(data.capabilities.preview,true);assert(data.errors.some(e=>e.startsWith('Music:')));assert.equal(h.store.has('opai.bridge.music'),false);h.events.disable();
});

test('music is a single native action module with shared Boolean/choose settings and repeatable opening',()=>{
 const h=host(9,true);h.events.enable();const m=h.registeredModule;assert.equal(m.name,'TritiumMusic');assert.equal(m.category,'Misc');assert.equal(m.settings.lyricsMode.get().getTag(),'HUD');assert.equal(h.music.configs.length,1);
 for(let i=0;i<3;i++){m.setEnabled(true);assert.equal(m.getEnabled(),false,'an action module must reset so the next click also opens');h.advance(300);h.emit('GameTickEvent',{});}assert.equal(h.music.opens,3);
 m.settings.info.set(false);h.advance(300);h.emit('GameTickEvent',{});assert.equal(h.music.configs.at(-1).widgets.info,false);assert.equal(h.messages.filter(x=>x.includes('Music module:')).length,0);h.events.disable();
});
test('Dango mode submits real world glyphs with balanced native poses and no screen overlay',()=>{
 const h=host(9,true);h.events.enable();h.registeredModule.settings.lyricsMode.set({getTag:()=> 'Dango3D'});h.advance(300);h.emit('GameTickEvent',{});h.mc.font={width:()=>6};h.music.worldScene=[{key:'fixture:1',lines:['Test'],glyphs:[{c:'T',row:0,col:0,alpha:1,pop:1.1,dx:.1,dy:.2}],x:1.1,y:65.2,z:10.3,scale:.04615}];let depth=0;const pose={pushPose(){depth++;},popPose(){depth--;},translate(){},rotate(){},scale(...args){for(const n of args)assert.equal(n,Math.fround(n));}};
 const event={getCamera:()=>({position:()=>({x:0,y:64,z:0}),yRot:()=>0,xRot:()=>0,rotation:()=> 'actual-camera-rotation'}),getPoseStack:()=>pose,getSubmitNodeStorage:()=> 'actual-world-submission'};h.emit('WorldFeatureSubmitEvent',event);assert.equal(depth,0);const text=h.draws.find(x=>x[0]==='worldText');assert(text);assert.equal(text[1],'actual-world-submission');assert.equal(text[5].text,'T');h.setScreen({});h.emit('WorldFeatureSubmitEvent',event);assert.equal(h.draws.filter(x=>x[0]==='worldText').length,1);assert.equal(h.music.clears,1);h.events.disable();
});

test('ordinary HUD skips all per-frame music Java calls and leaving Dango clears exactly once',()=>{
 const h=host(9,true);h.events.enable();const event={getCamera(){throw new Error('HUD mode touched world camera');}};
 for(let i=0;i<240;i++)h.emit('WorldFeatureSubmitEvent',event);assert.equal(h.music.worldCalls,0);assert.equal(h.music.clears,0);assert.equal(h.messages.filter(x=>x.includes('3D Lyrics:')).length,0);
 h.registeredModule.settings.lyricsMode.set({getTag:()=> 'Dango3D'});h.advance(300);h.emit('GameTickEvent',{});h.mc.font={width:()=>6};
 h.emit('WorldFeatureSubmitEvent',{getCamera:()=>({position:()=>({x:0,y:0,z:0}),yRot:()=>0,xRot:()=>0}),getPoseStack:()=>({})});assert.equal(h.music.worldCalls,1);
 h.registeredModule.settings.lyrics.set(false);h.advance(300);h.emit('GameTickEvent',{});for(let i=0;i<240;i++)h.emit('WorldFeatureSubmitEvent',event);assert.equal(h.music.worldCalls,1);assert.equal(h.music.clears,1);h.events.disable();
});

test('the optional 3D render listener does not exist in normal HUD mode and is removed when changing back',()=>{
 const h=host(9,true);h.events.enable();assert.equal(h.hooks.filter(x=>x.event==='WorldFeatureSubmitEvent').length,0);
 h.registeredModule.settings.lyricsMode.set({getTag:()=> 'Dango3D'});h.advance(300);h.emit('GameTickEvent',{});assert.equal(h.hooks.filter(x=>x.event==='WorldFeatureSubmitEvent').length,1);
 h.advance(300);h.emit('GameTickEvent',{});assert.equal(h.hooks.filter(x=>x.event==='WorldFeatureSubmitEvent').length,1);
 h.registeredModule.settings.lyricsMode.set({getTag:()=> 'HUD'});h.advance(300);h.emit('GameTickEvent',{});assert.equal(h.hooks.filter(x=>x.event==='WorldFeatureSubmitEvent').length,0);h.events.disable();assert.equal(h.hooks.length,1);
});
test('stable native labels measure text once per tick snapshot instead of per render frame',()=>{
 const h=host();h.events.enable();h.emit('GameTickEvent',{});const event={getTickDelta:()=>.5,getContext:()=>h.ctx};for(let i=0;i<120;i++)h.emit('OverlayRenderEvent',event);assert.equal(h.counters.widths,3);assert.equal(h.draws.filter(x=>x[0]==='text').length,360);h.emit('GameTickEvent',{});h.emit('OverlayRenderEvent',event);assert.equal(h.counters.widths,6);h.events.disable();
});

test('render diagnostic lease pauses only custom drawing, preserves music and telemetry, then expires',()=>{
 const h=host(9,true);h.events.enable();h.emit('GameTickEvent',{});const e={getTickDelta:()=>.5,getContext:()=>h.ctx};h.emit('OverlayRenderEvent',e);const before=h.draws.length;
 h.store.set('opai.bridge.renderProbe',JSON.stringify({protocol:1,paused:true,at:h.clock()}));h.advance(300);h.emit('GameTickEvent',{});h.emit('OverlayRenderEvent',e);assert.equal(h.draws.length,before);assert.equal(JSON.parse(h.store.get('opai.bridge.snapshot')).ping,37);assert.equal(h.music.closes,0);
 h.advance(2200);h.emit('GameTickEvent',{});h.emit('OverlayRenderEvent',e);assert(h.draws.length>before);h.events.disable();
});

test('an empty or unavailable world does not resolve native fonts every frame',()=>{
 const h=host();h.events.enable();h.mc.player=null;h.mc.level=null;h.emit('GameTickEvent',{});for(let i=0;i<120;i++)h.emit('OverlayRenderEvent',{});assert.equal(h.counters.fontLookups,0);assert.equal(h.draws.length,0);h.events.disable();
});

function activityHost(){
 const h=host();let bed=null,enabled=true,silent=true;const clicks=[];
 class ChestMenu{constructor(rows=3,id=4){this.rows=rows;this.containerId=id;this.items=Array.from({length:rows*9},()=>({id:'minecraft:air',count:0}));}getRowCount(){return this.rows;}getSlot(i){const item=this.items[i];return{getItem:()=>({isEmpty:()=>item.count===0,getItem:()=>item.id,getCount:()=>item.count,getDamageValue:()=>0,getMaxDamage:()=>0})};}}
 class ContainerScreen{}
 Object.assign(h.types,{ChestMenu,ContainerScreen,BuiltInRegistries:{ITEM:{getKey:id=>id},BLOCK:{getKey:block=>block.id}},ModuleChestStealer:{INSTANCE:{getEnabled:()=>enabled}},FeatureSilentScreen:{INSTANCE:{getShouldHide:()=>silent}},ContainerInput:{QUICK_MOVE:'quick-move'},ModuleFucker:{INSTANCE:{getEnabled:()=>true,breakingProgress:()=>bed}},'BreakingProgress$Provider':{Default:{breakingProgress:()=>null}}});
 h.mc.gameMode={isDestroying:()=>false,handleContainerInput:(...args)=>clicks.push(args)};h.mc.level.getBlockState=pos=>({isAir:()=>false,getBlock:()=>({id:pos.id,getName:()=>({getString:()=>pos.label})})});h.mc.mouseHandler={xpos:()=>100,ypos:()=>120};h.mc.getWindow=()=>({getScreenWidth:()=>2000,getScreenHeight:()=>1100,getGuiScaledWidth:()=>1000,getGuiScaledHeight:()=>550});
 return Object.assign(h,{clicks,ChestMenu,ContainerScreen,setBed(id,progress){const pos={id,label:id?.endsWith('_bed')?'床':'Stone',getX:()=>1,getY:()=>2,getZ:()=>3};bed=id?{pos:()=>pos,value:()=>progress}:null;},setEnabled(v){enabled=v;},setSilent(v){silent=v;},state(){return JSON.parse(h.store.get('opai.bridge.activity'));}});
}
test('bridge publishes actual breaking progress and defense target, then clears after stopping',()=>{
 const h=activityHost();h.events.enable();h.setBed('minecraft:red_bed',.29);h.emit('GameTickEvent',{});assert.equal(h.state().breaking.id,'minecraft:red_bed');assert.equal(h.state().breaking.progress,.29);assert.deepEqual(h.state().breaking.position,[1,2,3]);
 h.setBed('minecraft:stone',.6);h.advance(100);h.emit('GameTickEvent',{});assert.equal(h.state().breaking.name,'Stone');assert.equal(h.state().breaking.progress,.6);h.setBed(null,0);h.advance(100);h.emit('GameTickEvent',{});assert.equal(h.state().breaking,null);h.events.disable();assert.equal(h.store.has('opai.bridge.activity'),false);
});
test('container bridge preserves slots, detects real transfers, validates manual input and unloads its mouse hook',()=>{
 const h=activityHost();const menu=new h.ChestMenu();menu.items[0]={id:'minecraft:diamond',count:8};menu.items[4]={id:'minecraft:oak_planks',count:27};h.mc.player.containerMenu=menu;h.setScreen(new h.ContainerScreen());h.events.enable();h.emit('GameTickEvent',{});
 let state=h.state();assert.equal(state.container.stacks.length,27);assert.equal(state.container.stacks[4].count,27);assert.equal(state.container.feedback.length,0);assert(h.hooks.some(x=>x.event==='MouseButtonEvent'));
 menu.items[4].count=0;h.advance(100);h.emit('GameTickEvent',{});state=h.state();assert.equal(state.container.stacks[4].count,0);assert.equal(state.container.feedback[0].slot,4);
 const session=state.container.session;h.store.set('opai.bridge.containerView',JSON.stringify({protocol:1,owner:'test',at:h.clock(),session,viewport:{width:2000,height:1100},rect:{x:90,y:110,width:360,height:120}}));
 h.emit('MouseButtonEvent',{getAction:()=>1,getButton:()=>0});assert.equal(h.clicks.length,1);assert.equal(h.clicks[0][1],0);assert.equal(h.clicks[0][3],'quick-move');
 h.advance(1600);h.emit('MouseButtonEvent',{getAction:()=>1,getButton:()=>0});assert.equal(h.clicks.length,1,'stale panel lease must not act on another location');
 h.mc.player.containerMenu=null;h.setScreen(null);h.emit('GameTickEvent',{});assert.equal(h.state().container.open,false);assert(!h.hooks.some(x=>x.event==='MouseButtonEvent'));h.advance(600);h.emit('GameTickEvent',{});assert.equal(h.state().container,null);h.events.disable();assert.equal(h.hooks.length,1);
});
test('unrelated menus, disabled ChestStealer and invalid or replayed commands cannot transfer inventory',()=>{
 const h=activityHost();h.events.enable();h.mc.player.containerMenu={};h.emit('GameTickEvent',{});assert.equal(h.clicks.length,0);const menu=new h.ChestMenu();menu.items[0]={id:'minecraft:diamond',count:1};h.mc.player.containerMenu=menu;h.setScreen(new h.ContainerScreen());h.advance(150);h.emit('GameTickEvent',{});const session=h.state().container.session;
 h.store.set('opai.bridge.containerView',JSON.stringify({protocol:1,owner:'test',at:h.clock(),session,viewport:{width:2000,height:1100},rect:{x:100,y:100,width:360,height:120}}));
 for(const command of [{slot:99},{slot:-1},{slot:.5},{slot:0,session:'old'},{slot:0,owner:'wrong'},{slot:0,at:h.clock()-3000}]){h.store.set('opai.bridge.containerClick',JSON.stringify({protocol:1,id:Math.random(),owner:'test',at:h.clock(),session,...command}));h.advance(100);h.emit('GameTickEvent',{});}assert.equal(h.clicks.length,0);
 h.store.set('opai.bridge.containerView',JSON.stringify({protocol:1,owner:'test',at:h.clock(),session,viewport:{width:2000,height:1100},rect:{x:100,y:100,width:360,height:120}}));h.store.set('opai.bridge.containerClick',JSON.stringify({protocol:1,id:100,owner:'test',at:h.clock(),session,slot:0}));h.advance(100);h.emit('GameTickEvent',{});assert.equal(h.clicks.length,1);h.advance(200);h.emit('GameTickEvent',{});assert.equal(h.clicks.length,1,'do not replay the same action');h.setEnabled(false);h.advance(100);h.emit('GameTickEvent',{});assert(!h.state().container.open);h.events.disable();
});

test('the island honors native ChestStealer menu/title filtering before displaying or taking slots',()=>{
 const h=activityHost();let allowed=true;h.types.ModuleChestStealer.INSTANCE.canBeStolen=()=>allowed;const menu=new h.ChestMenu();menu.items[0]={id:'minecraft:diamond',count:1};h.mc.player.containerMenu=menu;h.setScreen(new h.ContainerScreen());h.events.enable();h.emit('GameTickEvent',{});assert.equal(h.state().container.open,true);
 allowed=false;h.store.set('opai.bridge.containerView',JSON.stringify({protocol:1,owner:'test',at:h.clock(),session:h.state().container.session,viewport:{width:2000,height:1100},rect:{x:90,y:110,width:360,height:120}}));h.emit('MouseButtonEvent',{getAction:()=>1,getButton:()=>0});assert.equal(h.clicks.length,0);h.advance(100);h.emit('GameTickEvent',{});assert.equal(h.state().container.open,false);assert(!h.hooks.some(x=>x.event==='MouseButtonEvent'));h.events.disable();
});
