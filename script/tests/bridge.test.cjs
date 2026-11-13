const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../OpaiBounceScript.js'),'utf8');
const exportsModule={exports:{}};
new Function('module',source)(exportsModule);
const core=exportsModule.exports;
function host(arity=9,musicSupport=false){
 const counters={widths:0,fontLookups:0};
 const friends=new Set();
 const icmp={samples:[],resets:0,closes:0,result:37};
 const music={starts:0,closes:0,loaderCloses:0,fail:false,configs:[],opens:0,clears:0,worldCalls:0,worldScene:[]};
 let clock=100000,enabled=false,hooks=[],draws=[],messages=[];const modules=new Map(),events={};
 const makeStore=()=>{const value=new Map();value.put=(key,item)=>value.set(key,item);value.remove=key=>value.delete(key);return value;};let store=makeStore();
 const legacy={handler:'legacy'};hooks.push({event:'OverlayRenderEvent',hook:legacy});
 const emit=(event,data)=>{if(event==='GameTickEvent')clock+=50;for(const h of [...hooks].filter(h=>h.event===event).sort((a,b)=>b.hook.priority-a.hook.priority))if(h.hook!==legacy){const callback=h.hook.callback;if(typeof callback==='function')callback(data);else callback.accept(data);}};
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
 function component(text,color=null) {return {text,color,parts:[],getVisualOrderText:()=>({text}),withColor:rgb=>component(text,rgb),equals:other=>other?.text===text&&other?.color===color,append(part){this.text+=part.text;this.parts.push(part);return this;},
  getStyle(){return {withUnderlined(){return this;},withClickEvent:click=>({click})};},setStyle(style){this.click=style.click;return this;}};}
 const types={FriendManager:{INSTANCE:{isFriend:entity=>friends.has(entity)}},ModuleClickGui:{INSTANCE:{onEnabled(){}}},Render3DKt:{submitTextAlwaysOnTop(...args){exact(args[2],args[3]);draws.push(['worldText',...args]);}},'Font$DisplayMode':{SEE_THROUGH:'see-through'},ScriptSetting:{INSTANCE:{boolean:setting,int:setting,float:setting,choose:o=>setting({...o,default:{getTag:()=>o.default}})}},
 EventManager:{INSTANCE:manager},EventHook:class{constructor(owner,priority,callback){Object.assign(this,{owner,priority,callback});}},EventListener:class{},Consumer:function(f){return f;},Component:{literal:component},PersistentLocalStorage:{INSTANCE:{getMap:()=>store}},ModuleNametags:tagsType,
 RenderedEntities:{INSTANCE:{iterator(){let i=0;return{hasNext:()=>i<entities.length,next:()=>entities[i++]};}}},EntityExtensionsKt:{getActualHealth:()=>20,hasHealthScoreboard:()=>false,getSimpleDisplayName:e=>({text:e===player?'ProtectedSelf':'ProtectedName'}),interpolateCurrentPosition:()=>vec(0,0,0)},WorldToScreen:{calculateScreenPos:()=>vec(500,100,.5)},
 FontManager:{INSTANCE:{fontFace:()=>{counters.fontLookups++;return{getRenderer:()=>font};}},getFONT_RENDERER:()=>font},Render2DKt:{class:{getMethods:()=>[{getName:()=> 'drawRoundedRect',getParameterCount:()=>arity}]},drawQuad(...args){exact(...args.slice(1,5));draws.push(['quad',...args]);},drawRoundedRect(...args){assert.equal(args.length,arity);exact(...args.slice(1,6),args.at(-1));draws.push(['rounded',...args]);}},Color4b:class{constructor(...values){this.values=values;}},InventoryScreen:{extractEntityInInventoryFollowsMouse(...args){assert.equal(args.length,10);exact(...args.slice(6,9));draws.push(['model',...args]);}},ModuleESP:{INSTANCE:{getColor:()=> 'actual-esp-color'}},System:{currentTimeMillis:()=>clock}
 };
 types.Consumer.class=Function;
 if(musicSupport){
  const service={getClass:()=>serviceType,configureModule:json=>music.configs.push(JSON.parse(json)),openPlayer:()=>music.opens++,clearWorldLyrics:()=>music.clears++,worldLyrics:()=>{music.worldCalls++;return JSON.stringify(music.worldScene);}};
  const serviceType={getMethod(name){return{invoke(target,path){if(name==='start'){music.starts++;assert(String(path).endsWith('opai-music'));return service;}if(name==='descriptor')return JSON.stringify({protocol:1,url:'http://127.0.0.1:61939',token:'fixture-only-token'});if(name==='close'){music.closes++;return;}}};}};
  types.ConfigSystem={INSTANCE:{getRootFolder:()=>'/fixture/LiquidBounce',getClass:()=>({getClassLoader:()=>null})}};
  types.File=class{constructor(root,path){this.path=root+'/'+path;}isFile(){return true;}toURI(){return{toURL:()=>this.path};}getAbsolutePath(){return this.path;}};
  types.URLClassLoader=class{loadClass(name){
   if(name==='opai.bridge.PacketInbox')return {getConstructor:()=>({newInstance:(_event,incoming,types)=>{
    const queue=[];return {accept:event=>{if(event.getOrigin()===incoming&&types.some(type=>event.getPacket() instanceof type)){const at=clock;queue.push({event:()=>event,at:()=>at});}},poll:()=>queue.shift(),clear:()=>queue.splice(0)};
   }})};
   if(name==='opai.bridge.WatchActions')return {getConstructor:()=>({newInstance:callback=>{let action=callback;return{link:target=>()=>action?.(target),close:()=>{action=null;}};}})};
   if(name==='opai.music.IcmpProbe')return {getConstructor:()=>({newInstance:()=>({
    sample(address){icmp.samples.push(address.getHostAddress());return icmp.result;},
    reset(){icmp.resets++;},close(){icmp.closes++;},
   })})};
   if(music.fail)throw new Error('bad music JAR');return serviceType;
  }close(){music.loaderCloses++;}};types.String={class:'java.lang.String'};
 }
 const context=vm.createContext({Java:{to:value=>Object.assign(value,{getClass:()=>Array}),type(name){const key=className(name);if(types[key])return types[key];if(/Event$/.test(key))return{class:key};throw new Error('Unknown host type '+name);},extend(){return class{constructor(options){Object.assign(this,options);}};}},mc,Client:{displayChatMessage:m=>messages.push(m)},registerScript(info){assert.equal(info.name,'OpaiBridge');return{on:(name,callback)=>events[name]=callback,registerModule(info,cb){let enabled=false;const handlers={};const registered={...info,getEnabled:()=>enabled,setEnabled:v=>{enabled=v;handlers[v?'enable':'disable']?.();emit('ModuleToggleEvent',{getModuleName:()=>info.name,getEnabled:()=>v});},on:(n,f)=>handlers[n]=f};modules.set(info.name,registered);cb(registered);}};},console});
 vm.runInContext(source,context);
 return {types,counters,music,icmp,friends,entity,modules,context,get registeredModule(){return modules.get('TritiumMusic');},events,emit,get store(){return store;},replaceStore(){const previous=store;store=makeStore();return previous;},draws,messages,mc,ctx,nativeTags,legacy,get hooks(){return hooks;},advance(t){clock+=t;},clock:()=>clock,setScreen(value){screen=value;}};
}
test('validates preview protocol, lease, bounds, numeric values and scaled viewport',()=>{
 const request={protocol:1,at:100,module:'ESP',viewport:{width:2000,height:1100},rect:{x:1500,y:200,width:400,height:600}};
 assert.deepEqual(core.previewRequest(JSON.stringify(request),100,1000,550).rect,{x:750,y:100,width:200,height:300});
 for(const bad of [{...request,at:-2000},{...request,at:5000},{...request,protocol:2},{...request,module:'KillAura'},{...request,rect:{x:0,y:0,width:null,height:300}}])assert.equal(core.previewRequest(JSON.stringify(bad),100,1000,550),null);
 assert.equal(core.previewRequest('bad',100,1000,550),null);assert.equal(core.healthColor(20),0x80d900);assert.equal(core.healthColor(9),0xffc83d);assert.equal(core.healthColor(3),0xff615b);
});
test('auto-start registers the two native modules, provides real connection data, and cleans up on unload/reload',()=>{
 const modules=host().modules;assert.deepEqual([...modules.keys()],['TritiumMusic','Anti-cheat']);assert.equal(modules.get('Anti-cheat').category,'Misc');assert.equal(modules.get('Anti-cheat').getEnabled(),false);
 const h=host();h.events.enable();h.emit('GameTickEvent',{});assert.equal(h.nativeTags.getEnabled(),true);assert.equal(h.hooks.length,5);const data=JSON.parse(h.store.get('opai.bridge.snapshot'));assert.equal(data.serverAddress,'play.example.org:25565');assert.equal(data.ping,null);assert.equal(data.pingSource,'icmp');assert.equal(data.serverIP,'203.0.113.10');assert.equal(data.capabilities.nametags,true);
 h.events.enable();h.emit('GameTickEvent',{});assert.equal(h.hooks.length,5);h.events.disable();assert.equal(h.hooks.length,1);assert.equal(h.hooks[0].hook,h.legacy);assert.equal(h.nativeTags.getEnabled(),false);assert.equal(h.store.has('opai.bridge.snapshot'),false);h.events.enable();h.emit('GameTickEvent',{});h.events.disable();assert.equal(h.hooks.length,1);
});
test('world labels use projected coordinates, protected real names and three separate pills',()=>{
 const h=host();h.events.enable();h.emit('GameTickEvent',{});h.emit('GameTickEvent',{});h.emit('OverlayRenderEvent',{getTickDelta:()=>.5,getContext:()=>h.ctx});
 assert.equal(h.draws.filter(x=>x[0]==='rounded').length,3);const labels=h.draws.filter(x=>x[0]==='text').map(x=>x[2].text);assert.deepEqual(labels,['♥','20','ProtectedName','65m']);h.events.disable();
});

