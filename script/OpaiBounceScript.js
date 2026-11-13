// Opai theme bridge, protocol 1. Registers native TritiumMusic and Anti-cheat modules.
// Host contract: supplied LiquidBounce Nextgen 0.41.1 / Minecraft 26.3 + official Script API add-on.
// Render arguments are float32 exact for GraalJS. Rounded rectangles support both host signatures.
// Screen heartbeats keep telemetry and preview alive while the singleplayer world is paused.
(function () {
    'use strict';
    const VERSION = '1.9.1', PREFIX = 'opai.bridge.';
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
    const VL_BASELINE = 10, VL_DECAY_MS = 30_000, SCAFFOLD_WINDOW = 2000;
    const CHECK_DEFAULTS = {
        AutoBlock:true, LegitScaffold:true, Scaffold:true, ScaffoldBPS:true, TellyScaffold:true, NoSlow:true, Nuker:true, BedNuker:true,
        AirHover:true, GroundSpeed:true, AimAssist:true, AutoClicker:true, Blink:false, FastMine:false, NoFall:false, Protocol:false,
    };

    function checkKey(name) { return name.replace(/ /g, ''); }
    function flagDetail(value, unit='') { return Number(value).toFixed(2) + unit; }
    function yawDelta(current, previous) { return ((current - previous + 180) % 360 + 360) % 360 - 180; }

    function movementCheck(previous, current, elapsed) {
        const dx = current.x - previous.x, dy = current.y - previous.y, dz = current.z - previous.z;
        const horizontal = Math.hypot(dx, dz);
        if (elapsed > 350 || horizontal > 6 || Math.abs(dy) > 3) return null;
        if (previous.air && current.air && Math.abs(dy) <= .025 && horizontal >= .15) return 'Air Hover';
        if (previous.ground && current.ground && Math.abs(dy) <= .08
            && horizontal * 1000 / elapsed > Math.max(10, current.speed * 80)) return 'Ground Speed';
        return null;
    }

    function decayVl(state, timestamp) {
        for (const [name, entry] of state.checks) {
            const elapsed = Math.floor((timestamp - entry.decayAt) / VL_DECAY_MS);
            if (elapsed <= 0) continue;
            const amount = Math.min(entry.vl, elapsed);
            entry.vl -= amount;
            state.vl -= amount;
            entry.decayAt += elapsed * VL_DECAY_MS;
            if (!entry.vl) state.checks.delete(name);
        }
    }

    function clearEvidence(state) {
        state.movement = null;
        state.motion = null;
        state.lastPose = null;
        state.eagle = null;
        state.eagleCycles = [];
        state.builder = null;
        state.placements = [];
        state.lastBpsPlacement = null;
        state.rotation = null;
        state.noSlowSince = null;
        state.noSlowSample = null;
        state.aimSnaps = [];
        state.fall = null;
        state.landing = null;
        state.blink = null;
        state.scaffoldPattern = [];
        state.tellyJumps = [];
        state.occludedBreaks = [];
        state.fastBreaks = [];
    }
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
    const background=new Color(18,18,18,190),white=new Color(245,245,245,255),grey=new Color(168,168,168,255),transparent=new Color(0);
    const heartGlyph=Component.literal("♥"), friendLabel=Component.literal("Friend"), friendColor=new Color(130,235,145,255);
    const skullColor=new Color(255,82,86,255), skullEyes=new Color(30,19,22,255);
    let friendManager, tagWorld=null;
    const tagCache=new Map();
    let icmpProbe=null, icmpEnabled=true;
    const now=()=>Number(System.currentTimeMillis());
    let antiCheatModule=null, antiCheatValues=null, antiCheatTypes=null, antiCheatWorld=null, antiCheatPacketHook=null;
    const checkSettings={...CHECK_DEFAULTS};
    let totalAlertThreshold=VL_BASELINE + 1, flagIntervalMs=750;
    const antiCheatPlayers=new Map();
    const suspectStorageKey=PREFIX+'antiCheatMarks';
    let suspectScope=null, suspectSource=null, suspectMarks=new Set(), suspectTab=null;
    const markedTabEntries=new Map();
    const flagListeners=new Set(), miningAnimations=new Map(), breakEvidence=new Map(), ambiguousBreaks=new Map();
    const flagHistory=[];
    let pendingAntiCheatPackets=null, antiCheatLastTraffic=0, flagSequence=0;
    let watchActions=null, watching=null, watchWorldSequence=0;
    const watchMessageId='OpaiAntiCheat#watch';
    let scaffoldTypes=null, scaffoldWorld=null, scaffoldOn=false, scaffoldBps=null, scaffoldPrediction=null, legacyScaffold=false;
    let blockChangeHook=null, chunkDeltaHook=null, blockHookMode=0;
    const scaffoldPending=new Map(), scaffoldPlacements=[], remoteBlockUpdates=new Map();
    let music=null,musicLoader=null,musicDescriptor=null,musicModule=null,musicValues=null,lastMusicConfig='',pendingMusicOpen=false,worldLyricsEnabled=false,worldDirty=false,worldHook=null,worldEvent=null,renderPaused=false;

    function registerAntiCheatModule() {
        const Setting = type('net.ccbluex.liquidbounce.script.bindings.features.ScriptSetting').INSTANCE;
        antiCheatValues = {
            extraVl:Setting.int({name:'VLAbove10ToAlert', default:1, range:[1,990]}),
            flagInterval:Setting.float({name:'FlagIntervalSeconds', default:.75, range:[0,30]}),
        };
        for (const [name, enabled] of Object.entries(CHECK_DEFAULTS)) {
            // Old configurations explicitly saved these two experimental checks as false.
            const label = name === 'AimAssist' || name === 'AutoClicker' ? name + 'Detection' : name;
            antiCheatValues[name] = Setting.boolean({name:label, default:enabled});
        }
        script.registerModule({name:'Anti-cheat',category:'Misc',description:'Local player checks. Red alert and skull at 10 + VL Above 10 To Alert. The flag interval applies per player and check.',settings:antiCheatValues}, module => {
            antiCheatModule = module;
            module.on('enable', resetAntiCheat);
            module.on('disable', () => { stopAntiCheatPacketHook(); resetAntiCheat(); });
        });
    }

    function enabledCheck(name) { return checkSettings[checkKey(name)] === true; }

    function readAntiCheatSettings() {
        for (const name of Object.keys(CHECK_DEFAULTS)) checkSettings[name] = antiCheatValues[name].get() === true;
        totalAlertThreshold = VL_BASELINE + Number(antiCheatValues.extraVl.get());
        flagIntervalMs = Number(antiCheatValues.flagInterval.get()) * 1000;
    }

    // Optional in-process subscription. The persisted event is available to separate scripts.
    Object.defineProperty(globalThis, 'OpaiAntiCheat', {configurable:true, value:Object.freeze({
        onAntiCheatFlag(listener) {
            if (typeof listener !== 'function') throw new TypeError('Expected an Anti-cheat callback');
            flagListeners.add(listener);
            return () => flagListeners.delete(listener);
        },
    })});

    function resetAntiCheat() {
        stopWatching();
        watchWorldSequence++;
        antiCheatWorld = null;
        antiCheatPlayers.clear();
        clearTabMarks();
        suspectScope = null;
        suspectSource = null;
        suspectMarks = new Set();
        remoteBlockUpdates.clear();
        miningAnimations.clear();
        breakEvidence.clear();
        ambiguousBreaks.clear();
        pendingAntiCheatPackets?.clear();
        antiCheatLastTraffic = 0;
        flagHistory.length = 0;
        storage().remove(PREFIX+'antiCheatFlag');
        storage().remove(PREFIX+'antiCheatFlags');
        for (const record of records) {
            if (!record.suspect) continue;
            record.suspect = false;
            record.pills = null;
        }
    }

    function suspectServer(connection) {
        if (client.hasSingleplayerServer()) {
            const root = type('net.minecraft.world.level.storage.LevelResource').ROOT;
            const path = client.getSingleplayerServer()?.getWorldPath(root);
            return path ? 'world:' + String(path.toAbsolutePath().normalize()) : null;
        }
        const address = client.getCurrentServer()?.ip;
        if (address) {
            const host = String(address).trim().toLowerCase();
            return 'server:' + (/^[^:]+:25565$/.test(host) || /^\[.+\]:25565$/.test(host) ? host.slice(0,-6) : host);
        }
        const peer = connection.getConnection()?.getRemoteAddress();
        return peer ? 'peer:' + String(peer) : null;
    }

    function refreshSuspectMarks(connection) {
        const scope = suspectServer(connection);
        const source = scope && storage().get(suspectStorageKey);
        if (scope === suspectScope && source === suspectSource) return;
        suspectScope = scope;
        suspectSource = source;
        const saved = decode(source)?.[scope];
        suspectMarks = new Set(Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : []);
    }

    function rememberSuspect(uuid) {
        suspectMarks.add(uuid);
        if (!suspectScope) return;
        const store = storage();
        const saved = decode(store.get(suspectStorageKey)) ?? {};
        saved[suspectScope] = [...suspectMarks];
        suspectSource = JSON.stringify(saved);
        store.put(suspectStorageKey, suspectSource);
    }

    function restoreTabEntry(info, entry) {
        if (info.getTabListDisplayName() === entry.decorated) info.setTabListDisplayName(entry.original);
    }

    function clearTabMarks() {
        for (const [info, entry] of markedTabEntries) restoreTabEntry(info, entry);
        markedTabEntries.clear();
    }

    function syncTabMarks(connection, local) {
        if (!suspectMarks.size) { clearTabMarks(); return; }
        suspectTab ??= {
            team:type('net.minecraft.world.scores.PlayerTeam'),
            star:Component.literal('* ').withColor(0xff5555),
        };
        const localId = String(local.getUUID()), visible = new Set();
        const players = connection.getListedOnlinePlayers().iterator();
        while (players.hasNext()) {
            const info = players.next(), profile = info.getProfile(), uuid = String(profile.id());
            if (uuid === localId || !suspectMarks.has(uuid)) continue;
            visible.add(info);
            const current = info.getTabListDisplayName(), entry = markedTabEntries.get(info);
            const owned = entry && current === entry.decorated;
            const original = owned ? entry.original : current;
            if (owned && original != null) continue;
            const name = original ?? suspectTab.team.formatNameForTeam(info.getTeam(), Component.literal(profile.name()));
            if (owned && (name === entry.name || name.equals?.(entry.name))) continue;
            const decorated = Component.literal('').append(suspectTab.star).append(name);
            info.setTabListDisplayName(decorated);
            markedTabEntries.set(info,{original,name,decorated});
        }
        for (const [info, entry] of markedTabEntries) {
            if (visible.has(info)) continue;
            restoreTabEntry(info,entry);
            markedTabEntries.delete(info);
        }
    }

    function stopAntiCheatPacketHook() {
        if (antiCheatPacketHook) unhook(antiCheatPacketHook);
        antiCheatPacketHook = null;
        pendingAntiCheatPackets?.clear();
        pendingAntiCheatPackets = null;
    }

    function loadAntiCheatTypes() {
        const Metadata = type('net.ccbluex.liquidbounce.utils.client.MessageMetadata');
        return {
            chat: type('net.ccbluex.liquidbounce.utils.client.ClientChat'),
            metadata: new Metadata(false, null, false, 1),
            blockPos: type('net.minecraft.core.BlockPos'),
            effects: type('net.minecraft.world.effect.MobEffects'),
            attributes: type('net.minecraft.world.entity.ai.attributes.Attributes'),
            blockItem: type('net.minecraft.world.item.BlockItem'),
            itemTags: type('net.minecraft.tags.ItemTags'),
            bed: type('net.minecraft.world.level.block.BedBlock'),
            bedPart: type('net.minecraft.world.level.block.state.properties.BedPart'),
            blockProperties: type('net.minecraft.world.level.block.state.properties.BlockStateProperties'),
            blocks: type('net.minecraft.world.level.block.Blocks'),
            directions: type('net.minecraft.core.Direction').values(),
            breakPacket: type('net.minecraft.network.protocol.game.ClientboundBlockDestructionPacket'),
            blockPacket: type('net.minecraft.network.protocol.game.ClientboundBlockUpdatePacket'),
            chunkPacket: type('net.minecraft.network.protocol.game.ClientboundSectionBlocksUpdatePacket'),
            movePacket: type('net.minecraft.network.protocol.game.ClientboundMoveEntityPacket'),
            swingPacket: type('net.minecraft.network.protocol.game.ClientboundSwingAnimationPacket'),
            incoming: type('net.ccbluex.liquidbounce.event.events.TransferOrigin').INCOMING,
            watchMetadata: new Metadata(false, watchMessageId, true, 1),
        };
    }

    function watchLink(label, target) {
        const text = Component.literal(label).withColor(0x55ffff);
        if (watchActions) text.setStyle(text.getStyle().withUnderlined(true).withClickEvent(new antiCheatTypes.click(watchActions.link(target))));
        return text;
    }

    function loadedPlayer(level, uuid) {
        if (!level || !uuid) return null;
        const players = level.players().iterator();
        while (players.hasNext()) {
            const entity = players.next();
            if (String(entity.getUUID()) === uuid && entity.isAlive() && !entity.isRemoved()
                && level.hasChunkAt(entity.blockPosition())) return entity;
        }
        return null;
    }

    function selectWatchTarget(value) {
        if (!active || !antiCheatModule?.getEnabled()) return;
        const target = String(value);
        if (!target) { stopWatching(); return; }
        const split = target.indexOf(':');
        const uuid = target.slice(split + 1);
        const entity = Number(target.slice(0, split)) === watchWorldSequence ? loadedPlayer(client.level, uuid) : null;
        if (!entity || !client.player || entity === client.player) {
            Client.displayChatMessage('§c[Anti-Cheat] 该玩家已离开当前加载区域。');
            return;
        }
        const original = watching?.original ?? client.getCameraEntity();
        client.setCameraEntity(entity);
        watching = {entity, original, world:client.level, lastLine:0};
        tickWatch(now());
    }

    function stopWatching() {
        if (!watching) return;
        const {entity, original, world} = watching;
        watching = null;
        if (client.player && client.getCameraEntity() === entity) {
            const camera = original && client.level === world && !original.isRemoved() ? original : client.player;
            client.setCameraEntity(camera);
        }
        antiCheatTypes.chatHud.removeMessage(client.gui.hud.getChat(), watchMessageId);
    }

    function tickWatch(timestamp) {
        if (!watching) return;
        const {entity, world, lastLine} = watching;
        if (client.level !== world || entity.isRemoved() || !entity.isAlive() || !world.hasChunkAt(entity.blockPosition())) {
            stopWatching();
            if (client.player) Client.displayChatMessage('§c[Anti-Cheat] 玩家已离开加载区域，已退出观看。');
            return;
        }
        if (client.getCameraEntity() !== entity) { stopWatching(); return; }
        if (timestamp - lastLine < 250) return;
        const chat = client.gui.hud.getChat();
        const messages = antiCheatTypes.chatMessages.get(chat);
        const latest = messages.isEmpty() ? null : messages.get(0);
        const id = latest?.['liquid_bounce$getId']();
        if (id === watchMessageId && timestamp - lastLine < 7000) return;
        antiCheatTypes.chat.chat(watchLink('[退出观看]', ''), antiCheatTypes.watchMetadata);
        watching.lastLine = timestamp;
    }

    function reportViolation(entity, state, check, timestamp, detail) {
        if (!enabledCheck(check)) return;
        decayVl(state, timestamp);
        const entry = state.checks.get(check);
        if (entry && timestamp - entry.lastFlag < flagIntervalMs) return;
        const name = String(entity.getName().getString());
        if (!/^[a-zA-Z0-9_]{1,16}$/.test(name)) return;
        const {chat, metadata} = antiCheatTypes;
        const vl = (entry?.vl ?? 0) + 1;
        state.checks.set(check, {vl, lastFlag:timestamp, decayAt:timestamp});
        state.vl++;
        const line = Component.literal('[').withColor(0xaaaaaa);
        for (const [part, color] of [['Anti-Cheat',0x55ffff], ['] ' + name,0xaaaaaa], [' failed ',0xffffff],
            [check,0x55ffff], [` (vl:${vl.toFixed(1)})`,0xffffff]]) {
            line.append(Component.literal(part).withColor(color));
        }
        if (watchActions) line.append(watchLink(' [观看玩家]', `${watchWorldSequence}:${entity.getUUID()}`));
        if (detail) line.append(Component.literal(' ' + detail).withColor(0xaaaaaa));
        chat.chat(line, metadata);
        const alert = updateSuspicion(entity, state, name);
        const event = Object.freeze({protocol:1, event:'onAntiCheatFlag', sequence:++flagSequence, at:timestamp, player:name, uuid:String(entity.getUUID()),
            check, vl, totalVl:state.vl, detail:detail || '', threshold:totalAlertThreshold, alert});
        storage().put(PREFIX+'antiCheatFlag', JSON.stringify(event));
        flagHistory.push(event);
        if (flagHistory.length > 32) flagHistory.shift();
        storage().put(PREFIX+'antiCheatFlags', JSON.stringify(flagHistory));
        for (const listener of flagListeners) {
            try { listener(check, entity, event); } catch (error) { warn('Anti-cheat callback', error); }
        }
    }

    function updateSuspicion(entity, state, name) {
        if (state.vl < totalAlertThreshold || !name || !/^[a-zA-Z0-9_]{1,16}$/.test(name)) return false;
        const uuid = String(entity.getUUID());
        if (suspectMarks.has(uuid)) return false;
        rememberSuspect(uuid);
        const {chat, metadata} = antiCheatTypes;
        const line = Component.literal(`[Anti-Cheat] ${name} 疑似是黑客 (vl:${state.vl.toFixed(1)})`).withColor(0xff5555);
        for (let i = 0; i < 3; i++) chat.chat(line, metadata);
        return true;
    }

    function sampleOpenB4Movement(entity, level, position, state, timestamp) {
        const previous = state.rotation;
        const trackAim = enabledCheck('AimAssist');
        const yaw = trackAim ? Number(entity.getYRot()) : 0, pitch = trackAim ? Number(entity.getXRot()) : 0;
        const current = state.rotation = {yaw, pitch, ...position, at:timestamp, aim:0};
        if (!previous || timestamp - previous.at > 150) return;
        const dx = position.x - previous.x, dz = position.z - previous.z;
        const step = Math.hypot(dx, dz), dy = position.y - previous.y;
        const yawStep = Math.abs(yawDelta(yaw, previous.yaw)), pitchStep = Math.abs(pitch - previous.pitch);

        if (trackAim && Math.abs(pitch) < 82 && yawStep >= .8 && yawStep < 35 && pitchStep < .2) {
            current.aim = previous.aim + 1;
            if (current.aim >= 18) {
                reportViolation(entity, state, 'AimAssist', timestamp, `${current.aim} ticks / ${flagDetail(yawStep,'°')}`);
                current.aim = 0;
            }
        }
        const lastSwing = state.combat?.lastSwing;
        if (trackAim && yawStep >= 30 && yawStep <= 150 && lastSwing != null && timestamp - lastSwing <= 180
            && lastSwing !== state.lastAimSnapSwing) {
            const nearby = level.players().iterator();
            while (nearby.hasNext()) {
                const target = nearby.next();
                if (target === entity || !target.isAlive()) continue;
                const x = target.getX() - position.x, z = target.getZ() - position.z;
                const distance = Math.hypot(x,z);
                if (distance < .5 || distance > 5 || Math.abs(target.getY() - position.y) > 2) continue;
                const targetYaw = Math.atan2(z,x) * 180 / Math.PI - 90;
                if (Math.abs(yawDelta(yaw,targetYaw)) > 5 || Math.abs(yawDelta(previous.yaw,targetYaw)) < 25) continue;
                state.lastAimSnapSwing = lastSwing;
                const snaps = state.aimSnaps = (state.aimSnaps ?? []).filter(at => timestamp - at < 4500);
                snaps.push(timestamp);
                if (snaps.length >= 3) {
                    reportViolation(entity,state,'AimAssist',timestamp,`${snaps.length} swing snaps / ${flagDetail(yawStep,'°')}`);
                    snaps.length = 0;
                }
                break;
            }
        }
        if (enabledCheck('NoSlow')) {
            sampleNoSlow(entity, level, position, state, timestamp);
        }
        if (enabledCheck('Blink')) sampleBlink(entity, state, step, dy, timestamp);
        if (enabledCheck('NoFall')) sampleFall(entity, level, position, state, dy, timestamp);
    }

    function sampleNoSlow(entity, level, position, state, timestamp) {
        const using = entity.isUsingItem(), {itemTags, blockPos, attributes} = antiCheatTypes;
        const stack = using ? entity.getUseItem() : null;
        const animation = stack ? String(stack.getUseAnimation()) : '';
        const slowing = using && (['BLOCK','EAT','DRINK','BOW','CROSSBOW','TRIDENT','SPYGLASS'].includes(animation)
            || stack.typeHolder().is(itemTags.SWORDS));
        if (!slowing || !entity.onGround()) { state.noSlowSample = null; state.noSlowSince = null; return; }
        const sample = state.noSlowSample;
        if (sample && timestamp - sample.at < 200) return;
        state.noSlowSample = {...position,at:timestamp};
        const block = level.getBlockState(blockPos.containing(position.x,position.y - .08,position.z)).getBlock();
        const elapsed = sample ? timestamp - sample.at : 0;
        const rate = sample ? Math.hypot(position.x - sample.x,position.z - sample.z) * 1000 / elapsed : 0;
        const movement = Number(entity.getAttributeValue(attributes.MOVEMENT_SPEED));
        const minimum = Math.max(1.9, movement * 17);
        const valid = elapsed >= 200 && elapsed <= 350 && Math.abs(position.y - sample.y) < .12
            && Math.abs(block.getFriction() - .6) < .01 && Math.abs(block.getSpeedFactor() - 1) < .01
            && rate >= minimum && rate < 18;
        state.noSlowSince = valid ? state.noSlowSince ?? timestamp : null;
        if (state.noSlowSince !== null && timestamp - state.noSlowSince >= 450) {
            reportViolation(entity,state,'NoSlow',timestamp,`${animation === 'NONE' ? 'BLOCK' : animation} / ${flagDetail(rate,' b/s')}`);
            state.noSlowSince = timestamp;
        }
    }

    function sampleBlink(entity, state, step, dy, timestamp) {
        const blink = state.blink ??= {moving:0, stopped:null, bursts:[]};
        if (step < .01 && Math.abs(dy) < .01) {
            if (blink.moving >= 2 && blink.stopped === null) blink.stopped = timestamp;
            return;
        }
        if (blink.stopped !== null && timestamp - blink.stopped >= 300 && timestamp - blink.stopped < 1600
            && timestamp - antiCheatLastTraffic < 100 && step >= .7 && step < 3 && Math.abs(dy) < .25) {
            blink.bursts = blink.bursts.filter(at => timestamp - at < 10_000);
            blink.bursts.push(timestamp);
            if (blink.bursts.length >= 2) {
                reportViolation(entity, state, 'Blink', timestamp, flagDetail(step,' blocks'));
                blink.bursts.length = 0;
            }
        }
        blink.stopped = null;
        blink.moving = entity.isSprinting() && step > .05 && step < .55 ? blink.moving + 1 : 0;
    }

    function sampleFall(entity, level, position, state, dy, timestamp) {
        if (state.landing) {
            const landing = state.landing;
            if (entity.hurtTime > 0 || !entity.onGround()) state.landing = null;
            else if (timestamp - landing.at >= 500) {
                reportViolation(entity, state, 'NoFall', timestamp, flagDetail(landing.drop,' blocks'));
                state.landing = null;
            }
        }
        if (!entity.onGround()) {
            if (dy < -.08 && !state.fall) state.fall = {y:position.y - dy, at:timestamp};
            if (dy > .15 || dy < -3) state.fall = null;
            return;
        }
        const fall = state.fall;
        state.fall = null;
        if (!fall || timestamp - fall.at < 400) return;
        const safeFall = Number(entity.getAttributeValue(antiCheatTypes.attributes.SAFE_FALL_DISTANCE));
        const multiplier = Number(entity.getAttributeValue(antiCheatTypes.attributes.FALL_DAMAGE_MULTIPLIER));
        if (position.y > fall.y - Math.max(5, safeFall + 2) || multiplier <= 0) return;
        const pos = antiCheatTypes.blockPos.containing(position.x, position.y - .08, position.z);
        const support = level.getBlockState(pos), block = support.getBlock(), {blocks} = antiCheatTypes;
        if (support.isSolidRender() && ![blocks.SLIME_BLOCK,blocks.HAY_BLOCK,blocks.HONEY_BLOCK].some(special => special && block.equals(special))) {
            state.landing = {at:timestamp, drop:fall.y - position.y};
        }
    }

    function startAntiCheatPacketHook() {
        if (!musicLoader) return;
        const event = type('net.ccbluex.liquidbounce.event.events.PacketEvent');
        const Inbox = musicLoader.loadClass('opai.bridge.PacketInbox');
        const Class = type('java.lang.Class'), ObjectType = type('java.lang.Object'), types = antiCheatTypes;
        const packets = Java.to([types.breakPacket.class,types.blockPacket.class,types.chunkPacket.class,types.movePacket.class,types.swingPacket.class], 'java.lang.Class[]');
        const inbox = Inbox.getConstructor(Class.class,ObjectType.class,packets.getClass()).newInstance(event.class,types.incoming,packets);
        pendingAntiCheatPackets = inbox;
        antiCheatPacketHook = registerHook(event, -30_000, inbox, antiCheatModule);
    }

    function processAntiCheatPackets(level, timestamp) {
        const types = antiCheatTypes;
        let received;
        while ((received = pendingAntiCheatPackets.poll()) != null) {
            const event = received.event();
            if (event.isCancelled()) continue;
            const packet = event.getPacket();
            if (packet instanceof types.swingPacket) {
                const entity = level.getEntity(packet.entityId());
                const state = entity && antiCheatPlayers.get(String(entity.getUUID()));
                if (state?.eligible && state.entity === entity && state.lastSeen === timestamp && state.combat) {
                    recordSwing(entity, state, timestamp, Number(received.at()), true);
                }
                continue;
            }
            if (packet instanceof types.movePacket) {
                antiCheatLastTraffic = timestamp;
                if (!packet.hasRotation()) continue;
                const pitch = Number(packet.getXRot());
                if (!enabledCheck('Protocol') || Number.isFinite(pitch) && Math.abs(pitch) <= 90.5) continue;
                const entity = packet.getEntity(level);
                const state = entity && antiCheatPlayers.get(String(entity.getUUID()));
                if (state?.eligible && state.entity === entity && state.lastSeen === timestamp) reportViolation(entity, state, 'Protocol', timestamp, flagDetail(pitch,'° pitch'));
            } else if (packet instanceof types.breakPacket) {
                trackBreakAnimation(level, packet, timestamp);
            } else if (packet instanceof types.blockPacket) {
                if (packet.getBlockState().isAir()) sampleBrokenBlock(level, packet.getPos(), timestamp);
            } else if (enabledCheck('Nuker') || enabledCheck('Bed Nuker') || enabledCheck('FastMine')) {
                packet.runUpdates((pos, block) => { if (block.isAir()) sampleBrokenBlock(level, pos, timestamp); });
            }
        }
        for (const [key, sample] of breakEvidence) {
            if (timestamp - sample.at > 4500) breakEvidence.delete(key);
        }
        for (const [id, sample] of miningAnimations) {
            if (timestamp - sample.at > 4500) miningAnimations.delete(id);
        }
        for (const [key, at] of ambiguousBreaks) {
            if (timestamp - at > 750) ambiguousBreaks.delete(key);
        }
    }

    function trackBreakAnimation(level, packet, timestamp) {
        if (!enabledCheck('Nuker') && !enabledCheck('Bed Nuker') && !enabledCheck('FastMine')) return;
        const id = Number(packet.getId()), pos = packet.getPos(), progress = Number(packet.getProgress());
        const previous = miningAnimations.get(id), key = blockKey(pos);
        if (progress < 0 || progress > 9) { miningAnimations.delete(id); return; }
        const entity = level.getEntity(id);
        const state = entity && antiCheatPlayers.get(String(entity.getUUID()));
        if (!state?.eligible || state.entity !== entity || state.lastSeen !== timestamp || !level.hasChunkAt(pos)
            || entity.distanceToSqr(pos.getX() + .5, pos.getY() + .5, pos.getZ() + .5) > 36) return;
        const block = level.getBlockState(pos);
        if (block.isAir() && previous?.key !== key) return;
        const {directions, bed, bedPart, blockProperties} = antiCheatTypes;
        const isBed = previous?.key === key ? previous.bed : block.getBlock() instanceof bed;
        let partner = previous?.key === key ? previous.partner : null;
        if (isBed && !partner) {
            const facing = block.getValue(blockProperties.HORIZONTAL_FACING);
            partner = pos.relative(block.getValue(bed.PART) === bedPart.HEAD ? facing.getOpposite() : facing);
        }
        const occluded = previous?.key === key ? previous.occluded : directions.every(direction => {
            const side = pos.relative(direction);
            if (partner && blockKey(partner) === blockKey(side)) {
                return level.hasChunkAt(partner) && level.getBlockState(partner).getBlock() instanceof bed
                    && directions.every(edge => {
                        const neighbor = partner.relative(edge);
                        return blockKey(neighbor) === key || level.hasChunkAt(neighbor) && level.getBlockState(neighbor).isSolidRender();
                    });
            }
            return level.hasChunkAt(side) && level.getBlockState(side).isSolidRender();
        });
        const sample = {key, state, entity, at:timestamp, progress, occluded, bed:isBed, partner,
            blockState:previous?.key === key ? previous.blockState : block,
            started:previous?.key === key ? previous.started : timestamp, initial:previous?.key === key ? previous.initial : progress,
            hardness:previous?.key === key ? previous.hardness : Number(block.getDestroySpeed(level, pos))};
        miningAnimations.set(id, sample);
        const other = breakEvidence.get(key);
        if (!other || other.state === state || timestamp - other.at > 300) breakEvidence.set(key, sample);
        else { ambiguousBreaks.set(key, timestamp); breakEvidence.delete(key); }
    }

    function sampleBrokenBlock(level, pos, timestamp) {
        const key = blockKey(pos), sample = breakEvidence.get(key);
        if (!sample || ambiguousBreaks.has(key) || timestamp - sample.at > 750 || sample.progress < 4
            || !level.hasChunkAt(pos) || !level.getBlockState(pos).isAir()) return;
        breakEvidence.delete(key);
        if (sample.partner) breakEvidence.delete(blockKey(sample.partner));
        const {entity, state} = sample;
        if (!state.eligible || state.lastSeen !== timestamp) return;
        const elapsed = timestamp - sample.started;
        const detail = `${key} / ${elapsed}ms`;
        if (sample.occluded) {
            const recent = (state.occludedBreaks ?? []).filter(at => timestamp - at < 4000);
            recent.push(timestamp);
            state.occludedBreaks = recent;
            if (sample.bed || recent.length >= 2) reportViolation(entity, state, sample.bed ? 'Bed Nuker' : 'Nuker', timestamp, detail);
        }
        const attributes = antiCheatTypes.attributes;
        if (sample.hardness >= 2 && sample.initial <= 1 && sample.progress >= 6 && elapsed >= 50 && elapsed < 150
            && !entity.hasEffect(antiCheatTypes.effects.HASTE) && entity.getAttributeValue(attributes.BLOCK_BREAK_SPEED) <= 1
            && entity.getMainHandItem().getDestroySpeed(sample.blockState) <= 1) {
            const recent = (state.fastBreaks ?? []).filter(at => timestamp - at < 5000);
            recent.push(timestamp);
            state.fastBreaks = recent;
            if (recent.length >= 3) reportViolation(entity, state, 'FastMine', timestamp, detail);
        }
    }

    function isOrdinaryMovement(entity) {
        const {effects} = antiCheatTypes;
        return !entity.isFallFlying() && !entity.isAutoSpinAttack()
            && !entity.isInWater() && !entity.isInLava() && !entity.isInPowderSnow && !entity.onClimbable()
            && entity.hurtTime === 0 && !entity.isNoGravity() && entity.getGravity() >= .075
            && !entity.hasEffect(effects.LEVITATION) && !entity.hasEffect(effects.SLOW_FALLING);
    }

    function sampleMovement(entity, level, position, state, timestamp) {
        const previous = state.movement;
        if (previous && timestamp - previous.at < 200) return null;
        const {x, y, z} = position;
        const current = {x, y, z, at:timestamp, air:false, ground:false, speed:0, check:null, since:timestamp};
        state.movement = current;
        if (entity.onGround()) {
            const support = level.getBlockState(antiCheatTypes.blockPos.containing(x, y - .08, z));
            const block = support.getBlock();
            current.ground = support.isSolidRender() && Math.abs(block.getFriction() - .6) < .01
                && Math.abs(block.getSpeedFactor() - 1) < .01;
            if (current.ground) current.speed = entity.getAttributeValue(antiCheatTypes.attributes.MOVEMENT_SPEED);
        } else {
            const box = entity.getBoundingBox().move(x - entity.getX(), y - entity.getY(), z - entity.getZ())
                .inflate(.2, 0, .2).expandTowards(0, -1.25, 0);
            current.air = level.hasChunksAt(Math.floor(box.minX), Math.floor(box.minZ), Math.floor(box.maxX), Math.floor(box.maxZ))
                && level.noCollision(entity, box) && !level.containsAnyLiquid(box);
        }
        if (!previous) return null;
        current.check = movementCheck(previous, current, timestamp - previous.at);
        if (!current.check) return null;
        if (current.check === previous.check) current.since = previous.since;
        if (timestamp - current.since < 800) return null;
        current.since = timestamp;
        const detail = current.check === 'Air Hover' ? flagDetail(y - previous.y,' Δy') : flagDetail(Math.hypot(x - previous.x,z - previous.z) * 1000 / (timestamp - previous.at),' b/s');
        return {check:current.check, detail};
    }

    function eagleEdge(level, position, motion) {
        if (!motion) return null;
        const {x, y, z} = position;
        const alongX = Math.abs(motion.dx) > Math.abs(motion.dz);
        const direction = Math.sign(alongX ? motion.dx : motion.dz);
        const coordinate = alongX ? x : z;
        const behind = Math.floor(coordinate - direction * .32), ahead = behind + direction;
        const edge = direction > 0 ? ahead : behind;
        if (Math.abs(coordinate - edge) > .32) return null;
        const blockPos = antiCheatTypes.blockPos;
        const support = blockPos.containing(alongX ? behind : x, y - .08, alongX ? z : behind);
        const next = blockPos.containing(alongX ? ahead : x, y - .08, alongX ? z : ahead);
        if (!level.hasChunkAt(next) || !level.getBlockState(support).isSolidRender() || !level.getBlockState(next).isAir()) return null;
        return {next, axis:alongX ? 'x' : 'z', direction};
    }

    function sampleEagle(entity, level, position, state, timestamp) {
        const previous = state.lastPose;
        const grounded = entity.onGround(), sneaking = entity.isShiftKeyDown();
        state.lastPose = {...position, grounded, sneaking, at:timestamp};
        if (!previous || !grounded || !previous.grounded || timestamp - previous.at > 150 || Math.abs(position.y - previous.y) > .08) {
            state.eagle = null;
            state.motion = null;
            return null;
        }
        const dx = position.x - previous.x, dz = position.z - previous.z;
        const step = Math.hypot(dx, dz);
        if (step > .8) {
            state.eagle = null;
            state.motion = null;
            return null;
        }
        if (step >= .025 && !previous.sneaking) state.motion = {dx, dz, at:timestamp};
        if (sneaking && !previous.sneaking) {
            const motion = state.motion;
            const edge = motion && timestamp - motion.at <= 250 ? eagleEdge(level, position, motion) : null;
            state.eagle = edge ? {...edge, at:timestamp, placedAt:null, x:position.x, z:position.z} : null;
        }
        const cycle = state.eagle;
        if (!cycle) return null;
        if (timestamp - cycle.at > 600 || Math.hypot(position.x - cycle.x, position.z - cycle.z) > .85) {
            state.eagle = null;
            return null;
        }
        if (cycle.placedAt === null && level.getBlockState(cycle.next).isSolidRender()) cycle.placedAt = timestamp;
        if (sneaking) return null;
        state.eagle = null;
        if (cycle.placedAt === null || cycle.placedAt - cycle.at < 45 || timestamp - cycle.placedAt > 150) return null;
        const cycles = state.eagleCycles;
        if (cycles.length && (timestamp - cycles[0].at > 7000 || cycles[0].axis !== cycle.axis
            || cycles[0].direction !== cycle.direction)) cycles.length = 0;
        const previousCycle = cycles.at(-1);
        if (previousCycle && (cycle.next.getX() - previousCycle.next.getX() !== (cycle.axis === 'x' ? cycle.direction : 0)
            || cycle.next.getZ() - previousCycle.next.getZ() !== (cycle.axis === 'z' ? cycle.direction : 0)
            || cycle.next.getY() !== previousCycle.next.getY())) cycles.length = 0;
        cycles.push({...cycle, at:timestamp, duration:timestamp - cycle.at});
        if (cycles.length < 5) return null;
        const durations = cycles.map(entry => entry.duration);
        if (Math.max(...durations) - Math.min(...durations) > 85) {
            cycles.shift();
            return null;
        }
        const detail = `${cycles.length} cycles / ${Math.round(durations.reduce((sum, duration) => sum + duration, 0) / cycles.length)}ms`;
        cycles.length = 0;
        return detail;
    }

    // Adapted from Rain Anticheat's repeated swings during a sustained block (see script/README.md).
    function sampleAutoBlock(entity, state, timestamp) {
        const combat = state.combat ??= {blockingSince:null, swinging:false, progress:0, swings:[], lastFlag:0, clickTimes:[], lastSwing:null, lastPacketSwing:null};
        const using = entity.isUsingItem();
        const blocking = using && (entity.isBlocking() || entity.getUseItem().typeHolder().is(antiCheatTypes.itemTags.SWORDS));
        combat.blockingSince = blocking ? combat.blockingSince ?? timestamp : null;
        const swinging = entity.isSwinging(), progress = swinging ? entity.getSwingAnimation(0) : 0;
        if (swinging && (!combat.swinging || progress + .1 < combat.progress)) {
            combat.swings.push({at:timestamp, held:combat.blockingSince !== null && timestamp - combat.blockingSince >= 500});
            if (timestamp - (combat.lastPacketSwing ?? -Infinity) > 200) recordSwing(entity,state,timestamp,timestamp,false);
        }
        combat.swinging = swinging;
        combat.progress = progress;
        while (combat.swings.length && timestamp - combat.swings[0].at > 9000) combat.swings.shift();
        if (!enabledCheck('AutoBlock') || combat.swings.length < 7 || timestamp - combat.lastFlag < 2000) return null;
        const latest = combat.swings.at(-1), held = combat.swings.filter(swing => swing.held).length;
        if (!latest.held || timestamp - latest.at > 100 || latest.at - combat.swings[0].at < 1800
            || held / combat.swings.length < .85) return null;
        combat.lastFlag = timestamp;
        return `${held}/${combat.swings.length} swings`;
    }

    function recordSwing(entity, state, timestamp, arrival, fromPacket) {
        const combat = state.combat;
        combat.lastSwing = timestamp;
        if (fromPacket) {
            if (combat.lastPacketSwing === null || timestamp - combat.lastPacketSwing > 200) combat.clickTimes.length = 0;
            combat.lastPacketSwing = timestamp;
        }
        if (!enabledCheck('AutoClicker') || state.builder?.held.length || miningAnimations.has(Number(entity.getId()))) {
            combat.clickTimes.length = 0;
            return;
        }
        const times = combat.clickTimes;
        if (times.length && arrival - times.at(-1) > 320) times.length = 0;
        times.push(arrival);
        while (times.length > 2 && arrival - times[0] > 1500) times.shift();
        if (times.length < 9) return;
        const intervals = times.slice(1).map((at,i) => at - times[i]);
        const mean = (arrival - times[0]) / intervals.length;
        if (mean < 40 || mean > 175 || intervals.filter(gap => gap >= 35).length < intervals.length * .8) return;
        const deviation = Math.sqrt(intervals.reduce((sum,gap) => sum + (gap - mean) ** 2,0) / intervals.length);
        if (mean <= 75 || deviation <= 20) reportViolation(entity,state,'AutoClicker',timestamp,flagDetail(1000 / mean,' swings/s'));
    }

    function blockKey(pos) { return `${pos.getX()},${pos.getY()},${pos.getZ()}`; }

    function sampleBuilder(entity, level, position, state, timestamp) {
        const old = state.builder;
        const main = entity.getMainHandItem().getItem(), off = entity.getOffhandItem().getItem();
        const held = [];
        if (main instanceof antiCheatTypes.blockItem) held.push(main.getBlock());
        if (off instanceof antiCheatTypes.blockItem) held.push(off.getBlock());
        if (!held.length) { state.builder = null; return; }
        const step = old ? Math.hypot(position.x - old.x, position.z - old.z) : 0;
        const movedAt = step >= .045 && step < 1.5 ? timestamp : old?.movedAt ?? 0;
        const swingAt = entity.isSwinging() ? timestamp : old?.swingAt ?? 0;
        const grounded = entity.onGround(), feet = Math.floor(position.y - .08);
        const launch = grounded ? null : old?.grounded && position.y - old.y >= .18
            ? {y:old.y, at:timestamp, x:old.x, z:old.z} : old?.launch ?? null;
        const builder = state.builder = {...position, movedAt, swingAt, held, air:null, pitch:Number(entity.getXRot()),
            sneaking:entity.isShiftKeyDown(), grounded, launch, descending:!!old && position.y < old.y - .02};
        if (timestamp - movedAt > 280 || step >= 1.5) return;
        const air = builder.air = new Map();
        const start = launch && timestamp - launch.at < 900 ? Math.max(feet - 2, Math.floor(launch.y - .08)) : feet;
        for (let y = start; y <= feet; y++) {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const pos = antiCheatTypes.blockPos.containing(Math.floor(position.x) + dx,y,Math.floor(position.z) + dz);
                    if (level.hasChunkAt(pos) && level.getBlockState(pos).isAir()) air.set(blockKey(pos), y === feet);
                }
            }
        }
    }

    function collectRemoteBlock(pos, blockState) {
        if (!antiCheatModule?.getEnabled() || !client.player || antiCheatWorld !== client.level || !blockState.isSolidRender()) return;
        const key = blockKey(pos);
        if (remoteBlockUpdates.has(key) || remoteBlockUpdates.size >= 128) return;
        let candidate = null;
        for (const state of antiCheatPlayers.values()) {
            if (!state.builder?.air?.has(key)) continue;
            if (candidate) return;
            candidate = state;
        }
        if (!candidate) return;
        const player = client.player, dx = player.getX() - pos.getX() - .5, dz = player.getZ() - pos.getZ() - .5;
        if (Math.hypot(dx, dz) <= 5 && Math.abs(player.getY() - pos.getY()) < 5) {
            const main = player.getMainHandItem().getItem(), off = player.getOffhandItem().getItem();
            if (main instanceof antiCheatTypes.blockItem || off instanceof antiCheatTypes.blockItem) return;
        }
        const builder = candidate.builder, block = blockState.getBlock();
        if (builder.held.some(held => held === block || held.equals?.(block))) {
            const jump = builder.launch;
            const at = now();
            const telly = jump && builder.descending && !builder.sneaking && at - jump.at < 850
                && Math.hypot(builder.x - jump.x,builder.z - jump.z) >= .65
                && pos.getY() === Math.floor(jump.y - .08);
            const airBelow = depth => {
                const below = pos.offset(0,-depth,0);
                return client.level.hasChunkAt(below) && client.level.getBlockState(below).isAir();
            };
            const openBelow = (telly || enabledCheck('Scaffold') && builder.pitch >= 65 && !builder.sneaking) && airBelow(1) && airBelow(2);
            const overVoid = openBelow && builder.pitch >= 65 && airBelow(3) && airBelow(4);
            remoteBlockUpdates.set(key, {state:candidate, at, overVoid, builder, foot:builder.air.get(key), telly:telly && openBelow});
        }
    }

    function loadScaffoldTypes() {
        const module = type('net.ccbluex.liquidbounce.features.module.modules.world.scaffold.ModuleScaffold').INSTANCE;
        const planner = type('net.ccbluex.liquidbounce.features.module.modules.world.scaffold.ScaffoldMovementPlanner');
        const prediction = type('net.minecraft.client.multiplayer.prediction.BlockStatePredictionHandler');
        const levelAccessor = type('net.ccbluex.liquidbounce.injection.mixins.minecraft.client.MixinClientLevelAccessor');
        const recent = planner.class.getDeclaredField('lastPlacedBlocks');
        const pending = prediction.class.getDeclaredField('serverVerifiedStates');
        recent.setAccessible(true);
        pending.setAccessible(true);
        return {module, recent:recent.get(null), pending, getPrediction:levelAccessor.class.getMethod('getBlockStatePredictionHandler'),
            thread:type('java.lang.Thread')};
    }

    function resetScaffold() {
        scaffoldWorld = null;
        scaffoldOn = false;
        scaffoldPrediction = null;
        legacyScaffold = false;
        scaffoldPending.clear();
        scaffoldPlacements.length = 0;
        scaffoldBps = null;
    }

    function startScaffold(level) {
        scaffoldWorld = level;
        scaffoldOn = true;
        scaffoldPrediction = scaffoldTypes.getPrediction.invoke(level);
        legacyScaffold = String(scaffoldPrediction.getClass().getSimpleName()) === 'PendingUpdateManager1_18_2';
    }

    function observeLegacyScaffoldUpdate(pos, blockState) {
        const placement = scaffoldPending.get(blockKey(pos));
        if (placement && blockState.getBlock().equals(placement.block)) placement.confirmed = true;
    }

    function collectScaffoldBlock(pos, blockState) {
        if (!scaffoldOn || scaffoldWorld !== client.level) return false;
        const key = blockKey(pos);
        if (legacyScaffold) {
            if (scaffoldPending.has(key)) {
                // This ViaFabricPlus prediction handler omits sequence acknowledgements.
                for (const frame of scaffoldTypes.thread.currentThread().getStackTrace()) {
                    if (String(frame.getClassName()) === 'net.minecraft.client.multiplayer.ClientPacketListener'
                        && String(frame.getMethodName()) === 'handleBlockUpdate') {
                        observeLegacyScaffoldUpdate(pos, blockState);
                        return false;
                    }
                }
                return false;
            }
        } else if (!scaffoldPrediction.isPredicting()) return false;
        if (blockState.isAir() || scaffoldPending.size >= 128 || !scaffoldWorld.getBlockState(pos).equals(blockState)) return false;
        scaffoldPending.set(key, {pos, block:blockState.getBlock(), at:now(), placed:false, confirmed:false});
        return true;
    }

    function tickScaffold(timestamp) {
        if (!scaffoldTypes || !client.level || !client.player || !scaffoldTypes.module.getEnabled()) {
            if (scaffoldOn) resetScaffold();
            return;
        }
        if (scaffoldWorld !== client.level) {
            resetScaffold();
            startScaffold(client.level);
        }
        if (scaffoldPending.size) {
            const recent = scaffoldTypes.recent.iterator();
            while (recent.hasNext()) {
                const key = blockKey(recent.next()), placement = scaffoldPending.get(key);
                if (placement) placement.placed = true;
            }
            const pending = legacyScaffold ? null : scaffoldTypes.pending.get(scaffoldPrediction);
            for (const [key, placement] of scaffoldPending) {
                if (timestamp - placement.at > 5000 || !placement.placed) {
                    scaffoldPending.delete(key);
                } else if (pending ? !pending.containsKey(placement.pos.asLong()) : placement.confirmed) {
                    if (scaffoldWorld.getBlockState(placement.pos).getBlock().equals(placement.block)) scaffoldPlacements.push(placement.at);
                    scaffoldPending.delete(key);
                }
            }
        }
        // Use the original placement times so batched server acknowledgements cannot inflate the rate.
        for (let i = scaffoldPlacements.length - 1; i >= 0; i--) {
            if (timestamp - scaffoldPlacements[i] >= 2000) scaffoldPlacements.splice(i, 1);
        }
        scaffoldBps = scaffoldPlacements.length / 2;
    }

    function syncBlockHooks(watchRemote=antiCheatModule?.getEnabled() === true, watchLocal=scaffoldTypes?.module.getEnabled() === true) {
        const watchChunks = watchRemote || (watchLocal && legacyScaffold);
        const mode = Number(watchLocal) + 2 * Number(watchRemote) + 4 * Number(watchChunks);
        if (mode === blockHookMode) return;
        blockHookMode = mode;
        if (watchRemote || watchLocal) {
            blockChangeHook ??= hook(type('net.ccbluex.liquidbounce.event.events.BlockChangeEvent'), -500, event => {
                const pos = event.getBlockPos(), state = event.getNewState();
                let localPlacement = false;
                try { localPlacement = collectScaffoldBlock(pos, state); } catch (error) { warn('Scaffold BPS', error); }
                try { if (!localPlacement) collectRemoteBlock(pos, state); } catch (error) { warn('Scaffold detection', error); }
            });
        } else if (blockChangeHook) {
            unhook(blockChangeHook);
            blockChangeHook = null;
        }
        if (watchChunks) {
            chunkDeltaHook ??= hook(type('net.ccbluex.liquidbounce.event.events.ChunkDeltaUpdateEvent'), -500, event => {
                try {
                    event.getPacket().runUpdates((pos, state) => {
                        if (legacyScaffold && scaffoldWorld === client.level) observeLegacyScaffoldUpdate(pos, state);
                        collectRemoteBlock(pos, state);
                    });
                } catch (error) { warn('Scaffold detection', error); }
            });
        } else if (chunkDeltaHook) {
            unhook(chunkDeltaHook);
            chunkDeltaHook = null;
        }
    }

    // Adapted from ClientSide-AC's recent-placement rate (see script/README.md).
    function sampleScaffold(state, timestamp) {
        const placements = state.placements;
        while (placements.length && timestamp - placements[0].at >= SCAFFOLD_WINDOW) placements.shift();
        const rate = placements.length * 1000 / SCAFFOLD_WINDOW;
        if (rate <= 3.5 || state.lastBpsPlacement === placements.at(-1).at) return null;
        state.lastBpsPlacement = placements.at(-1).at;
        return flagDetail(rate,' b/s');
    }

    function sampleScaffoldPattern(state, placement, timestamp) {
        const builder = placement.builder;
        if (builder.sneaking || builder.pitch < 65 || builder.pitch > 90 || !placement.overVoid) {
            state.scaffoldPattern = [];
            return;
        }
        const placements = (state.scaffoldPattern ?? []).filter(at => timestamp - at < 2000);
        placements.push(timestamp);
        state.scaffoldPattern = placements;
        if (placements.length < 4 || timestamp - placements[0] < 450) return;
        reportViolation(state.entity, state, 'Scaffold', timestamp, `${placements.length} blocks / ${flagDetail(builder.pitch,'°')}`);
        placements.length = 0;
    }

    function sampleTelly(state, placement, timestamp) {
        if (!placement.telly) return;
        const jumps = state.tellyJumps;
        const launch = placement.builder.launch.at;
        while (jumps.length && timestamp - jumps[0].launch > 4500) jumps.shift();
        if (jumps.at(-1)?.launch === launch) {
            jumps.at(-1).blocks++;
        } else jumps.push({launch,blocks:1});
        if (jumps.length >= 2 && jumps.reduce((sum,jump) => sum + jump.blocks,0) >= 3) {
            reportViolation(state.entity,state,'Telly Scaffold',timestamp,`${jumps.length} jumps / ${jumps.reduce((sum,jump) => sum + jump.blocks,0)} blocks`);
            jumps.length = 0;
        }
    }

    function tickAntiCheat(timestamp) {
        if (!antiCheatModule?.getEnabled()) return;
        const level = client.level, local = client.player, connection = client.getConnection();
        if (antiCheatWorld !== level || !local || !connection) {
            resetAntiCheat();
            antiCheatWorld = level;
        }
        if (!level || !local || !connection) return;
        refreshSuspectMarks(connection);
        readAntiCheatSettings();
        antiCheatTypes ??= loadAntiCheatTypes();
        if (!watchActions && musicLoader && !errors.some(error => error.startsWith('Anti-cheat watch:'))) {
            try {
                const actions = musicLoader.loadClass('opai.bridge.WatchActions');
                antiCheatTypes.click = type('net.ccbluex.liquidbounce.utils.text.RunnableClickEvent');
                antiCheatTypes.chatHud = type('net.ccbluex.liquidbounce.utils.client.ChatHudExtensionKt');
                const messages = type('net.minecraft.client.gui.components.ChatComponent').class.getDeclaredField('allMessages');
                messages.setAccessible(true);
                antiCheatTypes.chatMessages = messages;
                watchActions = actions.getConstructor(Consumer.class).newInstance(new Consumer(selectWatchTarget));
            } catch (error) { warn('Anti-cheat watch',error); }
        }
        if (!antiCheatPacketHook && !errors.some(error => error.startsWith('Anti-cheat packet checks:'))) {
            if (musicLoader) {
                try { startAntiCheatPacketHook(); } catch (error) { warn('Anti-cheat packet checks',error); }
            } else warn('Anti-cheat packet checks','Install the matching Opai theme bundle for packet-based checks.');
        }
        for (const [key, update] of remoteBlockUpdates) {
            if (timestamp - update.at > 200) { remoteBlockUpdates.delete(key); continue; }
            const builder = update.builder;
            if (!update.state.eligible || update.state.entity.isRemoved()) { remoteBlockUpdates.delete(key); continue; }
            if (!update.foot && !update.telly) { remoteBlockUpdates.delete(key); continue; }
            if (!update.telly && timestamp - builder.swingAt > 220 && !update.state.entity.isSwinging()
                && !builder.launch && !builder.grounded) continue;
            if (!update.state.placements.some(block => block.key === key)) {
                update.state.placements.push({key, at:update.at});
                update.state.placements.sort((a, b) => a.at - b.at);
                if (enabledCheck('Scaffold')) sampleScaffoldPattern(update.state, update, update.at);
                if (enabledCheck('Telly Scaffold')) sampleTelly(update.state, update, update.at);
            }
            remoteBlockUpdates.delete(key);
        }
        const players = level.players().iterator();
        while (players.hasNext()) {
            const entity = players.next();
            if (entity === local || entity.distanceToSqr(local) > 96 * 96) continue;
            const id = String(entity.getUUID());
            let state = antiCheatPlayers.get(id);
            if (!state || state.entity !== entity) {
                state = {entity, vl:0, checks:new Map(), lastSeen:timestamp, graceUntil:timestamp + 1000};
                clearEvidence(state);
                antiCheatPlayers.set(id, state);
            }
            if (timestamp - state.lastSeen > 350) { clearEvidence(state); state.combat = null; }
            state.lastSeen = timestamp;
            decayVl(state, timestamp);
            const mode = connection.getPlayerInfo(entity.getUUID())?.getGameMode();
            state.eligible = mode?.isSurvival() === true && entity.isAlive() && !entity.isPassenger() && !entity.isSleeping();
            if (!state.eligible) {
                state.combat = null;
                state.graceUntil = timestamp + 1000;
                clearEvidence(state);
                continue;
            }
            const combat = sampleAutoBlock(entity, state, timestamp);
            if (combat) reportViolation(entity, state, 'AutoBlock', timestamp, combat);
            if (!isOrdinaryMovement(entity)) {
                state.graceUntil = timestamp + 1000;
                clearEvidence(state);
            } else if (timestamp >= state.graceUntil) {
                // Use positions received from the server before the render interpolator modifies them.
                const point = entity.getPositionCodec().getBase();
                const position = {x:Number(point.x()), y:Number(point.y()), z:Number(point.z())};
                if (level.hasChunkAt(antiCheatTypes.blockPos.containing(point))) {
                    const movement = sampleMovement(entity, level, position, state, timestamp);
                    const eagle = enabledCheck('Legit Scaffold') && sampleEagle(entity, level, position, state, timestamp);
                    if (enabledCheck('Scaffold') || enabledCheck('Scaffold BPS') || enabledCheck('Telly Scaffold')) sampleBuilder(entity, level, position, state, timestamp);
                    const scaffold = enabledCheck('Scaffold BPS') && sampleScaffold(state, timestamp);
                    if (movement) reportViolation(entity, state, movement.check, timestamp, movement.detail);
                    if (eagle) reportViolation(entity, state, 'Legit Scaffold', timestamp, eagle);
                    if (scaffold) reportViolation(entity, state, 'Scaffold BPS', timestamp, scaffold);
                    sampleOpenB4Movement(entity, level, position, state, timestamp);
                } else clearEvidence(state);
            }
            if (state.vl >= totalAlertThreshold && !suspectMarks.has(id)) updateSuspicion(entity, state, String(entity.getName().getString()));
        }
        if (pendingAntiCheatPackets) processAntiCheatPackets(level, timestamp);
        try { syncTabMarks(connection,local); } catch (error) { warn('Anti-cheat Tab list',error); }
        tickWatch(timestamp);
        for (const [id, state] of antiCheatPlayers) {
            if (timestamp - state.lastSeen > 60_000) antiCheatPlayers.delete(id);
        }
    }
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
    try{registerAntiCheatModule();}catch(error){warn('Anti-cheat module registration',error);}
    function startMusic(){
        let found=false;
        try{
            const File=type('java.io.File'),Config=type('net.ccbluex.liquidbounce.config.ConfigSystem').INSTANCE;
            const root=Config.getRootFolder(),jar=new File(root,'themes/opai/music/OpaiMusicService.jar');
            if(!jar.isFile())return;found=true;
            const URLClassLoader=type('java.net.URLClassLoader');
            musicLoader=new URLClassLoader(Java.to([jar.toURI().toURL()],'java.net.URL[]'),Config.getClass().getClassLoader());
            try {
                icmpProbe = musicLoader.loadClass('opai.music.IcmpProbe').getConstructor().newInstance();
            } catch (_) { /* An older theme bundle has no ICMP worker. */ }
            const service=musicLoader.loadClass('opai.music.MusicService');
            music=service.getMethod('start',type('java.lang.String').class).invoke(null,String(new File(root,'opai-music').getAbsolutePath()));
            musicDescriptor=String(service.getMethod('descriptor').invoke(music));
            if(/^1\.[01]\./.test(JSON.parse(musicDescriptor).version??''))throw new Error('Please update the complete theme music folder to service 1.2.0 before using bridge 1.4.0.');
        }catch(error){if(found)warn('Music',error);stopMusic();}
    }
    function stopMusic(){
        try { if (music) music.getClass().getMethod('close').invoke(music); } catch (_) {}
        music=null;
        musicDescriptor=null;
        storage().remove(PREFIX+'music');
    }

    function closeRuntime(){
        watchActions?.close();
        watchActions=null;
        stopMusic();
        try { icmpProbe?.close(); } catch (_) {}
        icmpProbe=null;
        try { musicLoader?.close(); } catch (_) {}
        musicLoader=null;
    }
    function warn(feature,error){const text=feature+': '+String(error);if(!errors.some(x=>x.startsWith(feature+':'))){errors.push(text);Client.displayChatMessage('§c[OpaiBridge] '+text);}}
    function hook(event,priority,callback){return registerHook(event,priority,new Consumer(callback));}
    function registerHook(event,priority,consumer,listener=owner){const h=new EventHook(listener,priority,consumer);EventManager.registerEventHook(event.class,h);hooks.push([event.class,h]);return h;}
    function unhook(handler) {
        const index = hooks.findIndex(([, registered]) => registered === handler);
        if (index < 0) return;
        const [event, registered] = hooks[index];
        EventManager.unregisterEventHook(event, registered);
        hooks.splice(index, 1);
    }
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
    function isFriend(entity) {
        if (friendManager === undefined) {
            try {
                friendManager = type('net.ccbluex.liquidbounce.features.misc.FriendManager').INSTANCE;
            } catch (_) {
                friendManager = null;
            }
        }
        try { return friendManager?.isFriend(entity) === true; } catch (_) { return false; }
    }

    function prepare(entity, distance, cached, timestamp=now()) {
        const hp = health(entity), meters = Math.round(distance);
        const suspect = suspectMarks.size > 0 && entity !== client.player && suspectMarks.has(String(entity.getUUID()));
        let name = cached?.name, friend = cached?.friend, metadataAt = cached?.metadataAt ?? 0;
        if (!cached || timestamp - metadataAt >= 500) {
            const currentName = Entity.getSimpleDisplayName(entity);
            name = name && (name === currentName || name.equals?.(currentName)) ? name : currentName;
            friend = entity !== client.player && isFriend(entity);
            metadataAt = timestamp;
        }
        if (cached && cached.health === hp && cached.distance === meters && cached.name === name && cached.friend === friend && cached.suspect === suspect) {
            cached.metadataAt = metadataAt;
            return cached;
        }
        return {
            entity, health: hp, distance: meters, name, friend, suspect, metadataAt,
            healthText: cached?.health === hp ? cached.healthText : Component.literal(String(hp)),
            distanceText: cached?.distance === meters ? cached.distanceText : Component.literal(meters + 'm'),
        };
    }

    let lastLabelFont=null, heartFont=null;
    function smoothHeartFont(labelFont) {
        if (lastLabelFont !== labelFont) {
            lastLabelFont = labelFont;
            // The bundled Inter Bold has U+2665. Google Sans Bold does not.
            heartFont = Fonts.INSTANCE.fontFace('Inter Bold')?.getRenderer() ?? Fonts.getFONT_RENDERER();
        }
        return heartFont;
    }

    function drawSkull(ctx, x, y, size) {
        rounded(ctx, x, y, size, size * .78, skullColor, size * .3);
        rounded(ctx, x + size * .22, y + size * .59, size * .56, size * .36, skullColor, size * .09);
        rounded(ctx, x + size * .18, y + size * .27, size * .23, size * .21, skullEyes, size * .08);
        rounded(ctx, x + size * .59, y + size * .27, size * .23, size * .21, skullEyes, size * .08);
        quad(ctx, x + size * .46, y + size * .73, size * .08, size * .22, skullEyes);
    }

    function drawPills(ctx, record, cx, cy, tagScale, labelFont=font()) {
        let layout = record.pills;
        if (!layout || layout.scale !== tagScale || layout.font !== labelFont) {
            const base = labelFont.getScaleToVanillaFont() * tagScale;
            const height = labelFont.getHeight() * base;
            const parts = [
                {component: record.healthText, color: new Color(0xff000000 | healthColor(record.health)), scale: .85, heart: true},
                {component: record.name, color: white, scale: 1},
            ];
            if (record.friend) parts.push({component: friendLabel, color: friendColor, scale: .85});
            parts.push({component: record.distanceText, color: grey, scale: .85});
            const iconFont = smoothHeartFont(labelFont);
            const nominalScale = f32(iconFont.getScaleToVanillaFont() * tagScale * .85);
            const nominalWidth = iconFont.getStringWidth(heartGlyph, nominalScale, false);
            const iconScale = f32(nominalScale * Math.min(1, height * .7 / Math.max(1, nominalWidth)));
            const iconWidth = nominalWidth * iconScale / nominalScale;
            const iconHeight = iconFont.getHeight() * iconScale;
            for (const part of parts) {
                part.width = labelFont.getStringWidth(part.component, f32(base * part.scale), false)
                    + height * .6 + (part.heart ? height * .8 : 0);
            }
            if (record.suspect) parts.unshift({skull:true, width:height * 1.42});
            layout = record.pills = {
                font: labelFont, scale: tagScale, base, height, parts, iconFont, iconScale, iconWidth, iconHeight,
                total: parts.reduce((width, part) => width + part.width, 0) + height * .12 * (parts.length - 1),
            };
        }
        const {base, height, parts, total, iconFont, iconScale, iconWidth, iconHeight} = layout;
        let left = cx - total / 2;
        for (const part of parts) {
            rounded(ctx, left, cy - height * .775, part.width, height * 1.55, background, height * .775);
            let textX = left + height * .3;
            if (part.skull) {
                drawSkull(ctx, textX, cy - height * .39, height * .82);
            } else {
                if (part.heart) {
                    text(ctx, iconFont, heartGlyph, textX + (height * .8 - iconWidth) / 2,
                        cy - iconHeight / 2, part.color, iconScale);
                    textX += height * .8;
                }
                text(ctx, labelFont, part.component, textX, cy - height * part.scale / 2, part.color, base * part.scale);
            }
            left += part.width + height * .12;
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
    function readFeatures(){
        const preferences = decode(storage().get('opai.preferences'));
        icmpEnabled = preferences?.icmpPing !== false;
        const data=decode(storage().get(PREFIX+'features'));if(data&&data.protocol===1)for(const key of ['serverInfo','nametags','preview'])if(typeof data[key]==='boolean')features[key]=data[key];
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
        if(!activityMenu||!activityContainer?.open||client.player?.containerMenu!==activityMenu||!Number.isInteger(slot)||slot<0||slot>=activitySlots.length||!activityTypes.stealer.getEnabled()||!(client.gui.screen() instanceof activityTypes.screen)||(typeof activityTypes.stealer.canBeStolen==='function'&&!activityTypes.stealer.canBeStolen(client.gui.screen())))return;
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
        if(menu){const native=activityNative();if(native.stealer.getEnabled()&&menu instanceof native.chest&&client.gui.screen() instanceof native.screen&&(typeof native.stealer.canBeStolen!=='function'||native.stealer.canBeStolen(client.gui.screen()))){
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
        let serverAddress=null,serverIP=null,peer=null,ping=null,singleplayer=false;const inWorld=client.player!=null&&client.level!=null;
        try{singleplayer=inWorld&&client.hasSingleplayerServer();}catch(_){}
        if(features.serverInfo&&inWorld){
            // Each optional datum is independent: a mapping/connection failure must not
            // suppress the entire heartbeat (including the preview capability).
            try{const server=client.getCurrentServer();if(server&&server.ip)serverAddress=String(server.ip);}catch(error){warn('Server',error);}
            const connection=client.getConnection();
            try{const remote=connection&&connection.getConnection().getRemoteAddress(),address=remote&&remote.getAddress();if(address){peer=address;serverIP=String(address.getHostAddress());}}catch(_){}
            if(!serverAddress&&serverIP)serverAddress=serverIP;
        }
        if (icmpProbe) {
            try {
                if (icmpEnabled && inWorld && !singleplayer && peer) {
                    const result = icmpProbe.sample(peer);
                    if (result !== null && Number.isFinite(Number(result))) ping = Number(result);
                } else {
                    icmpProbe.reset();
                }
            } catch (error) {
                warn('Ping', error);
            }
        }
        lastPublish=now();
        storage().put(PREFIX+'snapshot',JSON.stringify({protocol:1,version:VERSION,at:lastPublish,connected:active,inWorld,singleplayer,serverAddress,serverIP,ping,pingSource:'icmp',worldInfo:worldInfo(),scaffoldBps,
            capabilities:{activity:true,serverInfo:features.serverInfo,nametags:tookTags&&!tagFailed,preview:features.preview},previewError:previewFailed?errors.find(x=>x.startsWith('Preview:')):null,errors}));
    }
    function heartbeat(){activityTick();if(now()-lastPublish>=250){const probe=decode(storage().get(PREFIX+'renderProbe'));renderPaused=!!(probe&&probe.protocol===1&&probe.paused===true&&Number.isFinite(probe.at)&&now()-probe.at>=0&&now()-probe.at<2000);readFeatures();publish();}}
    let lastPreviewRead=0;
    function readPreview(){
        const timestamp = now();
        if (timestamp - lastPreviewRead < 25) return;
        lastPreviewRead = timestamp;
        const win = client.getWindow();
        request = previewRequest(storage().get(PREFIX+'preview'), timestamp, win.getGuiScaledWidth(), win.getGuiScaledHeight());
    }
    function tick(){
        if (!active) return;
        const timestamp = now();
        try { tickAntiCheat(timestamp); } catch (error) { warn('Anti-cheat', error); }
        try { tickScaffold(timestamp); syncBlockHooks(); } catch (error) { scaffoldBps = null; warn('Scaffold BPS', error); }
        try {
            heartbeat();
            if (tagWorld !== client.level) {
                tagWorld = client.level;
                tagCache.clear();
            }
            if (renderPaused || !tookTags || !NativeTags.getEnabled() || !client.player || !client.level || client.gui.screen() != null) {
                records = [];
                return;
            }
            const camera = client.gameRenderer.mainCamera().position();
            const entities = Entities.iterator(), candidates = [];
            while (entities.hasNext()) {
                const entity = entities.next();
                if (entity === client.player || !entity.isAlive()) continue;
                const distance = entity.position().distanceTo(camera);
                if (distance <= 128) candidates.push({entity, distance});
            }
            candidates.sort((left, right) => left.distance - right.distance);
            const nearest = candidates.slice(0, 128).reverse();
            const visible = new Set();
            records = nearest.map(({entity, distance}) => {
                visible.add(entity);
                const record = prepare(entity, distance, tagCache.get(entity), timestamp);
                tagCache.set(entity, record);
                return record;
            });
            for (const entity of tagCache.keys()) {
                if (!visible.has(entity)) tagCache.delete(entity);
            }
        } catch (error) {
            warn('Tick', error);
        }
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
        stopAntiCheatPacketHook();resetAntiCheat();antiCheatTypes=null;resetScaffold();scaffoldTypes=null;blockChangeHook=chunkDeltaHook=null;blockHookMode=0;
        pendingMusicOpen=false;lastMusicConfig='';worldLyricsEnabled=false;worldDirty=false;worldHook=null;worldEvent=null;renderPaused=false;worldTypes=null;worldLayouts.clear();closeRuntime();
        activityMenu=null;activityContainer=null;activitySlots=[];activityFeedback=[];activityMouseHook=null;activityTypes=null;bedModule=packetMine=bedProvider=blockRegistry=undefined;activityHadState=false;lastActivitySample=0;lastActivityWrite=0;storage().remove(PREFIX+'activity');storage().remove(PREFIX+'containerView');storage().remove(PREFIX+'containerClick');
        active=false;for(const [event,h] of hooks)EventManager.unregisterEventHook(event,h);hooks=[];
        restoreTags();request=null;records=[];tagCache.clear();tagWorld=null;lastPreviewRead=0;lastLabelFont=heartFont=null;storage().remove(PREFIX+'snapshot');storage().remove(PREFIX+'preview');owner=null;
    }
    script.on('enable',()=>{
        if(active)return;active=true;lastPublish=0;lastPreviewError=0;tagFailed=previewFailed=false;errors=[];
        owner=new Listener({getRunning:()=>active,getDebugOwnerId:()=>'OpaiBridge'});
        try{hook(TickEvent,-500,tick);hook(OverlayEvent,-2000,drawTags);hook(ScreenEvent,-30000,drawPreview);hook(ShutdownEvent,30000,stop);
            hook(ModuleToggleEvent,-1000,event=>{
                const name=String(event.getModuleName()).toLowerCase();
                if(tookTags&&!changing&&name==='nametags')changedByUser=true;
                if(name==='scaffold') {
                    resetScaffold();
                    if (event.getEnabled() && scaffoldTypes && client.level) startScaffold(client.level);
                }
                if(name==='scaffold')syncBlockHooks(undefined, !!scaffoldTypes && event.getEnabled());
                if(name==='anti-cheat')syncBlockHooks(event.getEnabled());
            });
            try { scaffoldTypes=loadScaffoldTypes(); } catch (error) { if (client.level) warn('Scaffold BPS',error); }
            syncBlockHooks();
            startMusic();readFeatures();publish();Client.displayChatMessage('§a[OpaiBridge] Loaded.');
        }catch(error){warn('Startup',error);stop();}
    });
    script.on('disable',stop);
})();
