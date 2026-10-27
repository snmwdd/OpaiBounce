import {test,expect,type Page,type Locator} from '@playwright/test';
import fs from 'node:fs';
import {setup} from './fixtures';
import {parseActivity} from '../src/opai/activityModel';
import {parseOrder,ordered,moveOrder} from '../src/opai/listOrder';
const key='opai.accounts.folders.v1';
const air=()=>({identifier:'minecraft:air',count:0,damage:0,maxDamage:0,enchantments:{}});
const stack=(id:string,count=1)=>({...air(),identifier:'minecraft:'+id,count});
const chest=(rows=3)=>({session:'4:1',containerId:4,rows,stacks:Array.from({length:rows*9},(_,i)=>i%4===0?stack('diamond',i===0?27:1):air()),feedback:[] as any[],open:true,interactive:true});
async function drag(page:Page,source:Locator,target:Locator,before=true,release=true){const a=(await source.boundingBox())!,b=(await target.boundingBox())!;await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height*(before?.2:.8),{steps:12});if(release)await page.mouse.up();}

test('activity validator rejects stale data and invalid inventories; order uses stable identities',()=>{
 const value={protocol:1,at:1000,breaking:{id:'minecraft:red_bed',name:'床',position:[1,2,3],progress:.29},container:chest()};expect(parseActivity(JSON.stringify(value),1000)?.container?.stacks).toHaveLength(27);expect(parseActivity(JSON.stringify(value),2300)).toBe(null);expect(parseActivity(JSON.stringify({...value,container:{...chest(),rows:99}}),1000)?.container).toBe(null);expect(parseActivity(JSON.stringify({...value,breaking:{...value.breaking,progress:Infinity}}),1000)?.breaking).toBe(null);
 expect(ordered([{id:'a'},{id:'b'},{id:'new'}],parseOrder('["b","b","a"]'),x=>x.id).map(x=>x.id)).toEqual(['b','a','new']);expect(moveOrder(['a','b','c'],'c','a',true)).toEqual(['c','a','b']);
});
for(const route of ['multiplayer','singleplayer'])test(`${route} drag sorting persists and still activates the correct native item`,async({page})=>{
 const shared:Record<string,string>={};const api=await setup(page,false,shared);
 const items=route==='multiplayer'?['First','Second','Third'].map((name,id)=>({id,name,address:name.toLowerCase()+'.example.org',icon:'',online:false,players:{online:0,max:0},ping:-1,resourcePackPolicy:'Prompt'})):['First','Second','Third'].map((displayName,id)=>({id,displayName,name:'world-'+id,gameMode:'creative',version:'26.3',icon:''}));
 await page.route('**/api/v1/client/'+(route==='multiplayer'?'servers':'worlds'),r=>r.fulfill({json:items}));await page.goto(`/#/${route}?static&preview`);const rows=page.locator('.rows .row');await expect(rows).toHaveCount(3);await expect.poll(()=>page.locator('.rows').getAttribute('style')).toContain('rotateY(0deg) scale(1)');await drag(page,rows.nth(2),rows.nth(0));await expect(rows.first().locator('.row-title')).toHaveText('Third');await page.reload();await expect(rows.first().locator('.row-title')).toHaveText('Third');await rows.first().dblclick();
 const path=route==='multiplayer'?'/client/servers/connect':'/client/worlds/join';await expect.poll(()=>api.requests.filter(r=>r.path===path).length).toBe(1);const request=api.requests.find(r=>r.path===path)!;if(route==='multiplayer')expect(request.body.address).toBe('third.example.org');else expect(request.body.name).toBe('world-2');expect(api.errors).toEqual([]);await page.screenshot({path:`reports/free-0.1.1-${route}-order.png`});
});

test('accounts sort by dragging and a cancelled drag never moves or logs in',async({page})=>{
 const shared:Record<string,string>={};const api=await setup(page,false,shared);const accounts=['First','Second','Third'].map((username,id)=>({id,username,uuid:'u'+id,type:'Cracked',favorite:false,avatar:''}));await page.route('**/api/v1/client/accounts',r=>r.fulfill({json:accounts}));await page.goto('/#/altmanager?static&preview');await page.getByRole('button',{name:'Folder Offline',exact:true}).dblclick();const rows=page.locator('.account');await expect(rows).toHaveCount(3);await expect(page.getByRole('button',{name:'Move To',exact:true})).toHaveCount(0);await drag(page,rows.nth(2),rows.nth(0));await expect(rows.first()).toContainText('Third');
 const saved=shared['opai.order.accounts.v1'];await drag(page,rows.nth(0),page.locator('.row.parent'),true,false);await expect(page.locator('.drag-ghost')).toBeVisible();await page.keyboard.press('Escape');await page.mouse.up();await expect(rows).toHaveCount(3);expect(shared['opai.order.accounts.v1']).toBe(saved);expect(api.requests.filter(r=>r.path==='/client/account/login')).toHaveLength(0);
 await page.reload();await page.getByRole('button',{name:'Folder Offline',exact:true}).dblclick();await expect(rows.first()).toContainText('Third');expect(api.errors).toEqual([]);
});

