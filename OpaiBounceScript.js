// Opai theme bridge, protocol 1. Registers the native TritiumMusic module.
// Host contract: supplied LiquidBounce Nextgen 0.41.1 / Minecraft 26.3 + official Script API add-on.
// Render arguments are float32 exact for GraalJS. Rounded rectangles support both host signatures.
// Screen heartbeats keep telemetry and preview alive while the singleplayer world is paused.
(function () {
    'use strict';
    const VERSION = '1.5.0', PREFIX = 'opai.bridge.';
    function decode(value) { try { return value == null ? null : JSON.parse(String(value)); } catch (_) { return null; } }
    function previewRequest(value, now, width, height) {
        const data = decode(value), r = data && data.rect;
        if (!data || data.protocol !== 1 || !['esp','playeresp','nametags'].includes(String(data.module).toLowerCase()) || !r || !data.viewport || !Number.isFinite(data.at) || now-data.at > 1400 || data.at-now > 1000) return null;
        if (![r.x,r.y,r.width,r.height,data.viewport.width,data.viewport.height].every(Number.isFinite) || r.width < 20 || r.height < 40 || data.viewport.width < 1 || data.viewport.height < 1) return null;
        const sx=width/data.viewport.width,sy=height/data.viewport.height;
        const x=Math.max(0,r.x*sx),y=Math.max(0,r.y*sy),right=Math.min(width,(r.x+r.width)*sx),bottom=Math.min(height,(r.y+r.height)*sy);
        return right-x>=20 && bottom-y>=40 ? {...data,rect:{x,y,width:right-x,height:bottom-y},options:data.options||{}} : null;
    }
    function healthColor(health) { return health>=14?0x80d900:health>=8?0xffc83d:0xff615b; }
    // Keep the validation functions usable by the standalone Node regression harness.
    if (typeof registerScript !== 'function') { if(typeof module!=='undefined')module.exports={decode,previewRequest,healthColor}; return; }
    const script=registerScript({name:'OpaiBridge',version:VERSION,authors:['Opai theme contributors']});
    const type=name=>Java.type(name), client=mc;
    const EventManager=type('net.ccbluex.liquidbounce.event.EventManager').INSTANCE;
    const EventHook=type('net.ccbluex.liquidbounce.event.EventHook');
    const Listener=Java.extend(type('net.ccbluex.liquidbounce.event.EventListener'));
    const Consumer=type('java.util.function.Consumer');
    const Component=type('net.minecraft.network.chat.Component');
    const Storage=type('net.ccbluex.liquidbounce.integration.interop.persistant.PersistentLocalStorage').INSTANCE;
    // Scripts enable BEFORE ConfigSystem.loadAll(). Loading storage.json replaces
    // the map instance. Resolve it for every operation, including config reloads.
    function storage(){return Storage.getMap();}
    const OverlayEvent=type('net.ccbluex.liquidbounce.event.events.OverlayRenderEvent');
    const ScreenEvent=type('net.ccbluex.liquidbounce.event.events.ScreenRenderEvent');
    const TickEvent=type('net.ccbluex.liquidbounce.event.events.GameTickEvent');
    const ModuleToggleEvent=type('net.ccbluex.liquidbounce.event.events.ModuleToggleEvent');
    const ShutdownEvent=type('net.ccbluex.liquidbounce.event.events.ClientShutdownEvent');
    const Tags=type('net.ccbluex.liquidbounce.features.module.modules.render.nametags.ModuleNametags');
    const NativeTags=Tags.INSTANCE;
    const Entities=type('net.ccbluex.liquidbounce.utils.entity.RenderedEntities').INSTANCE;
    const Entity=type('net.ccbluex.liquidbounce.utils.entity.EntityExtensionsKt');
    const Projection=type('net.ccbluex.liquidbounce.utils.render.WorldToScreen');
    const Fonts=type('net.ccbluex.liquidbounce.render.FontManager');
    const Graphics=type('net.ccbluex.liquidbounce.render.Render2DKt');
    const Color=type('net.ccbluex.liquidbounce.render.engine.type.Color4b');
    const Inventory=type('net.minecraft.client.gui.screens.inventory.InventoryScreen');
    const ESP=type('net.ccbluex.liquidbounce.features.module.modules.render.esp.ModuleESP').INSTANCE;
    const System=type('java.lang.System');
    let active=false,owner=null,hooks=[],originalHook=null,tookTags=false,originalEnabled=false,changedByUser=false,changing=false;
    let lastPublish=0,lastPreviewError=0,records=[],request=null,features={serverInfo:true,nametags:true,preview:true};
    let errors=[],tagFailed=false,previewFailed=false;
    // Both host signatures exist in released builds; resolve once, not per primitive.
    let roundedArity=9;
    try { for (const method of Graphics.class.getMethods()) if(String(method.getName())==='drawRoundedRect'&&[9,10].includes(method.getParameterCount())) roundedArity=method.getParameterCount(); } catch (_) {}
    const background=new Color(17,27,33,190),white=new Color(237,224,222,255),grey=new Color(154,158,160,255),transparent=new Color(0);
    const now=()=>Number(System.currentTimeMillis());
    let music=null,musicLoader=null,musicDescriptor=null,musicModule=null,musicValues=null,lastMusicConfig='',pendingMusicOpen=false,worldLyricsEnabled=false,worldDirty=false,worldHook=null,worldEvent=null,renderPaused=false;
    function registerMusicModule(){
        const Setting=type('net.ccbluex.liquidbounce.script.bindings.features.ScriptSetting').INSTANCE;
        const bool=(name,value)=>Setting.boolean({name,default:value});
        musicValues={island:bool('IslandMusic',true),islandLyrics:bool('IslandLyrics',true),info:bool('MusicInfo',true),lyrics:bool('MusicLyrics',true),spectrum:bool('MusicSpectrum',true),translation:bool('Translation',true),lyricsMode:Setting.choose({name:'LyricsMode',default:'HUD',choices:['HUD','Dango3D']}),distance:Setting.float({name:'LyricDistance',default:10,range:[3,40]}),scale:Setting.float({name:'LyricScale',default:1,range:[.5,3]}),spread:Setting.float({name:'LyricSpread',default:30,range:[0,60]}),wordPop:bool('WordPop',true),wiggle:bool('Wiggle',true)};
        script.registerModule({name:'TritiumMusic',category:'Misc',description:'Tritium Music player, music HUDs and Dango 3D world lyrics. Left click to open the player; right click for settings.',settings:musicValues},m=>{musicModule=m;m.on('enable',()=>{pendingMusicOpen=true;m.setEnabled(false);if(client.gui.screen()==null){try{type('net.ccbluex.liquidbounce.features.module.modules.render.ModuleClickGui').INSTANCE.onEnabled();}catch(error){warn('Music screen',error);}}});});
    }
    function syncMusicModule(){
        if(!music||!musicModule)return;
        try{
            const mode=musicValues.lyricsMode.get(),value=typeof mode.getTag==='function'?String(mode.getTag()):String(mode);
            const widgets={};for(const key of ['island','islandLyrics','info','lyrics','spectrum','translation'])widgets[key]=!!musicValues[key].get();
            const config=JSON.stringify({enabled:true,widgets,lyricsMode:value,distance:Number(musicValues.distance.get()),scale:Number(musicValues.scale.get()),spread:Number(musicValues.spread.get()),wordPop:!!musicValues.wordPop.get(),wiggle:!!musicValues.wiggle.get()});
            if(config!==lastMusicConfig){music.configureModule(config);lastMusicConfig=config;}
            worldLyricsEnabled=value==='Dango3D'&&widgets.lyrics;
            syncWorldListener(worldLyricsEnabled&&!renderPaused);
            if(pendingMusicOpen){pendingMusicOpen=false;music.openPlayer();}
        }catch(error){warn('Music module',error);}
    }
    const worldLayouts=new Map();let worldTypes=null;
    function clearWorldScene(){if(worldDirty){music.clearWorldLyrics();worldDirty=false;worldLayouts.clear();}}
    function syncWorldListener(enabled){
        if(enabled&&!worldHook){
            try{worldEvent=type('net.ccbluex.liquidbounce.event.events.WorldFeatureSubmitEvent');worldHook=hook(worldEvent,-1000,drawWorldLyrics);}catch(error){warn('3D Lyrics',error);}
        }else if(!enabled&&worldHook){
            EventManager.unregisterEventHook(worldEvent.class,worldHook);hooks=hooks.filter(pair=>pair[1]!==worldHook);worldHook=null;clearWorldScene();
        }
    }
    function drawWorldLyrics(event){
        if(!active||!music||!musicModule)return;
        try{
            // Ordinary HUD mode must not enter Java/Gson or inspect the camera each frame.
            if(!worldLyricsEnabled||!client.player||!client.level||client.gui.screen()!=null){clearWorldScene();return;}
            worldDirty=true;
            if(!worldTypes)worldTypes={render:type('net.ccbluex.liquidbounce.render.Render3DKt'),mode:type('net.minecraft.client.gui.Font$DisplayMode').SEE_THROUGH};
            const camera=event.getCamera(),pos=camera.position(),scene=JSON.parse(String(music.worldLyrics(pos.x,pos.y,pos.z,camera.yRot(),camera.xRot()))),pose=event.getPoseStack(),f=client.font;
            for(const piece of scene){
                let layout=worldLayouts.get(piece.key);if(!layout){layout=piece.lines.map(line=>{const chars=Array.from(line);let x=0;const widths=chars.map(c=>f.width(c));const total=widths.reduce((a,b)=>a+b,0);return chars.map((c,i)=>{const entry={component:Component.literal(c).getVisualOrderText(),x:x-total/2,width:widths[i]};x+=widths[i];return entry;});});worldLayouts.set(piece.key,layout);if(worldLayouts.size>12)worldLayouts.delete(worldLayouts.keys().next().value);}
                pose.pushPose();try{pose.translate(piece.x-pos.x,piece.y-pos.y,piece.z-pos.z);pose.rotate(camera.rotation());pose.scale(f32(piece.scale),f32(-piece.scale),f32(piece.scale));
                    for(const glyph of piece.glyphs){if(glyph.alpha<.02)continue;const item=layout[glyph.row]?.[glyph.col];if(!item)continue;pose.pushPose();try{pose.translate(f32(item.x+item.width/2+glyph.dx),f32((glyph.row-piece.lines.length/2)*11+4+glyph.dy),f32(0));pose.scale(f32(glyph.pop),f32(glyph.pop),f32(1));const color=((Math.round(Math.max(0,Math.min(1,glyph.alpha))*255)<<24)|0xf7e1d7)|0;worldTypes.render.submitTextAlwaysOnTop(event.getSubmitNodeStorage(),pose,f32(-item.width/2),f32(-4),item.component,true,worldTypes.mode,15728880,color,0,0);}finally{pose.popPose();}}
                }finally{pose.popPose();}
            }
        }catch(error){warn('3D Lyrics',error);}
    }
    try{registerMusicModule();}catch(error){warn('Music module registration',error);}
    function startMusic(){
        let found=false;
        try{
            const File=type('java.io.File'),Config=type('net.ccbluex.liquidbounce.config.ConfigSystem').INSTANCE;
            const root=Config.getRootFolder(),jar=new File(root,'themes/opai/music/OpaiMusicService.jar');
            if(!jar.isFile())return;found=true;
            const URLClassLoader=type('java.net.URLClassLoader');
            musicLoader=new URLClassLoader(Java.to([jar.toURI().toURL()],'java.net.URL[]'),Config.getClass().getClassLoader());
            const service=musicLoader.loadClass('opai.music.MusicService');
            music=service.getMethod('start',type('java.lang.String').class).invoke(null,String(new File(root,'opai-music').getAbsolutePath()));
            musicDescriptor=String(service.getMethod('descriptor').invoke(music));
            if(/^1\.[01]\./.test(JSON.parse(musicDescriptor).version??''))throw new Error('Please update the complete theme music folder to service 1.2.0 before using bridge 1.4.0.');
        }catch(error){if(found)warn('Music',error);stopMusic();}
    }
    function stopMusic(){try{if(music)music.getClass().getMethod('close').invoke(music);}catch(_){}music=null;musicDescriptor=null;try{if(musicLoader)musicLoader.close();}catch(_){}musicLoader=null;storage().remove(PREFIX+'music');}
    function warn(feature,error){const text=feature+': '+String(error);if(!errors.some(x=>x.startsWith(feature+':'))){errors.push(text);Client.displayChatMessage('§c[OpaiBridge] '+text);}}
    function hook(event,priority,callback){const h=new EventHook(owner,priority,new Consumer(callback));EventManager.registerEventHook(event.class,h);hooks.push([event.class,h]);return h;}
    function font(){const face=Fonts.INSTANCE.fontFace('Google Sans Bold');return face?face.getRenderer():Fonts.getFONT_RENDERER();}
    // GraalJS forbids lossy JS double -> Java float conversions. Math.fround produces
    // a float32-exact JavaScript Number, so Kotlin/Java float overloads can accept it.
    // Unlike boxing every coordinate as java.lang.Float, this does not allocate Java objects.
    function f32(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) throw new TypeError('Invalid render coordinate: ' + value);
        return Math.fround(number);
    }
    // LiquidBounce 0.41.0 / current 0.41.1 build: 9 arguments total (including ctx).
    // The 10-argument signature with fillBottomColor exists only in later source revisions.
    function rounded(ctx,x,y,w,h,color,radius){const args=[ctx,f32(x),f32(y),f32(x+w),f32(y+h),f32(radius),color];if(roundedArity===10)args.push(null);args.push(transparent,f32(0));Graphics.drawRoundedRect(...args);}
    function quad(ctx,x,y,w,h,color){Graphics.drawQuad(ctx,f32(x),f32(y),f32(x+w),f32(y+h),color,transparent);}
    function quadOutline(ctx,x1,y1,x2,y2,color){Graphics.drawQuad(ctx,f32(x1),f32(y1),f32(x2),f32(y2),null,color);}
    function text(ctx,f,component,x,y,color,scale){f.draw(ctx,component,f32(x),f32(y),color,false,f32(scale),null,null);}
    function health(entity){return Math.max(0,Math.floor(Entity.getActualHealth(entity,true)+(Entity.hasHealthScoreboard(entity)?0:entity.getAbsorptionAmount())));}
    function prepare(entity,distance){const hp=health(entity),meters=Math.round(distance);return {entity,health:hp,distance:meters,name:Entity.getSimpleDisplayName(entity),healthText:Component.literal(String(hp)),distanceText:Component.literal(meters+'m')};}
    function drawPills(ctx,record,cx,cy,tagScale,f=font()){
        let layout=record.pills;
        if(!layout||layout.scale!==tagScale){
            const base=f.getScaleToVanillaFont()*tagScale,h=f.getHeight()*base;
            const parts=[{component:record.healthText,color:new Color(0xff000000|healthColor(record.health)),scale:.85,heart:true},
                {component:record.name,color:white,scale:1,heart:false},{component:record.distanceText,color:grey,scale:.85,heart:false}];
            for(const p of parts)p.width=f.getStringWidth(p.component,f32(base*p.scale),false)+h*.6+(p.heart?h*.8:0);
            layout=record.pills={font:f,scale:tagScale,base,h,parts,total:parts.reduce((sum,p)=>sum+p.width,0)+h*.24};
        }
        const {base,h,parts,total}=layout;let left=cx-total/2;
        for(const p of parts){rounded(ctx,left,cy-h*.775,p.width,h*1.55,background,h*.775);let tx=left+h*.3;
            if(p.heart){const unit=h*.09,hx=tx+unit*3.5,hy=cy-unit*3.5;quad(ctx,hx-unit*3,hy,unit*2,unit,p.color);quad(ctx,hx+unit,hy,unit*2,unit,p.color);quad(ctx,hx-unit*4,hy+unit,unit*8,unit*2,p.color);
                for(let row=3;row<=6;row++){const half=(7-row)*unit;quad(ctx,hx-half,hy+row*unit,half*2,unit,p.color);}tx+=h*.8;}
            text(ctx,f,p.component,tx,cy-h*p.scale/2,p.color,base*p.scale);left+=p.width+h*.12;
        }
    }
    function claimTags(){
        if(tookTags)return;
        const field=Tags.class.getDeclaredField('overlayRenderHandler');field.setAccessible(true);const existing=field.get(NativeTags);
        originalEnabled=NativeTags.getEnabled();originalHook=existing;changedByUser=false;
        EventManager.unregisterEventHook(OverlayEvent.class,existing);tookTags=true;
        changing=true;try{if(!originalEnabled)NativeTags.setEnabled(true);}finally{changing=false;}
    }
    function restoreTags(){
        if(!tookTags)return;
        EventManager.registerEventHook(OverlayEvent.class,originalHook);tookTags=false;
        if(!changedByUser){changing=true;try{NativeTags.setEnabled(originalEnabled);}finally{changing=false;}}
        originalHook=null;records=[];
    }
    function readFeatures(){const data=decode(storage().get(PREFIX+'features'));if(data&&data.protocol===1)for(const key of ['serverInfo','nametags','preview'])if(typeof data[key]==='boolean')features[key]=data[key];
        if(features.nametags&&!tagFailed){try{claimTags();}catch(error){tagFailed=true;warn('Nametags',error);restoreTags();}}
        else restoreTags();
    }
    // Activity runs at tick cadence, never from a new per-frame world callback.
    let bedModule,packetMine,bedProvider,blockRegistry;
    let activityTypes=null,activityMenu=null,activityEpoch=0,activitySlots=[],activityFeedback=[],activityContainer=null,activityClosedAt=0,lastActivitySample=0,lastActivityWrite=0,activityHadState=false,activityMouseHook=null,activityMouseEvent=null,lastContainerCommand='',lastContainerInput={slot:-1,at:0};
    function activityNative(){
        if(!activityTypes)activityTypes={registries:type('net.minecraft.core.registries.BuiltInRegistries'),chest:type('net.minecraft.world.inventory.ChestMenu'),screen:type('net.minecraft.client.gui.screens.inventory.ContainerScreen'),stealer:type('net.ccbluex.liquidbounce.features.module.modules.player.cheststealer.ModuleChestStealer').INSTANCE,input:type('net.minecraft.world.inventory.ContainerInput'),silent:type('net.ccbluex.liquidbounce.features.module.modules.player.cheststealer.features.FeatureSilentScreen').INSTANCE};
        return activityTypes;
    }
    function bedActivity(){
        if(!client.gameMode||!client.level||!client.player)return null;
        let progress=null,owned=false;
        try{if(bedModule===undefined)bedModule=type('net.ccbluex.liquidbounce.features.module.modules.world.fucker.ModuleFucker').INSTANCE;const module=bedModule;if(module.getEnabled()&&typeof module.breakingProgress==='function'){progress=module.breakingProgress();owned=progress!=null;}}catch(_){}
        if(!progress){try{if(packetMine===undefined)packetMine=type('net.ccbluex.liquidbounce.features.module.modules.world.packetmine.ModulePacketMine').INSTANCE;if(packetMine.getEnabled()&&typeof packetMine.breakingProgress==='function'){progress=packetMine.breakingProgress();owned=!!bedModule?.getEnabled();}}catch(_){}}
        if(!progress){try{if(bedProvider===undefined)bedProvider=type('net.ccbluex.liquidbounce.utils.render.BreakingProgress$Provider').Default;progress=bedProvider.breakingProgress();}catch(_){
            if(!client.gameMode.isDestroying())return null;
            const pos=client.gameMode['liquid_bounce$getDestroyBlockPos']();progress={pos:()=>pos,value:()=>client.gameMode.destroyProgress};
        }}
        if(!progress)return null;
        const pos=typeof progress.pos==='function'?progress.pos():progress.getPos(),value=Number(typeof progress.value==='function'?progress.value():progress.getValue());
        if(!Number.isFinite(value)||value<0)return null;
        const state=client.level.getBlockState(pos);if(state.isAir())return null;
        if(!blockRegistry)blockRegistry=type('net.minecraft.core.registries.BuiltInRegistries').BLOCK;
        const block=state.getBlock(),id=String(blockRegistry.getKey(block));
        if(!owned&&!id.endsWith('_bed'))return null;
        return {id,position:[Number(pos.getX()),Number(pos.getY()),Number(pos.getZ())],name:String(block.getName().getString()),progress:Math.max(0,Math.min(1,value))};
    }
    function containerView(){
        const view=decode(storage().get(PREFIX+'containerView'));
        return view&&view.protocol===1&&view.session===activityContainer?.session&&Number.isFinite(view.at)&&now()-view.at>=0&&now()-view.at<1400&&view.viewport&&view.rect&&[view.viewport.width,view.viewport.height,view.rect.x,view.rect.y,view.rect.width,view.rect.height].every(Number.isFinite)&&view.viewport.width>0&&view.viewport.height>0&&view.rect.width>0&&view.rect.height>0?view:null;
    }
    function takeContainerSlot(slot,x=.5,y=.5){
        if(!activityMenu||!activityContainer?.open||client.player?.containerMenu!==activityMenu||!Number.isInteger(slot)||slot<0||slot>=activitySlots.length||!activityTypes.stealer.getEnabled()||!(client.gui.screen() instanceof activityTypes.screen))return;
        if(lastContainerInput.slot===slot&&now()-lastContainerInput.at<150)return;
        if(activityMenu.getSlot(slot).getItem().isEmpty())return;
        lastContainerInput={slot,at:now()};activityFeedback.push({slot,at:now(),id:'click:'+activityEpoch+':'+now()+':'+slot,x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))});
        client.gameMode.handleContainerInput(activityMenu.containerId,slot,0,activityTypes.input.QUICK_MOVE,client.player);
    }
    function syncContainerMouse(enabled){
        if(enabled&&!activityMouseHook){
            activityMouseEvent=type('net.ccbluex.liquidbounce.event.events.MouseButtonEvent');
            activityMouseHook=hook(activityMouseEvent,-20000,event=>{try{
                if(event.getAction()!==1||event.getButton()!==0||!activityTypes.silent.getShouldHide())return;
                const view=containerView();if(!view)return;
                const win=client.getWindow(),x=client.mouseHandler.xpos()*view.viewport.width/win.getScreenWidth(),y=client.mouseHandler.ypos()*view.viewport.height/win.getScreenHeight(),r=view.rect;
                if(x<r.x||y<r.y||x>=r.x+r.width||y>=r.y+r.height)return;
                const column=Math.floor((x-r.x)/r.width*9),row=Math.floor((y-r.y)/r.height*activityContainer.rows);takeContainerSlot(row*9+column,(x-r.x)/r.width*9-column,(y-r.y)/r.height*activityContainer.rows-row);
            }catch(error){warn('Container input',error);}});
        }else if(!enabled&&activityMouseHook){EventManager.unregisterEventHook(activityMouseEvent.class,activityMouseHook);hooks=hooks.filter(pair=>pair[1]!==activityMouseHook);activityMouseHook=null;}
    }
    function chestActivity(){
        const menu=client.player?.containerMenu;
        if(menu){const native=activityNative();if(native.stealer.getEnabled()&&menu instanceof native.chest&&client.gui.screen() instanceof native.screen){
            const rows=Number(menu.getRowCount());if(!Number.isInteger(rows)||rows<1||rows>6)return null;
            if(menu!==activityMenu){activityMenu=menu;activityEpoch++;activitySlots=[];activityFeedback=[];lastContainerCommand='';}
            const stacks=[];
            for(let i=0;i<rows*9;i++){
                const stack=menu.getSlot(i).getItem(),empty=stack.isEmpty(),id=empty?'minecraft:air':String(native.registries.ITEM.getKey(stack.getItem())),count=empty?0:Number(stack.getCount());
                const before=activitySlots[i];if(before&&before.count>0&&(count<before.count||id!==before.identifier))activityFeedback.push({slot:i,at:now(),id:activityEpoch+':'+i+':'+now()+':'+activityFeedback.length});
                stacks.push({identifier:id,count,damage:empty?0:Number(stack.getDamageValue()),maxDamage:empty?0:Number(stack.getMaxDamage()),enchantments:{}});
            }
            activitySlots=stacks;activityFeedback=activityFeedback.filter(f=>now()-f.at<700).slice(-54);
            activityContainer={session:String(menu.containerId)+':'+activityEpoch,containerId:Number(menu.containerId),rows,stacks,feedback:activityFeedback,open:true,interactive:native.silent.getShouldHide()};activityClosedAt=0;syncContainerMouse(activityContainer.interactive);
            const command=decode(storage().get(PREFIX+'containerClick'));
            if(command&&command.id!==lastContainerCommand){lastContainerCommand=command.id;const view=containerView();if(view&&command.protocol===1&&command.owner===view.owner&&command.session===view.session&&Number.isFinite(command.at)&&now()-command.at>=0&&now()-command.at<1000)takeContainerSlot(command.slot);}
            return activityContainer;
        }}
        syncContainerMouse(false);activityMenu=null;
        if(activityContainer){if(!activityClosedAt)activityClosedAt=now();if(now()-activityClosedAt<450){activityContainer={...activityContainer,open:false,interactive:false};return activityContainer;}}
        activitySlots=[];activityFeedback=[];activityContainer=null;return null;
    }
    function activityTick(){
        if(now()-lastActivitySample<50)return;lastActivitySample=now();let breaking=null,container=null;
        if(client.player&&client.level){try{breaking=bedActivity();}catch(error){warn('Breaking activity',error);}try{container=chestActivity();}catch(error){warn('Container activity',error);syncContainerMouse(false);activityMenu=null;activityContainer=null;}}
        else{syncContainerMouse(false);activityMenu=null;activityContainer=null;activitySlots=[];activityFeedback=[];}
        const present=!!(breaking||container);
        if((present&&now()-lastActivityWrite>=100)||(!present&&activityHadState)){
            storage().put(PREFIX+'activity',JSON.stringify({protocol:1,at:now(),breaking,container}));lastActivityWrite=now();
        }
        activityHadState=present;
    }
    function worldInfo(){
        if(!client.player||!client.level)return null;
        let biome=null,dimension=null;
        try{const key=client.level.getBiome(client.player.blockPosition()).unwrapKey().orElse(null);if(key)biome=String(key.identifier());}catch(_){}
        try{dimension=String(client.level.dimension().identifier());}catch(_){}
        return {biome,dimension};
    }
    function publish(){
        syncMusicModule();
        if(musicDescriptor)storage().put(PREFIX+'music',musicDescriptor);
        let serverAddress=null,serverIP=null,ping=null,singleplayer=false;const inWorld=client.player!=null&&client.level!=null;
        try{singleplayer=inWorld&&client.hasSingleplayerServer();}catch(_){}
        if(features.serverInfo&&inWorld){
            // Each optional datum is independent: a mapping/connection failure must not
            // suppress the entire heartbeat (including the preview capability).
            try{const server=client.getCurrentServer();if(server&&server.ip)serverAddress=String(server.ip);}catch(error){warn('Server',error);}
            const connection=client.getConnection();
            try{const remote=connection&&connection.getConnection().getRemoteAddress(),address=remote&&remote.getAddress();if(address)serverIP=String(address.getHostAddress());}catch(_){}
            try{const info=connection&&connection.getPlayerInfo(client.player.getUUID());if(info){const latency=Number(info.getLatency());if(Number.isFinite(latency)&&latency>=0)ping=latency;}}catch(error){warn('Ping',error);}
            if(!serverAddress&&serverIP)serverAddress=serverIP;
        }
        lastPublish=now();
        storage().put(PREFIX+'snapshot',JSON.stringify({protocol:1,version:VERSION,at:lastPublish,connected:active,inWorld,singleplayer,serverAddress,serverIP,ping,worldInfo:worldInfo(),
            capabilities:{activity:true,serverInfo:features.serverInfo,nametags:tookTags&&!tagFailed,preview:features.preview},previewError:previewFailed?errors.find(x=>x.startsWith('Preview:')):null,errors}));
    }
    function heartbeat(){activityTick();if(now()-lastPublish>=250){const probe=decode(storage().get(PREFIX+'renderProbe'));renderPaused=!!(probe&&probe.protocol===1&&probe.paused===true&&Number.isFinite(probe.at)&&now()-probe.at>=0&&now()-probe.at<2000);readFeatures();publish();}}
    function readPreview(){const win=client.getWindow();request=previewRequest(storage().get(PREFIX+'preview'),now(),win.getGuiScaledWidth(),win.getGuiScaledHeight());}
    function tick(){
        if(!active)return;
        try{heartbeat();readPreview();
            records=[];if(renderPaused||!tookTags||!NativeTags.getEnabled()||!client.player||!client.level||client.gui.screen()!=null)return;
            const camera=client.gameRenderer.mainCamera().position(),it=Entities.iterator();
            while(it.hasNext()){const entity=it.next();if(entity===client.player||!entity.isAlive())continue;const distance=entity.position().distanceTo(camera);if(distance<=128)records.push(prepare(entity,distance));}
            records.sort((a,b)=>a.distance-b.distance);records=records.slice(0,128).reverse();
        }catch(error){warn('Tick',error);}
    }
    function drawTags(event){
        if(!active||renderPaused||!tookTags||tagFailed||!records.length||!NativeTags.getEnabled()||client.gui.screen()!=null)return;
        try{const f=font(),delta=event.getTickDelta(),ctx=event.getContext();for(const record of records){const entity=record.entity;if(!entity.isAlive())continue;
                const pos=Entity.interpolateCurrentPosition(entity,delta).add(0,entity.getEyeHeight(entity.getPose())+.55,0);
                const screen=Projection.calculateScreenPos(pos);if(screen&&screen.z()>=-1&&screen.z()<=1)drawPills(ctx,record,screen.x(),screen.y(),1,f);
            }}catch(error){tagFailed=true;warn('Nametags',error);restoreTags();publish();}
    }
    function drawPreview(event){
        if(!active)return;
        try{heartbeat();readPreview();}catch(error){warn('Bridge',error);return;}
        if(renderPaused||!features.preview||!request||!client.player||client.gui.screen()==null||(previewFailed&&now()-lastPreviewError<1000))return;
        try{const ctx=event.getContext(),r=request.rect,scale=Math.max(8,Math.floor(r.height*.42)),cx=r.x+r.width/2;
            // The real current player model and equipped items, clipped to the theme's measured body rectangle.
            Inventory.extractEntityInInventoryFollowsMouse(ctx,Math.floor(r.x),Math.floor(r.y),Math.ceil(r.x+r.width),Math.ceil(r.y+r.height),scale,f32(.0625),f32(cx),f32(r.y+r.height*.4),client.player);
            const data=prepare(client.player,0),top=r.y+r.height*.12,bottom=r.y+r.height*.92,boxWidth=r.height*.31;
            drawPills(ctx,data,cx,Math.max(r.y+8,top-9),.8);
            if(String(request.module).toLowerCase()!=='nametags'){
                const color=ESP.getColor(client.player),opt=request.options;
                const selected=Object.entries(opt).find(([key,value])=>/^(boxcolor|color)$/i.test(key)&&typeof value==='number');
                const line=selected?new Color(Number(selected[1])|0):color;
                if(opt.Box!==false&&opt.Outline!==false){if(opt.Border!==false&&opt.BoxOutline!==false)quadOutline(ctx,cx-boxWidth/2-1,top-1,cx+boxWidth/2+1,bottom+1,new Color(0,0,0,255));quadOutline(ctx,cx-boxWidth/2,top,cx+boxWidth/2,bottom,line);}
                if(opt.HealthBar!==false){quad(ctx,cx-boxWidth/2-3,top,1,bottom-top,background);quad(ctx,cx-boxWidth/2-3,bottom-(bottom-top)*Math.min(1,data.health/Math.max(1,client.player.getMaxHealth())),1,(bottom-top)*Math.min(1,data.health/Math.max(1,client.player.getMaxHealth())),new Color(128,217,0,255));}
            }
            if(previewFailed){previewFailed=false;errors=errors.filter(x=>!x.startsWith('Preview:'));publish();}
        }catch(error){previewFailed=true;lastPreviewError=now();request=null;warn('Preview',error);publish();}
    }
    function stop(){
        pendingMusicOpen=false;lastMusicConfig='';worldLyricsEnabled=false;worldDirty=false;worldHook=null;worldEvent=null;renderPaused=false;worldTypes=null;worldLayouts.clear();stopMusic();
        activityMenu=null;activityContainer=null;activitySlots=[];activityFeedback=[];activityMouseHook=null;activityTypes=null;bedModule=packetMine=bedProvider=blockRegistry=undefined;activityHadState=false;lastActivitySample=0;lastActivityWrite=0;storage().remove(PREFIX+'activity');storage().remove(PREFIX+'containerView');storage().remove(PREFIX+'containerClick');
        active=false;for(const [event,h] of hooks)EventManager.unregisterEventHook(event,h);hooks=[];
        restoreTags();request=null;records=[];storage().remove(PREFIX+'snapshot');storage().remove(PREFIX+'preview');owner=null;
    }
    script.on('enable',()=>{
        if(active)return;active=true;lastPublish=0;lastPreviewError=0;tagFailed=previewFailed=false;errors=[];
        owner=new Listener({getRunning:()=>active,getDebugOwnerId:()=>'OpaiBridge'});
        try{hook(TickEvent,-500,tick);hook(OverlayEvent,-2000,drawTags);hook(ScreenEvent,-30000,drawPreview);hook(ShutdownEvent,30000,stop);
            hook(ModuleToggleEvent,-1000,event=>{if(tookTags&&!changing&&String(event.getModuleName()).toLowerCase()==='nametags')changedByUser=true;});
            startMusic();readFeatures();publish();Client.displayChatMessage('§a[OpaiBridge] Loaded. TritiumMusic registered.');
        }catch(error){warn('Startup',error);stop();}
    });
    script.on('disable',stop);
})();
