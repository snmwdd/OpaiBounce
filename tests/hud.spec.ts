import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';
import {setup} from './fixtures';

function defaults(values:any[]=[]){return Object.fromEntries(values.map(v=>[v.name[0].toLowerCase()+v.name.slice(1),v.type==='CONFIGURABLE'?defaults(v.values):v.type==='TOGGLEABLE'?{enabled:v.value,...defaults(v.values)}:v.type==='CHOICE'?{active:v.value,value:defaults(v.choices.find((c:any)=>c.name===v.value)?.values)}:v.value]));}
const air=()=>({identifier:'minecraft:air',count:0,damage:0,maxDamage:0,displayName:'Air',enchantments:{}});
const stack=(identifier:string,count=1,damage=0,maxDamage=0)=>({identifier:'minecraft:'+identifier,count,damage,maxDamage,displayName:identifier,enchantments:{}});
function inventory(){const main=Array.from({length:36},air);main[0]=stack('diamond_sword');main[9]=stack('diamond',30);main[10]=stack('diamond',12);main[11]=stack('emerald',4);return{main,armor:[air(),air(),air(),stack('diamond_helmet',1,20,100)],crafting:[stack('diamond',2),air(),air(),air()],enderChest:[stack('ender_pearl',16),...Array.from({length:26},air)]};}
function player(){return{username:'Player',uuid:'fixture',position:{x:-941.2,y:9,z:1527.1},blockPosition:{x:-942,y:9,z:1527},velocity:{x:0,y:0,z:0},yaw:180,pitch:0,selectedSlot:0,gameMode:'creative',health:20,actualHealth:20,maxHealth:20,absorption:0,armor:0,food:20,air:300,maxAir:300,experienceLevel:0,experienceProgress:0,effects:[],mainHandStack:stack('diamond_sword'),offHandStack:air(),armorItems:[],scoreboard:{header:{text:'OPAI HUD',color:'white'},entries:[{name:{text:'Wins',color:'white'},score:{text:'8',color:'gold'}}]}};}
async function themedHud(page:Page,names:string[]){
    const shared:Record<string,string>={};const snapshot=()=>shared['opai.bridge.snapshot']=JSON.stringify({protocol:1,version:'1.2.0',at:Date.now(),connected:true,inWorld:true,singleplayer:true,serverAddress:null,ping:0,worldInfo:{biome:'minecraft:plains',dimension:'minecraft:overworld'},capabilities:{serverInfo:true,nametags:true,preview:true},errors:[]});snapshot();const timer=setInterval(snapshot,500);page.on('close',()=>clearInterval(timer));
    const api=await setup(page,false,shared);api.modules[0].keyBind.boundKey='key.keyboard.r';const data=inventory();
    const components=names.map((name,i)=>{const definition=JSON.parse(fs.readFileSync(`public/components/${name.toLowerCase()}.json`,'utf8'));return{id:name,name,settings:{enabled:true,zIndex:0,...defaults(definition.values),...(name==='Image'?{source:{active:'URL',value:{uRL:'opai/image/logo.svg'}},scale:.15}:{}),alignment:{horizontalAlignment:'Left',horizontalOffset:20+(i%4)*560,verticalAlignment:'Top',verticalOffset:20+Math.floor(i/4)*240}}};});
    await page.route('**/api/v1/client/components/opai',r=>r.fulfill({json:components}));
    await page.route('**/api/v1/client/input?*',r=>r.fulfill({json:{localized:'R',translationKey:'key.keyboard.r'}}));
    await page.route('**/api/v1/client/player',r=>r.fulfill({json:player()}));await page.route('**/api/v1/client/player/inventory',r=>r.fulfill({json:data}));
    await page.route('**/api/v1/client/info',r=>r.fulfill({json:{os:'mac',fps:285,gameVersion:'26.3',clientVersion:'0.41.0',clientDir:'/fixture/LiquidBounce',gameDir:'/fixture',inGame:true}}));
    await page.route('**/api/v1/client/resource/itemTexture?*',r=>{const id=new URL(r.request().url()).searchParams.get('id')?.split(':').at(-1)??'stone';const path=`tests/fixtures/items/${id==='compass'?'compass_16':id}.png`;return r.fulfill({contentType:'image/png',body:fs.readFileSync(fs.existsSync(path)?path:'tests/fixtures/items/stone.png')});});
    await page.goto('/#/hud?static&preview');await expect(page.locator('.draggable-element')).toHaveCount(names.length);
    return{...api,components,data,shared,player:player(),clear:()=>clearInterval(timer)};
}