test('native nametags keep their original background with a legacy HUD preference',()=>{
 const h=host();h.store.set('opai.preferences',JSON.stringify({transparentHud:true}));h.events.enable();
 h.emit('GameTickEvent',{});h.emit('OverlayRenderEvent',{getTickDelta:()=>.5,getContext:()=>h.ctx});
 const pills=h.draws.filter(d=>d[0]==='rounded');
 assert.equal(pills.length,3);assert(pills.every(d=>d[7].values[3]===190));h.events.disable();
});

function antiCheatHost() {
 const h=host(9,true), e=h.entity, points={x:0,y:64,z:.5}, flight={ground:false,creative:false,hurt:0,sneak:false,speed:.13,blocking:false,swinging:false,blockHeld:false,sword:false,yaw:0,pitch:0,sprint:false};
 const chat=[], placed=new Set([0]), blocks=new Map(), chatLines=[];
 let camera=h.mc.player, loaded=true;
 const listed=[];
 const addTabEntry=(id='id',name='OtherPlayer',original=null)=>{
  let display=original,team='[Blue] ';
  const info={getProfile:()=>({id:()=>id,name:()=>name}),getTeam:()=>team,
   getTabListDisplayName:()=>display,setTabListDisplayName:component=>{display=component;},setTeam:value=>{team=value;}};
  listed.push(info);return info;
 };
 const ordinaryBlock={getFriction:()=>.6,getSpeedFactor:()=>1,equals:other=>other===ordinaryBlock};
 class BlockItem{getBlock(){return ordinaryBlock;}}
 const emptyHand={getItem:()=>null,getDestroySpeed:()=>1};
 let terrain='flat';
 const point=(x,y,z)=>({getX:()=>Math.floor(x),getY:()=>Math.floor(y),getZ:()=>Math.floor(z),x:()=>x,y:()=>y,z:()=>z,
  offset:(dx,dy,dz)=>point(x+dx,y+dy,z+dz),relative:({dx,dy,dz})=>point(x+dx,y+dy,z+dz)});
 const box={minX:-1,minZ:-1,maxX:1,maxZ:1,move(){return this;},inflate(){return this;},expandTowards(){return this;}};
 Object.assign(e,{
  getName:()=>({getString:()=> 'OtherPlayer'}),getId:()=>42,distanceToSqr:(...args)=>args.length===1?64:4,getPositionCodec:()=>({getBase:()=>point(points.x,points.y,points.z)}),
  isPassenger:()=>false,isSleeping:()=>false,isFallFlying:()=>false,isAutoSpinAttack:()=>false,isInWater:()=>false,isInLava:()=>false,
  onClimbable:()=>false,isNoGravity:()=>false,getGravity:()=>.08,hasEffect:()=>false,
  onGround:()=>flight.ground,isShiftKeyDown:()=>flight.sneak,getX:()=>points.x,getY:()=>points.y,getZ:()=>points.z,
  getBoundingBox:()=>box,getAttributeValue:attribute=>({safeFall:3,fallDamage:1,breakSpeed:1})[attribute]??flight.speed,
  isUsingItem:()=>flight.blocking,isBlocking:()=>flight.blocking&&!flight.sword,isSwinging:()=>flight.swinging,getSwingAnimation:()=>.5,
  getUseItem:()=>({getUseAnimation:()=>flight.sword?'NONE':'BLOCK',typeHolder:()=>({is:tag=>tag==='swords'&&flight.sword})}),
  getMainHandItem:()=>flight.blockHeld?{getItem:()=>new BlockItem()}:emptyHand,getOffhandItem:()=>emptyHand,
  getYRot:()=>flight.yaw,getXRot:()=>flight.pitch,isSprinting:()=>flight.sprint,isRemoved:()=>!loaded,blockPosition:()=>point(points.x,points.y,points.z),
 });
 Object.defineProperty(e,'hurtTime',{get:()=>flight.hurt});
 class Packet {constructor(values){Object.assign(this,values);}}
 class BreakPacket extends Packet{};class BlockPacket extends Packet{};class ChunkPacket extends Packet{};class MovePacket extends Packet{};class SwingPacket extends Packet{};
 for(const type of [BreakPacket,BlockPacket,ChunkPacket,MovePacket,SwingPacket])type.class=type;
 const directions=[{dx:1,dy:0,dz:0},{dx:-1,dy:0,dz:0},{dx:0,dy:1,dz:0},{dx:0,dy:-1,dz:0},{dx:0,dy:0,dz:1},{dx:0,dy:0,dz:-1}];
 for(const d of directions)d.getOpposite=()=>directions.find(o=>o.dx===-d.dx&&o.dy===-d.dy&&o.dz===-d.dz);
 Object.assign(h.types,{
  BlockPos:{containing:(x,y,z)=>typeof x==='number'?point(x,y,z):point(x.x(),x.y(),x.z())},MobEffects:{},Attributes:{SAFE_FALL_DISTANCE:'safeFall',FALL_DAMAGE_MULTIPLIER:'fallDamage',BLOCK_BREAK_SPEED:'breakSpeed'},BlockItem,ItemTags:{SWORDS:'swords'},
  ClientChat:{chat:(component,metadata)=>{const id=metadata.args[1];if(id)removeChat(null,id);chatLines.unshift({id,component,'liquid_bounce$getId':()=>id});if(!id)chat.push({text:component.text,color:component.color,parts:component.parts.map(p=>[p.text,p.color])});}},
  MessageMetadata:class{constructor(...args){this.args=args;}},
  RunnableClickEvent:class{constructor(run){this.run=run;}},
  ChatComponent:{class:{getDeclaredField:()=>({setAccessible(){},get:()=>({isEmpty:()=>!chatLines.length,get:i=>chatLines[i]})})}},
  ChatHudExtensionKt:{removeMessage:removeChat},
  Class:{class:Function},Object:{class:Object},TransferOrigin:{INCOMING:'incoming'},Direction:{values:()=>directions},
  PlayerTeam:{formatNameForTeam:(team,name)=>h.types.Component.literal((team??'')+name.text).withColor(0x5555ff)},
  BedBlock:class{},BedPart:{HEAD:'head'},BlockStateProperties:{HORIZONTAL_FACING:'facing'},Blocks:{},
  ClientboundBlockDestructionPacket:BreakPacket,ClientboundBlockUpdatePacket:BlockPacket,ClientboundSectionBlocksUpdatePacket:ChunkPacket,ClientboundMoveEntityPacket:MovePacket,ClientboundSwingAnimationPacket:SwingPacket,
 });
 function removeChat(_chat,id){for(let i=chatLines.length-1;i>=0;i--)if(chatLines[i].id===id)chatLines.splice(i,1);}
 const connection=h.mc.getConnection();
 Object.assign(h.mc.player,{getX:()=>0,getY:()=>64,getZ:()=>30,getMainHandItem:()=>emptyHand,getOffhandItem:()=>emptyHand,isRemoved:()=>false});
 Object.assign(h.mc,{getCameraEntity:()=>camera,setCameraEntity:entity=>{camera=entity;}});
 h.mc.gui.hud={getChat:()=>chatLines};
 const listIterator=entries=>{let i=0;return{hasNext:()=>i<entries.length,next:()=>entries[i++]};};
 const packetListener={...connection,getPlayerInfo:()=>({getLatency:()=>37,getGameMode:()=>({isSurvival:()=>!flight.creative})}),
  getListedOnlinePlayers:()=>({iterator:()=>listIterator(listed)})};
 h.mc.getConnection=()=>packetListener;
 Object.assign(h.mc.level,{
  players:()=>{const list=loaded?[h.mc.player,e]:[h.mc.player];return{iterator:()=>({hasNext:()=>!!list.length,next:()=>list.shift()})};},
  hasChunkAt:()=>true,hasChunksAt:()=>true,noCollision:()=>terrain!=='obstruction',containsAnyLiquid:()=>false,getEntity:id=>id===42?e:null,
  getBlockState:pos=>{
   const key=`${pos.getX()},${pos.getY()},${pos.getZ()}`;
   if(blocks.has(key))return blocks.get(key);
   const solid=terrain==='bridge'?pos.getY()===63&&pos.getZ()===0&&placed.has(pos.getX()):true;
   return{isSolidRender:()=>solid,isAir:()=>!solid,getDestroySpeed:()=>3,getBlock:()=>terrain==='ice'?{...ordinaryBlock,getFriction:()=>.98}:ordinaryBlock};
  },
 });
 h.events.enable();
 const tick=(count=1,step=0,rise=0)=>{for(let i=0;i<count;i++){points.x+=step;points.y+=rise;h.emit('GameTickEvent',{});}};
 const draw=()=>{h.draws.length=0;h.emit('OverlayRenderEvent',{getTickDelta:()=>.5,getContext:()=>h.ctx});return h.draws;};
 const place=(x,z,y=63)=>h.emit('BlockChangeEvent',{getBlockPos:()=>point(x,y,z),getNewState:()=>({isSolidRender:()=>true,getBlock:()=>ordinaryBlock})});
 const packet=(Type,values,origin='incoming',isCancelled=()=>false)=>h.emit('PacketEvent',{getOrigin:()=>origin,getPacket:()=>new Type(values),isCancelled});
 return {...h,get hooks(){return h.hooks;},points,flight,chat,chatLines,listed,addTabEntry,packetListener,placed,tick,draw,place,packet,point,blocks,directions,BreakPacket,BlockPacket,ChunkPacket,MovePacket,SwingPacket,antiCheat:h.modules.get('Anti-cheat'),setLoaded:value=>{loaded=value;},setTerrain:value=>{terrain=value;}};
}