async function activity(page:Page){
 let state:any={protocol:1,at:Date.now(),breaking:null,container:null};const shared:Record<string,string>={};const api=await setup(page,false,shared);const timer=setInterval(()=>shared['opai.bridge.snapshot']=JSON.stringify({protocol:1,at:Date.now(),version:'1.5.0',connected:true,inWorld:true,serverAddress:'play.example.org',ping:32,capabilities:{preview:true,serverInfo:true,nametags:true,activity:true},errors:[]}),100);shared['opai.bridge.snapshot']=JSON.stringify({protocol:1,at:Date.now(),version:'1.5.0',connected:true,inWorld:true,capabilities:{preview:true,serverInfo:true,nametags:true,activity:true}});
 await page.route('**/api/v1/client/localStorage?*',async r=>{if(new URL(r.request().url()).searchParams.get('key')!=='opai.bridge.activity'){await r.fallback();return;}await r.fulfill({json:{value:JSON.stringify({...state,at:Date.now()})}});});
 await page.route('**/api/v1/client/resource/itemTexture?*',r=>r.fulfill({contentType:'image/png',body:fs.readFileSync('tests/fixtures/items/diamond.png')}));
 await page.goto('/#/hud?static&preview');await expect(page.locator('.island')).toBeVisible();page.on('close',()=>clearInterval(timer));return{...api,set(value:any){state={protocol:1,at:Date.now(),breaking:null,container:null,...value};},clear(){clearInterval(timer);}};
}

test('island displays real breaking percentages without width jitter and returns to idle',async({page})=>{
 const api=await activity(page);try{api.set({breaking:{id:'minecraft:red_bed',name:'床',position:[1,2,3],progress:.05}});const shell=page.locator('.island');const panel=page.locator('.breaking-content');await expect(panel).toHaveAttribute('aria-hidden','false');await expect(panel).toContainText('Breaking 床');await expect(panel).toContainText('Break Progress: 5%');await expect(shell).toHaveAttribute('data-motion-active','false');const width=(await shell.boundingBox())!.width;api.set({breaking:{id:'minecraft:red_bed',name:'床',position:[1,2,3],progress:.29}});await expect(panel).toContainText('Break Progress: 29%');expect((await shell.boundingBox())!.width).toBeCloseTo(width,0);await expect(panel.getByRole('progressbar')).toHaveAttribute('aria-valuenow','29');await shell.screenshot({path:'reports/free-0.1.1-breaking-island.png'});
 api.set({});await expect(panel).toHaveAttribute('aria-hidden','true');await expect(shell).not.toHaveClass(/notice/);await expect(shell).toHaveAttribute('data-motion-active','false');expect(api.errors).toEqual([]);}finally{api.clear();}
});

test('chest slots keep real order, clip their ripples and survive bed/chest/idle transitions',async({page})=>{
 const api=await activity(page);try{let container=chest();api.set({container});const shell=page.locator('.island');await expect(page.locator('.chest-content')).toHaveAttribute('aria-hidden','false');const slots=page.locator('.chest-slot');await expect(slots).toHaveCount(27);await expect(slots.nth(0).locator('.count')).toHaveText('27');await expect(slots.nth(1).locator('img')).toHaveCount(0);await expect(slots.first()).toHaveCSS('overflow','hidden');await expect(shell).toHaveAttribute('data-motion-active','false');await expect.poll(()=>api.requests.filter(r=>r.body?.key==='opai.bridge.containerView').length).toBeGreaterThan(0);
 container={...container,stacks:[air(),...container.stacks.slice(1)],feedback:[{slot:0,at:Date.now(),id:'take-1'}]};api.set({container});await expect.poll(()=>slots.nth(0).locator('.slot-ripple').evaluate(el=>el.getAnimations().length)).toBeGreaterThan(0);await expect(slots.nth(0).locator('img')).toHaveCount(0);await shell.screenshot({path:'reports/free-0.1.1-chest-island.png'});
 await slots.nth(4).click();await expect.poll(()=>api.requests.filter(r=>r.body?.key==='opai.bridge.containerClick').length).toBe(1);const cmd=JSON.parse(api.requests.find(r=>r.body?.key==='opai.bridge.containerClick')!.body.value);expect(cmd.slot).toBe(4);expect(cmd.session).toBe('4:1');
 api.set({breaking:{id:'minecraft:red_bed',name:'床',position:[1,2,3],progress:.8},container:{...chest(6),session:'5:2'}});await expect(slots).toHaveCount(54);await expect(page.locator('.breaking-content')).toHaveAttribute('aria-hidden','true');api.set({breaking:{id:'minecraft:red_bed',name:'床',position:[1,2,3],progress:.8}});await expect(page.locator('.breaking-content')).toHaveAttribute('aria-hidden','false');await expect(slots).toHaveCount(0);api.set({});await expect(shell).not.toHaveClass(/notice/);await expect(shell).toHaveAttribute('data-motion-active','false');expect(api.errors).toEqual([]);
 }finally{api.clear();}
});