test('standalone FPS and position panel use actual initial data, live yaw and bridge biome',async({page})=>{
    const api=await themedHud(page,['Fps','Coordinates']);try{
        await expect(page.getByLabel('FPS counter')).toHaveText('FPS: 285');const info=page.getByLabel('Coordinates and world information');await expect(info).toContainText('X: -941.2');await expect(info).toContainText('Y: 9.0');await expect(info).toContainText('Biome: Plains');await expect(info).toContainText('Facing: NORTH');
        api.emit('fps',{fps:172});api.emit('clientPlayerData',{playerData:{...api.player,position:{x:12.4,y:80,z:-.5},yaw:-90}});await expect(page.getByLabel('FPS counter')).toHaveText('FPS: 172');await expect(info).toContainText('X: 12.4');await expect(info).toContainText('Facing: EAST');
        await expect(info).toHaveCSS('border-radius','7px');await expect(info).toHaveCSS('font-size','9px');api.emit('disconnect',{});await expect(info).toContainText('X: —');expect(api.errors).toEqual([]);
    }finally{api.clear();}
});

test('equipment, crafting, ender chest and statistics share Opai cards and update reused stacks',async({page})=>{
    const api=await themedHud(page,['ArmorItems','CraftingInventory','EnderChestInventory','InventoryStatistics']);try{
        const equipment=page.getByRole('region',{name:'Equipment'}),crafting=page.getByRole('region',{name:'Crafting'}),ender=page.getByRole('region',{name:'Ender Chest'}),stats=page.getByRole('region',{name:'Items'});
        await expect(equipment.getByAltText('minecraft:diamond_helmet')).toBeVisible();expect(await equipment.locator('.durability').evaluate(el=>(el as HTMLElement).style.width)).toBe('80%');
        await expect(crafting.locator('.slot')).toHaveCount(4);await expect(ender.locator('.slot')).toHaveCount(27);const diamonds=stats.locator('.item-stack').filter({has:page.getByAltText('minecraft:diamond')});await expect(diamonds.locator('.count')).toHaveText('42');
        const update=inventory();update.main[9]=stack('diamond',3);update.main[10]=stack('diamond',1);update.armor[3]=stack('diamond_helmet',1,70,100);api.emit('clientPlayerInventory',{inventory:update});await expect(diamonds.locator('.count')).toHaveText('4');
        expect(await equipment.locator('.durability').evaluate(el=>parseFloat((el as HTMLElement).style.width))).toBe(30);for(const card of [equipment,crafting,ender,stats]){await expect(card).toHaveCSS('border-radius','7px');await expect(card).toHaveCSS('background-color','rgba(0, 0, 0, 0.6)');}
        api.emit('disconnect',{});await expect(equipment).toContainText('No equipment');expect(api.errors).toEqual([]);
    }finally{api.clear();}
});