test('Anti-cheat crosses at VL 11 and keeps its red skull after VL decay and world changes',()=>{
 const h=antiCheatHost();
 h.tick(40,.2);assert.deepEqual(h.chat,[]);
 h.antiCheat.setEnabled(true);
 for(let i=0;i<280&&h.chat.length<10;i++)h.tick(1,.2);
 assert.equal(h.chat.at(-1).text,'[Anti-Cheat] OtherPlayer failed Air Hover (vl:10.0) [观看玩家] 0.00 Δy');
 assert.equal(h.draw().filter(d=>d[0]==='rounded').length,3);
 h.friends.add(h.entity);
 h.tick(40,.2);
 assert.deepEqual(h.chat.slice(10,14).map(message=>message.text),[
  '[Anti-Cheat] OtherPlayer failed Air Hover (vl:11.0) [观看玩家] 0.00 Δy',
  ...Array(3).fill('[Anti-Cheat] OtherPlayer 疑似是黑客 (vl:11.0)'),
 ]);
 assert.deepEqual(h.chat[10].parts.slice(0,5),[['Anti-Cheat',0x55ffff],['] OtherPlayer',0xaaaaaa],[' failed ',0xffffff],['Air Hover',0x55ffff],[' (vl:11.0)',0xffffff]]);
 h.tick(30,.2);assert.equal(h.chat.filter(m=>m.color===0xff5555).length,3);
 const draw=h.draw();assert(draw.slice(0,4).some(d=>d[0]==='rounded'&&d[7].values[0]===255));
 assert.deepEqual(draw.filter(d=>d[0]==='text').map(d=>d[2].text),['♥','20','ProtectedName','Friend','65m']);
 h.advance(600_000);h.tick();assert(h.draw().some(d=>d[0]==='rounded'&&d[7].values[0]===255));
 h.mc.level={...h.mc.level};h.tick();assert(h.draw().some(d=>d[0]==='rounded'&&d[7].values[0]===255));
 h.tick(280,.2);assert.equal(h.chat.filter(m=>m.color===0xff5555).length,3);
 h.antiCheat.setEnabled(false);assert(!h.draw().some(d=>d[0]==='rounded'&&d[7].values[0]===255));
 const last=h.chat.length;h.tick(180,.2);assert.equal(h.chat.length,last);h.events.disable();
});

test('marked UUIDs survive entity unload, player rejoin and client reconnect and decorate native Tab names',()=>{
 const h=antiCheatHost(), original=h.types.Component.literal('§ TeamName').withColor(0x55ff55), first=h.addTabEntry('id','OtherPlayer',original);
 const stranger=h.addTabEntry('unmarked','OtherPlayer'), world=h.mc.level;
 h.antiCheat.setEnabled(true);
 h.tick(260,.2);
 assert.equal(first.getTabListDisplayName().text,'* § TeamName');
 assert.equal(first.getTabListDisplayName().parts[0].color,0xff5555);
 assert.equal(first.getTabListDisplayName().parts[1],original);
 assert.equal(stranger.getTabListDisplayName(),null);

 h.setLoaded(false);h.advance(600_000);h.tick();
 assert.equal(first.getTabListDisplayName().text,'* § TeamName');
 const fresh=h.addTabEntry('id');
 h.listed.splice(0,1);h.tick();
 assert.equal(first.getTabListDisplayName(),original);
 assert.equal(fresh.getTabListDisplayName().text,'* [Blue] OtherPlayer');
 fresh.setTeam('[Red] ');h.tick();assert.equal(fresh.getTabListDisplayName().text,'* [Red] OtherPlayer');
 h.mc.level=null;h.tick();assert.equal(fresh.getTabListDisplayName(),null);
 h.mc.level={...world};h.setLoaded(true);h.tick();
 assert.equal(fresh.getTabListDisplayName().text,'* [Red] OtherPlayer');
 assert(h.draw().some(draw=>draw[0]==='rounded'&&draw[7].values[0]===255));

 h.mc.getCurrentServer=()=>({ip:'elsewhere.example.org'});h.mc.level={...world};h.tick();
 assert.equal(fresh.getTabListDisplayName(),null);
 assert(!h.draw().some(draw=>draw[0]==='rounded'&&draw[7].values[0]===255));
 h.mc.getCurrentServer=()=>({ip:'PLAY.EXAMPLE.ORG'});h.mc.level={...world};h.tick();
 assert.equal(fresh.getTabListDisplayName().text,'* [Red] OtherPlayer');
 const replacement=h.types.Component.literal('Server replacement');
 fresh.setTabListDisplayName(replacement);h.tick();
 assert.equal(fresh.getTabListDisplayName().text,'* Server replacement');
 h.antiCheat.setEnabled(false);assert.equal(fresh.getTabListDisplayName(),replacement);
 h.antiCheat.setEnabled(true);h.tick();assert.equal(fresh.getTabListDisplayName().text,'* Server replacement');
 h.events.disable();assert.equal(fresh.getTabListDisplayName(),replacement);
 assert.deepEqual(JSON.parse(h.store.get('opai.bridge.antiCheatMarks')),{'server:play.example.org':['id']});
});