test('remaining theme HUDs keep event data, shared cards and draggable alignment',async({page})=>{
    const names=['KeyBinds','Scoreboard','Text','BlockCounter','ClosedCaptions','Notifications','Hotbar','ArmorItems','CraftingInventory','EnderChestInventory','InventoryStatistics','Fps','Coordinates'];
    const api=await themedHud(page,names);try{
        api.emit('clientPlayerData',{playerData:api.player});api.emit('blockCountChange',{count:64,nextBlock:'minecraft:stone'});api.emit('closedCaptions',{entries:[{text:'Footsteps',textColor:-1,backgroundColor:-16777216,direction:'LEFT'}]});api.emit('notification',{title:'Opai HUD',message:'Styles applied',severity:'INFO'});
        await expect(page.locator('.scoreboard')).toContainText('Wins');await expect(page.locator('.keybinds')).toContainText('Aim Assist');await expect(page.locator('.counter')).toHaveText('64');await expect(page.locator('.closed-captions')).toContainText('Footsteps');await expect(page.locator('.notification')).toContainText('Styles applied');
        for(const selector of ['.keybinds','.scoreboard','.opai-custom-text','.counter','.notification']){await expect(page.locator(selector).first()).toHaveCSS('border-radius','14px');await expect(page.locator(selector).first()).toHaveCSS('background-color','rgba(0, 0, 0, 0.6)');}
        await expect(page.locator('.scoreboard .text').first()).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(page.locator('.closed-caption-entry > .text')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(page.locator('.counter')).toHaveCSS('transform','none');await expect(page.locator('.hotbar .slot')).toHaveCount(9);await expect(page.locator('.hotbar .slot').first()).toHaveCSS('width','45px');
        const body=page.locator('.draggable-element[data-component=Coordinates]');const original=(await body.boundingBox())!;await page.goto('/#/clickgui?static&preview');await page.getByRole('button',{name:'HUD Editor',exact:true}).click();const handle=page.locator('.draggable-element[data-component=Coordinates]');await expect(handle).toBeVisible();const box=(await handle.boundingBox())!;
        await page.mouse.move(box.x+20,box.y+20);await page.mouse.down();await page.mouse.move(box.x+80,box.y+65);await page.mouse.up();await expect.poll(()=>api.requests.filter(r=>r.path.includes('/Coordinates/alignment')).length).toBeGreaterThan(0);expect(original.width).toBeGreaterThan(0);expect(api.errors).toEqual([]);
    }finally{api.clear();}
});

test('all 26 theme HUD definitions render together and retain a common gallery appearance',async({page})=>{
    await page.setViewportSize({width:2400,height:1600});const names=JSON.parse(fs.readFileSync('public/metadata.json','utf8')).components as string[];expect(names).toHaveLength(26);
    const api=await themedHud(page,names);try{
        api.emit('clientPlayerData',{playerData:api.player});api.emit('blockCountChange',{count:96,nextBlock:'minecraft:stone'});api.emit('clientPlayerEffect',{effects:[{effect:'minecraft:speed',localizedName:'Speed',duration:1200,amplifier:1,color:0x7cafc6}]});api.emit('closedCaptions',{entries:[{text:'Footsteps',textColor:-1,backgroundColor:-16777216,direction:'RIGHT'}]});api.emit('notification',{title:'Opai HUD',message:'All HUD styles',severity:'INFO'});
        await page.addStyleTag({content:'.hud .taco{width:160px}.hud .image{max-width:160px}body{background:#8a9eb5}'});await page.evaluate(()=>document.fonts.ready);api.emit('targetChange',{target:api.player});await expect(page.locator('.fps-card')).toBeVisible();await expect(page.locator('.player-info')).toContainText('Plains');await expect(page.locator('.draggable-element')).toHaveCount(26);
        const surfaces:Record<string,string>={Watermark:'.island',TabGui:'.categories',Notifications:'.notification',Scoreboard:'.scoreboard',ArmorItems:'.opai-card',InventoryStatistics:'.opai-card',Inventory:'.opai-inventory',CraftingInventory:'.opai-card',EnderChestInventory:'.opai-card',TargetHud:'.targethud',BlockCounter:'.counter',Effects:'.effect',Keystrokes:'.key,.mouse-key',Text:'.opai-custom-text',KeyBinds:'.keybinds',ClosedCaptions:'.closed-caption-entry',SessionInfo:'.session',Coordinates:'.player-info',Fps:'.fps-icon,.fps-value'};
        for(const [name,selector] of Object.entries(surfaces)){
            const wrapper=page.locator(`.draggable-element[data-component="${name}"]`);await expect(wrapper.locator('.contained-element')).toHaveCSS('filter','none');
            const panels=wrapper.locator(selector);expect(await panels.count(),name).toBeGreaterThan(0);
            const zoomed=await wrapper.locator('.opai-hud-element').count()>0;
            for(const panel of await panels.all()){const shadow=await panel.evaluate(el=>getComputedStyle(el).boxShadow);expect(shadow,name).toContain(`0px 0px ${zoomed?4:8}px ${zoomed?2:4}px`);expect(shadow,name).toContain('0.467');}
        }
        for(const [name,selector,blur] of [['ArrayList','.arraylist',2],['Hotbar','.hotbar',4],['Taco','.taco img',4],['Image','.contained-element',4]] as const){
            const filter=await page.locator(`.draggable-element[data-component="${name}"]`).locator(selector).evaluate(el=>getComputedStyle(el).filter);expect(filter,name).toContain(`0px 0px ${blur}px`);expect(filter,name).toContain('0.467');
        }
        await page.screenshot({path:'reports/hud-gallery-1.12.2.png',fullPage:true});await page.addStyleTag({content:'.hotbar-elements .slot::before{box-shadow:0 0 2px #000}'});await page.keyboard.press('Control+Shift+F8');await page.getByLabel('网页绘制对照').selectOption('shadows');expect(await page.locator('.hotbar-elements .slot').first().evaluate(el=>getComputedStyle(el,'::before').boxShadow)).toBe('none');await page.getByRole('button',{name:'Close animation diagnostics',exact:true}).click();expect(await page.locator('.hotbar-elements .slot').first().evaluate(el=>getComputedStyle(el,'::before').boxShadow)).not.toBe('none');expect(api.errors).toEqual([]);
    }finally{api.clear();}
});

test('the moving Taco keeps a small image shadow without painting its full-width empty track or relaying out each frame',async({page})=>{
 const api=await themedHud(page,['Taco']);try{await expect(page.locator('.taco img')).toHaveClass(/transition/);await expect(page.locator('.taco')).toHaveCSS('box-shadow','none');await expect(page.locator('.taco')).toHaveCSS('filter','none');await expect(page.locator('.taco img')).not.toHaveCSS('filter','none');const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');const before=(await cdp.send('Performance.getMetrics')).metrics.find(m=>m.name==='LayoutCount')!.value;const positions=await page.locator('.taco img').evaluate(async el=>{const xs:number[]=[];for(let i=0;i<8;i++){await new Promise(r=>setTimeout(r,40));xs.push(new DOMMatrix(getComputedStyle(el).transform).e);}return xs;});expect(new Set(positions.map(Math.round)).size).toBeGreaterThan(2);const after=(await cdp.send('Performance.getMetrics')).metrics.find(m=>m.name==='LayoutCount')!.value;expect(after-before).toBeLessThanOrEqual(1);await cdp.detach();expect(api.errors).toEqual([]);}finally{api.clear();}
});