test('Anti-cheat ignores normal movement, a position jump, creative, recent damage and fast terrain',()=>{
 const h=antiCheatHost();h.antiCheat.setEnabled(true);
 h.flight.ground=true;h.tick(60,.28);
 h.tick(1,30);h.tick(25,.28);
 h.setTerrain('ice');h.tick(60,.78);
 h.setTerrain('flat');h.flight.speed=.25;h.tick(60,.78);
 h.flight.speed=.13;h.flight.hurt=4;h.tick(30,.78);
 h.flight.hurt=0;h.flight.creative=true;h.tick(40,.78);
 h.flight.creative=false;h.flight.ground=false;h.tick(40,.2,.12);
 h.setTerrain('obstruction');h.tick(40,.2);assert.deepEqual(h.chat,[]);
 h.setTerrain('flat');h.flight.ground=true;h.tick(35,.8);
 assert.equal(h.chat[0]?.text,'[Anti-Cheat] OtherPlayer failed Ground Speed (vl:1.0) [观看玩家] 16.00 b/s');
 h.events.disable();
});

test('Eagle Pattern requires repeatable sneak cycles at consecutive newly placed edge blocks',()=>{
 const h=antiCheatHost();h.antiCheat.setEnabled(true);h.flight.ground=true;h.setTerrain('bridge');h.tick(23);
 function bridge(block,delay=1,place=true){
  h.points.x=block-.24;h.tick(1,.02);
  h.flight.sneak=true;h.tick(1,.04);h.tick(delay);
  if(place)h.placed.add(block);
  h.tick();h.flight.sneak=false;h.tick();
  h.tick(7,.12);
 }
 h.points.x=.7;bridge(1,1,false);assert.deepEqual(h.chat,[]);
 for(let i=1;i<=4;i++){h.points.x=i-.35;h.tick();bridge(i);}
 assert.deepEqual(h.chat,[]);
 h.points.x=4.65;h.tick();bridge(5);
 assert.deepEqual(h.chat.map(message=>message.text),['[Anti-Cheat] OtherPlayer failed Legit Scaffold (vl:1.0) [观看玩家] 5 cycles / 150ms']);
 for(let i=6;i<=11;i++){h.points.x=i-.35;h.tick();bridge(i,i%2?4:1);}
 assert.equal(h.chat.length,1,'irregular crouch times should not add VL');h.events.disable();
});

test('AutoBlock requires a high proportion of repeated swings during sustained blocking',()=>{
 const h=antiCheatHost();h.antiCheat.setEnabled(true);h.flight.ground=true;
 const swing=()=>{h.flight.swinging=true;h.tick(2);h.flight.swinging=false;h.tick(5);};
 h.flight.blocking=true;h.tick(200);assert.deepEqual(h.chat,[]);
 for(let i=0;i<10;i++){h.flight.blocking=false;swing();h.flight.blocking=true;h.tick(2);}
 assert.deepEqual(h.chat,[]);
 h.advance(9500);h.tick(15);
 for(let i=0;i<7;i++)swing();
 assert.deepEqual(h.chat.map(message=>message.text),['[Anti-Cheat] OtherPlayer failed AutoBlock (vl:1.0) [观看玩家] 7/7 swings']);
 h.antiCheat.setEnabled(false);h.antiCheat.setEnabled(true);h.flight.sword=true;h.tick(15);
 for(let i=0;i<7;i++)swing();
 assert.equal(h.chat.at(-1).text,'[Anti-Cheat] OtherPlayer failed AutoBlock (vl:1.0) [观看玩家] 7/7 swings');assert.equal(h.chat.length,2);
 h.events.disable();
});

test('remote Scaffold flags a sustained stream of unique new blocks rather than repeated updates',()=>{
 const h=antiCheatHost();h.antiCheat.setEnabled(true);h.flight.ground=true;h.flight.blockHeld=true;h.flight.swinging=true;
 h.setTerrain('bridge');h.tick(25,.15);
 for(let i=0;i<35;i++){h.place(4,0);h.tick(1,.02);}
 assert.deepEqual(h.chat,[]);
 h.tick(42,.15);
 for(let i=0;i<52;i++){
  if(i%2===0){const x=Math.floor(h.points.x)+1;h.place(x,0);h.place(x,1);}
  h.tick(1,.35);
 }
 assert(h.chat.some(line=>line.text.includes('Scaffold BPS (vl:')));h.events.disable();
});

test('Scaffold BPS flags the eighth distinct block in two seconds and ignores exactly 3.5 b/s',()=>{
 const h=antiCheatHost();h.antiCheat.setEnabled(true);h.flight.ground=true;h.flight.blockHeld=true;
 h.setTerrain('bridge');h.tick(26,.1);
 for(let i=0;i<8;i++){
  const x=Math.floor(h.points.x),z=i%2?1:-1;
  h.place(x,z);h.tick(4,.25);
  if(i===6)assert(!h.chat.some(line=>line.text.includes('Scaffold BPS')));
 }
 assert(h.chat.some(line=>line.text.includes('Scaffold BPS (vl:1.0) [观看玩家] 4.00 b/s')));
 h.events.disable();
});

test('Telly Scaffold sees the launch layer during descending jumps without a swing animation',()=>{
 const h=antiCheatHost();h.antiCheat.setEnabled(true);h.flight.ground=true;h.flight.blockHeld=true;
 h.setTerrain('bridge');h.tick(26,.1);
 for(let n=0;n<2;n++){
  h.flight.ground=false;h.tick(2,.27,.4);h.tick(2,.27,-.18);
  const x=Math.floor(h.points.x);
  h.place(x,-1,63);h.place(x,1,63);h.tick(1,.2,-.44);
  h.flight.ground=true;h.tick(5,.18);
 }
 assert(h.chat.some(line=>line.text.includes('Telly Scaffold (vl:1.0)')));
 assert(!h.chat.some(line=>line.text.includes('Scaffold BPS')));
 h.events.disable();
});

test('AutoClicker uses incoming swing packets even when render animations never restart',()=>{
 const h=antiCheatHost();h.antiCheat.setEnabled(true);h.flight.ground=true;h.tick(24);
 for(let i=0;i<14;i++){
  h.packet(h.SwingPacket,{entityId:()=>42});h.tick(2);
 }
 assert(h.chat.some(line=>line.text.includes('AutoClicker (vl:1.0)')));
 h.events.disable();
});

test('watch links switch and restore the camera, keep one exit at the bottom, and report an unloaded target',()=>{
 const h=antiCheatHost();h.antiCheat.setEnabled(true);
 h.tick(41,.2);
 const link=h.chatLines.find(line=>line.component.text.includes('[观看玩家]')).component.parts.find(part=>part.click).click;
 link.run();assert.equal(h.mc.getCameraEntity(),h.entity);
 assert.equal(h.chatLines[0].component.text,'[退出观看]');
 h.tick(22,.2);
 assert.equal(h.chatLines[0].component.text,'[退出观看]');
 assert.equal(h.chatLines.filter(line=>line.component.text==='[退出观看]').length,1);
 h.chatLines[0].component.click.run();assert.equal(h.mc.getCameraEntity(),h.mc.player);
 assert(!h.chatLines.some(line=>line.component.text==='[退出观看]'));
 link.run();h.setLoaded(false);h.tick();
 assert.equal(h.mc.getCameraEntity(),h.mc.player);assert.match(h.messages.at(-1),/已退出观看/);
 link.run();assert.match(h.messages.at(-1),/该玩家已离开当前加载区域/);
 h.events.disable();link.run();assert.equal(h.mc.getCameraEntity(),h.mc.player);
});

test('Anti-cheat settings separate check VL, debounce flags, and apply the extra VL threshold',()=>{
 const h=antiCheatHost(), settings=h.antiCheat.settings;
 assert.deepEqual(Object.keys(settings).slice(2),['AutoBlock','LegitScaffold','Scaffold','ScaffoldBPS','TellyScaffold','NoSlow','Nuker','BedNuker','AirHover','GroundSpeed','AimAssist','AutoClicker','Blink','FastMine','NoFall','Protocol']);
 assert(settings.AimAssist.get() && settings.AutoClicker.get());
 for(const name of ['Blink','FastMine','NoFall','Protocol'])assert.equal(settings[name].get(),false);
 settings.extraVl.set(3);settings.Protocol.set(true);
 const events=[], unsubscribe=h.context.OpaiAntiCheat.onAntiCheatFlag((check,entity,event)=>{assert.equal(entity,h.entity);assert.equal(check,event.check);events.push(event);});
 h.antiCheat.setEnabled(true);
 for(let i=0;i<280&&h.chat.length<11;i++)h.tick(1,.2);
 assert.equal(events.at(-1).totalVl,11);
 assert.equal(h.chat.filter(line=>line.color===0xff5555).length,0);
 h.flight.ground=true;
 const pitch=(value,origin='incoming',cancelled=()=>false)=>h.packet(h.MovePacket,{hasRotation:()=>true,getXRot:()=>value,getEntity:()=>h.entity},origin,cancelled);
 pitch(95,'outgoing');pitch(95,'incoming',()=>true);pitch(90);h.tick();assert.equal(events.length,11);
 pitch(95);pitch(100);h.tick();assert.equal(events.length,12);
 assert.equal(events.at(-1).check,'Protocol');assert.equal(events.at(-1).vl,1);assert.equal(events.at(-1).totalVl,12);
 h.tick(21);pitch(96);h.tick();assert.equal(events.at(-1).totalVl,13);assert.equal(events.at(-1).threshold,13);assert(events.at(-1).alert);
 assert.equal(h.chat.filter(line=>line.color===0xff5555).length,3);
 assert.equal(JSON.parse(h.store.get('opai.bridge.antiCheatFlag')).sequence,13);
 assert.equal(JSON.parse(h.store.get('opai.bridge.antiCheatFlags')).length,13);
 unsubscribe();h.tick(21);pitch(96);h.tick();assert.equal(events.length,13);
 h.antiCheat.setEnabled(false);assert(!h.store.has('opai.bridge.antiCheatFlags'));assert(!h.hooks.some(hook=>hook.event==='PacketEvent'));
 h.events.disable();
});

test('OpenB4-style NoSlow, AimAssist, Blink, AutoClicker and NoFall require repeated or sustained evidence',()=>{
 const h=antiCheatHost(), settings=h.antiCheat.settings;
 h.flight.ground=true;h.antiCheat.setEnabled(true);
 for(const name of ['AimAssist','Blink','AutoClicker','NoFall'])settings[name].set(true);
 h.tick(24);
 h.flight.blocking=true;h.tick(7,.18);h.flight.blocking=false;h.tick(2);
 assert(!h.chat.some(line=>line.text.includes('NoSlow')));
 h.flight.blocking=true;h.tick(20,.18);h.flight.blocking=false;h.flight.sprint=false;h.tick();
 assert(h.chat.some(line=>line.text.includes('NoSlow (vl:1.0)')));
 h.flight.yaw=176;
 for(let i=0;i<30;i++){h.flight.yaw+=2;if(h.flight.yaw>=180)h.flight.yaw-=360;h.tick();}
 assert(h.chat.some(line=>line.text.includes('AimAssist (vl:1.0)')));
 for(let i=0;i<12;i++){h.flight.swinging=true;h.tick();h.flight.swinging=false;h.tick(2);}
 assert(h.chat.some(line=>line.text.includes('AutoClicker (vl:1.0)')));
 h.flight.sprint=true;
 for(let n=0;n<2;n++){
  h.tick(4,.2);h.tick(8);
  h.packet(h.MovePacket,{hasRotation:()=>false});h.tick();h.tick(1,1);
 }
 assert(h.chat.some(line=>line.text.includes('Blink (vl:1.0)')));
 h.flight.sprint=false;h.flight.ground=false;h.tick(13,0,-.5);
 h.flight.ground=true;h.tick(5);assert(!h.chat.some(line=>line.text.includes('NoFall')));
 h.tick(10);assert(h.chat.some(line=>line.text.includes('NoFall (vl:1.0)')));
 h.events.disable();
});

test('Scaffold movement pattern requires distinct placements over open space while facing down',()=>{
 const h=antiCheatHost();h.antiCheat.setEnabled(true);h.flight.ground=true;h.flight.blockHeld=true;h.flight.swinging=true;
 h.flight.pitch=75;h.setTerrain('bridge');h.tick(27,.2);
 for(let i=0;i<40;i++){
  if(i%5===0)h.place(Math.floor(h.points.x)+1,0);
  h.tick(1,.2);
 }
 assert(h.chat.some(line=>line.text.includes('Scaffold (vl:1.0)')));h.events.disable();
});

test('mining checks correlate server removals with the matching player animation',()=>{
 const h=antiCheatHost();h.antiCheat.setEnabled(true);h.antiCheat.settings.FastMine.set(true);h.flight.ground=true;h.tick(24);
 const air={isAir:()=>true,isSolidRender:()=>false};
 const animation=(pos,progress,id=42)=>h.packet(h.BreakPacket,{getId:()=>id,getPos:()=>pos,getProgress:()=>progress});
 const remove=(pos,batch=false)=>{
  h.blocks.set(`${pos.getX()},${pos.getY()},${pos.getZ()}`,air);
  if(batch)h.packet(h.ChunkPacket,{runUpdates:callback=>callback(pos,air)});
  else h.packet(h.BlockPacket,{getPos:()=>pos,getBlockState:()=>air});
  h.tick();
 };
 remove(h.point(0,63,10));assert.deepEqual(h.chat,[]);
 for(let i=1;i<=3;i++){
  const pos=h.point(2*i,63,0);animation(pos,0);h.tick();animation(pos,7);h.tick();remove(pos,i%2===0);
 }
 assert(h.chat.some(line=>line.text.includes('Nuker (vl:1.0)')));
 assert(h.chat.some(line=>line.text.includes('FastMine (vl:1.0)')));
 const bed=new h.types.BedBlock();h.types.BedBlock.PART='part';
 for(const [x,part] of [[20,'foot'],[21,'head']])h.blocks.set(`${x},63,0`,{isAir:()=>false,isSolidRender:()=>false,getBlock:()=>bed,getDestroySpeed:()=>.2,getValue:property=>property==='part'?part:h.directions[0]});
 const pos=h.point(20,63,0);animation(pos,0);h.tick();animation(pos,6);h.tick();remove(pos,true);
 assert(h.chat.some(line=>line.text.includes('Bed Nuker (vl:1.0)')));
 h.events.disable();
});

test('local Scaffold BPS counts confirmed placements, rejects rollbacks and expires by original timestamp',()=>{
 const h=host(), recent=[], states=new Map(), pending=new Set();
 let enabled=false,predicting=false,legacy=false;
 const block={equals:other=>other===block};
 const stone={getBlock:()=>block,isAir:()=>false,equals:other=>other===stone};
 const air={getBlock:()=>({equals:()=>false}),isAir:()=>true};
 const prediction={isPredicting:()=>!legacy&&predicting,getClass:()=>({getSimpleName:()=>legacy?'PendingUpdateManager1_18_2':'BlockStatePredictionHandler'})};
 const field=value=>({setAccessible(){},get:()=>value});
 Object.assign(h.types,{
  ModuleScaffold:{INSTANCE:{getEnabled:()=>enabled}},
  ScaffoldMovementPlanner:{class:{getDeclaredField:()=>field({iterator:()=>{let i=0;return{hasNext:()=>i<recent.length,next:()=>recent[i++]};}})}},
  BlockStatePredictionHandler:{class:{getDeclaredField:()=>field(pending)}},
  MixinClientLevelAccessor:{class:{getMethod:()=>({invoke:()=>prediction})}},
  Thread:{currentThread:()=>({getStackTrace:()=>[]})},
 });
 pending.containsKey=key=>pending.has(key);
 h.mc.level.getBlockState=pos=>states.get(pos.asLong())??air;
 const pos=id=>({getX:()=>id,getY:()=>63,getZ:()=>0,asLong:()=>id});
 const toggle=value=>{h.emit('ModuleToggleEvent',{getModuleName:()=> 'Scaffold',getEnabled:()=>value});enabled=value;};
 const place=(id,scaffold=true)=>{
  const position=pos(id);states.set(id,stone);predicting=true;
  h.emit('BlockChangeEvent',{getBlockPos:()=>position,getNewState:()=>stone});
  predicting=false;pending.add(id);if(scaffold)recent.push(position);
 };
 const tick=(n=1)=>{for(let i=0;i<n;i++)h.emit('GameTickEvent',{});};
 const bps=()=>JSON.parse(h.store.get('opai.bridge.snapshot')).scaffoldBps;
 h.events.enable();toggle(true);tick(5);assert.equal(bps(),0);
 place(1);place(2);place(3);place(4,false);tick(5);assert.equal(bps(),0);
 pending.clear();states.delete(3);tick(5);assert.equal(bps(),1);
 place(5);tick(5);h.advance(2200);pending.delete(5);tick();assert.equal(bps(),0);
 toggle(false);tick(5);assert.equal(bps(),null);assert(!h.hooks.some(hook=>hook.event==='BlockChangeEvent'));
 legacy=true;toggle(true);tick(5);
 place(6);place(7);tick(5);assert.equal(bps(),0);
 h.emit('ChunkDeltaUpdateEvent',{getPacket:()=>({runUpdates:callback=>callback(pos(6),stone)})});
 tick(5);assert.equal(bps(),.5);
 toggle(false);tick(5);assert.equal(bps(),null);assert(!h.hooks.some(hook=>hook.event==='ChunkDeltaUpdateEvent'));
 h.events.disable();
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
 const h=host();h.mc.getCurrentServer=()=>{throw new Error('unavailable address');};h.events.enable();const state=JSON.parse(h.store.get('opai.bridge.snapshot'));assert.equal(state.ping,null);assert.equal(state.serverAddress,'203.0.113.10');assert.equal(state.capabilities.preview,true);h.events.disable();
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
 const h=host(9,true);h.mc.level.getBiome=()=>{throw new Error('optional metadata unavailable');};h.events.enable();const state=JSON.parse(h.store.get('opai.bridge.snapshot'));assert.equal(state.worldInfo.biome,null);assert.equal(state.ping,37);assert.equal(state.serverAddress,'play.example.org:25565');assert.equal(state.capabilities.preview,true);h.events.disable();
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
test('stable native labels retain their measured layout across frames and ticks',()=>{
 const h=host();h.events.enable();h.emit('GameTickEvent',{});const event={getTickDelta:()=>.5,getContext:()=>h.ctx};for(let i=0;i<120;i++)h.emit('OverlayRenderEvent',event);assert.equal(h.counters.widths,4);assert.equal(h.draws.filter(x=>x[0]==='text').length,480);h.emit('GameTickEvent',{});h.emit('OverlayRenderEvent',event);assert.equal(h.counters.widths,4);h.events.disable();
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

test('ICMP uses the connected peer and clears on toggle, timeout and unload', () => {
 const h=host(9,true);
 h.events.enable();
 assert.deepEqual(h.icmp.samples,['203.0.113.10']);
 assert.equal(JSON.parse(h.store.get('opai.bridge.snapshot')).ping,37);
 h.icmp.result=null;
 h.advance(300);
 h.emit('GameTickEvent',{});
 assert.equal(JSON.parse(h.store.get('opai.bridge.snapshot')).ping,null);
 h.store.set('opai.preferences',JSON.stringify({icmpPing:false}));
 const samples=h.icmp.samples.length;
 h.advance(300);
 h.emit('GameTickEvent',{});
 assert.equal(h.icmp.samples.length,samples);
 assert.equal(h.icmp.resets,1);
 h.events.disable();
 assert.equal(h.icmp.closes,1);
});

test('friend pill follows the host friend list without changing protected names', () => {
 const h=host();
 h.friends.add(h.entity);
 h.events.enable();
 h.emit('GameTickEvent',{});
 const overlay={getTickDelta:()=>.5,getContext:()=>h.ctx};
 h.emit('OverlayRenderEvent',overlay);
 assert.deepEqual(h.draws.filter(draw=>draw[0]==='text').map(draw=>draw[2].text),['♥','20','ProtectedName','Friend','65m']);
 h.friends.clear();
 h.draws.length=0;
 h.advance(500);
 h.emit('GameTickEvent',{});
 h.emit('OverlayRenderEvent',overlay);
 assert.deepEqual(h.draws.filter(draw=>draw[0]==='text').map(draw=>draw[2].text),['♥','20','ProtectedName','65m']);
 h.events.disable();
});
