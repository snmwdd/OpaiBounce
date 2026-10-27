import {test,expect,type Page} from '@playwright/test';
import {setup} from './fixtures';
import {accountKey,parseFolders,defaultFolders,createFolder,moveFolder,deleteFolder,assignAccount,folderCount} from '../src/opai/accountFolders';
import type {Account} from '../src/integration/types';
const KEY='opai.accounts.folders.v1';
const account=(id:number,username:string,uuid:string):Account=>({id,username,uuid,type:'Cracked',avatar:'',favorite:false});

test('folder validation, stable identity, recursive counts and deleting only a group',()=>{
 const accounts=[account(0,'First','one'),account(1,'Second','two')];let layout=defaultFolders(accounts);
 layout=createFolder(layout,'Child','offline','child');layout=assignAccount(layout,accountKey(accounts[1]),'child');
 expect(folderCount(layout,accounts,'offline')).toBe(2);expect(folderCount(layout,[{...accounts[1],id:0}],'child')).toBe(1);
 expect(()=>moveFolder(layout,'offline','child')).toThrow();expect(()=>createFolder(layout,' child ','offline','duplicate')).toThrow();expect(()=>createFolder(layout,'Orphan','missing','orphan')).toThrow();
 layout=deleteFolder(layout,'offline');expect(layout.folders.find(f=>f.id==='child')?.parent).toBe(null);expect(layout.assignments[accountKey(accounts[0])]).toBeUndefined();expect(layout.assignments[accountKey(accounts[1])]).toBe('child');
 expect(parseFolders(JSON.stringify(layout),accounts)).toEqual(layout);
 expect(()=>parseFolders('{"version":1,"folders":[{"id":"loop","name":"Loop","parent":"loop"}],"assignments":{}}',accounts)).toThrow();
});
async function openAccounts(page:Page){await page.goto('/#/altmanager?static&preview');await expect(page.locator('.rows')).toHaveAttribute('aria-busy','false');await expect(page.locator('.rows')).toHaveCSS('pointer-events','auto');}
async function folder(page:Page,name:string){return page.getByRole('button',{name:`Folder ${name}`,exact:true});}
export async function dragRow(page:Page,source:any,target:any){const from=(await source.boundingBox())!,to=(await target.boundingBox())!;await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:10});await page.mouse.up();await expect(source).toHaveCount(0);}
async function create(page:Page,name:string){await page.getByRole('button',{name:'New Folder',exact:true}).click();const dialog=page.getByRole('dialog',{name:'New Folder',exact:true});await dialog.getByLabel('Folder name').fill(name);await dialog.getByRole('button',{name:'Save Folder'}).click();await expect(dialog).toHaveCount(0);}

test('pink account folders create, nest, move, rename, reload and delete without deleting accounts',async({page})=>{
 const shared:Record<string,string>={};const api=await setup(page,false,shared);await openAccounts(page);
 await expect(await folder(page,'Offline')).toContainText('1 accounts.');await create(page,'Testing');
 await (await folder(page,'Offline')).dblclick();await dragRow(page,page.getByRole('button',{name:'Account Player',exact:true}),page.getByRole('button',{name:'Root folder'}));await page.getByRole('button',{name:'Root folder'}).click();await dragRow(page,page.getByRole('button',{name:'Account Player',exact:true}),await folder(page,'Testing'));let dialog;
 await (await folder(page,'Testing')).dblclick();
 await page.getByRole('button',{name:'Root folder'}).click();await expect(await folder(page,'Testing')).toContainText('1 accounts.');await (await folder(page,'Testing')).dblclick();await expect(page.getByRole('button',{name:'Account Player'})).toBeVisible();await create(page,'Nested');
 await page.reload();await expect(page.locator('.rows')).toHaveAttribute('aria-busy','false');await (await folder(page,'Testing')).click();await page.getByRole('button',{name:'Rename',exact:true}).click();dialog=page.getByRole('dialog',{name:'Rename Folder'});await dialog.getByLabel('Folder name').fill('Renamed');await dialog.getByRole('button',{name:'Save Folder'}).click();await expect(dialog).toHaveCount(0);
 await (await folder(page,'Renamed')).click();await page.getByRole('button',{name:'Delete',exact:true}).click();dialog=page.getByRole('dialog',{name:'Delete Renamed?'});await expect(dialog).toContainText('accounts and subfolders move');await dialog.getByRole('button',{name:'Delete',exact:true}).click();await expect(dialog).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Account Player'})).toBeVisible();await expect(await folder(page,'Nested')).toBeVisible();expect(api.requests.filter(r=>r.path==='/client/account'&&r.method==='DELETE')).toHaveLength(0);
 await expect(page.locator('.modal-wrapper')).toHaveCount(0);await page.screenshot({path:'reports/free-0.1-account-folders.png'});expect(api.errors).toEqual([]);
});

test('account login resolves identity again after native list indices change',async({page})=>{
 const api=await setup(page);let accounts=[account(0,'First','one'),account(1,'Second','two')];await page.route('**/api/v1/client/accounts',r=>r.fulfill({json:accounts}));await openAccounts(page);await (await folder(page,'Offline')).dblclick();await page.getByRole('button',{name:'Account Second'}).click();accounts=[account(0,'Second','two')];await page.getByRole('button',{name:'Login',exact:true}).click();await expect.poll(()=>api.requests.filter(r=>r.path==='/client/account/login').at(-1)?.body.id).toBe(0);
});

test('rejected folder persistence stays unsaved and malformed storage retains a recovery copy',async({page})=>{
 const shared={[KEY]:'broken data'};const api=await setup(page,false,shared);let reject=true;await page.route('**/api/v1/client/localStorage',async r=>{if(r.request().method()==='PUT'&&reject){await r.fulfill({status:403,json:{error:'denied'}});return;}await r.fallback();});
 await openAccounts(page);await expect(page.getByRole('button',{name:'Account Player'})).toBeVisible();await page.getByRole('button',{name:'New Folder',exact:true}).click();const dialog=page.getByRole('dialog',{name:'New Folder',exact:true});await dialog.getByLabel('Folder name').fill('Recovered');await dialog.getByRole('button',{name:'Save Folder'}).click();await expect(page.getByRole('alert').filter({hasText:'403'}).first()).toBeVisible();expect(shared[KEY]).toBe('broken data');await expect(await folder(page,'Recovered')).toHaveCount(0);
 reject=false;await dialog.getByRole('button',{name:'Save Folder'}).click();await expect(dialog).toHaveCount(0);expect(shared[KEY+'.recovery']).toBe('broken data');expect(JSON.parse(shared[KEY]).folders[0].name).toBe('Recovered');expect(api.errors).toEqual([]);
});
async function hudFixture(page:Page,scale:number,density=1){
 const api=await setup(page);await page.setViewportSize({width:Math.round(2000*density),height:Math.round(1100*density)});
 await page.route('**/api/v1/client/window',r=>r.fulfill({json:{width:2000,height:1100,scaleFactor:scale,guiScale:scale,scaledWidth:2000/scale,scaledHeight:1100/scale}}));
 const c={id:'sessioninfo',name:'SessionInfo',settings:{enabled:true,zIndex:0,kills:0,wins:0,alignment:{horizontalAlignment:'Right',horizontalOffset:18,verticalAlignment:'Bottom',verticalOffset:24}}};
 await page.route('**/api/v1/client/components/opai',r=>r.fulfill({json:[c]}));return api;
}
for(const [scale,density] of [[2,1],[3,1],[3,.75],[2,.5]])test(`HUD editor and overlay share coordinates at native scale ${scale}, CSS density ${density}`,async({page})=>{
 const api=await hudFixture(page,scale,density);const ratio=scale/2*density;
 await page.goto('/#/hud?static&preview');const el=page.locator('[data-component=SessionInfo]');await expect(el).toBeVisible();await page.evaluate(()=>document.fonts.ready);const before=(await el.boundingBox())!;expect(page.viewportSize()!.width-before.x-before.width).toBeCloseTo(18*ratio,0);
 await page.goto('/#/clickgui?static&preview');await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');await page.getByRole('button',{name:'HUD Editor',exact:true}).click();await expect(el).toBeVisible();await page.evaluate(()=>document.fonts.ready);const box=(await el.boundingBox())!;expect(box.width).toBeCloseTo(before.width,0);expect(box.x).toBeCloseTo(before.x,0);
 await page.mouse.move(box.x+10,box.y+10);await page.mouse.down();await page.mouse.move(box.x-80,box.y-50);await page.mouse.up();await expect.poll(()=>api.requests.filter(r=>r.path.endsWith('/sessioninfo/alignment')).length).toBe(1);const body=api.requests.find(r=>r.path.endsWith('/sessioninfo/alignment'))!.body;
 expect(body.horizontalOffset).toBeCloseTo(Math.round((box.x-90)/ratio),0);expect(body.verticalOffset).toBeCloseTo(Math.round((box.y-60)/ratio),0);expect(api.errors).toEqual([]);
});

test('late window snapshot cannot overwrite a newer HUD scale event',async({page})=>{
 const api=await setup(page);let resolve!:()=>void;const held=new Promise<void>(r=>resolve=r);let calls=0;
 await page.route('**/api/v1/client/window',async r=>{if(++calls===1)await held;await r.fulfill({json:{width:2000,height:1100,scaleFactor:2,guiScale:2,scaledWidth:1000,scaledHeight:550}});});
 await page.goto('/#/hud?static&preview');await expect.poll(()=>calls).toBeGreaterThan(0);api.emit('scaleFactorChange',{scaleFactor:3});resolve();await expect(page.locator('.hud-plane')).toHaveCSS('transform','matrix(1.5, 0, 0, 1.5, 0, 0)');await page.waitForTimeout(120);await expect(page.locator('.hud-plane')).toHaveCSS('transform','matrix(1.5, 0, 0, 1.5, 0, 0)');expect(api.errors).toEqual([]);
});

test('HUD cancels interrupted drags and restores original alignment on failed saves',async({page})=>{
 const api=await hudFixture(page,2);await page.route('**/api/v1/client/components/sessioninfo/alignment',r=>r.fulfill({status:500,json:{error:'failed'}}));
 await page.goto('/#/clickgui?static&preview');await page.getByRole('button',{name:'HUD Editor',exact:true}).click();const el=page.locator('[data-component=SessionInfo]');await expect(el).toBeVisible();const box=(await el.boundingBox())!;
 await page.mouse.move(box.x+10,box.y+10);await page.mouse.down();await page.mouse.move(box.x-80,box.y-50);await page.mouse.up();await expect(page.getByRole('alert').filter({hasText:'Original position restored'})).toBeVisible();expect((await el.boundingBox())!.x).toBeCloseTo(box.x,0);
 await page.mouse.move(box.x+10,box.y+10);await page.mouse.down();await page.mouse.move(box.x-20,box.y-20);await el.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();expect((await el.boundingBox())!.x).toBeCloseTo(box.x,0);
});

test('editor flag writes stay ordered across rapid exit and reentry',async({page})=>{
 const api=await hudFixture(page,2);const applied:boolean[]=[];let release!:()=>void;let holding=true;const held=new Promise<void>(r=>release=r);
 await page.route('**/api/v1/client/hud-editor',async r=>{const value=r.request().postDataJSON().selected;if(!value&&holding){holding=false;await held;}applied.push(value);await r.fulfill({status:204});});
 await page.goto('/#/clickgui?static&preview');await page.getByRole('button',{name:'HUD Editor',exact:true}).click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'HUD Editor',exact:true}).click();release();await expect.poll(()=>applied.at(-1)).toBe(true);await expect(page.locator('.opai-hud-editor')).toBeVisible();await page.keyboard.press('Escape');await expect.poll(()=>applied.at(-1)).toBe(false);expect(api.errors).toEqual([]);
});

test('resizing during a HUD drag cancels instead of saving another coordinate system',async({page})=>{
 const api=await hudFixture(page,2);await page.goto('/#/clickgui?static&preview');await page.getByRole('button',{name:'HUD Editor',exact:true}).click();const el=page.locator('[data-component=SessionInfo]');await expect(el).toBeVisible();const box=(await el.boundingBox())!;await page.mouse.move(box.x+10,box.y+10);await page.mouse.down();await page.mouse.move(box.x-80,box.y-40);await page.setViewportSize({width:1800,height:1000});await expect(el).not.toHaveClass(/dragging/);await page.mouse.up();expect(api.requests.filter(r=>r.path.endsWith('/sessioninfo/alignment'))).toHaveLength(0);expect(await el.evaluate(e=>(e as HTMLElement).style.right)).toBe('18px');expect(api.errors).toEqual([]);
});

test('new accounts are assigned to the open folder and addition errors keep the dialog open',async({page})=>{
 const shared:Record<string,string>={};const api=await setup(page,false,shared);let accounts=[account(0,'Player','test')];await page.route('**/api/v1/client/accounts',r=>r.fulfill({json:accounts}));await openAccounts(page);await create(page,'New Accounts');const id=JSON.parse(shared[KEY]).folders.find((f:any)=>f.name==='New Accounts').id;await (await folder(page,'New Accounts')).dblclick();await page.getByRole('button',{name:'Add Account',exact:true}).click();api.emit('accountManagerAddition',{username:null,error:'Login failed'});await expect(page.getByRole('dialog',{name:'Add Account',exact:true})).toBeVisible();
 accounts.push(account(1,'New Player','new-uuid'));api.emit('accountManagerAddition',{username:'New Player',error:null});await expect(page.getByRole('dialog',{name:'Add Account',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Account New Player'})).toBeVisible();await expect.poll(()=>JSON.parse(shared[KEY]).assignments['cracked:new-uuid']).toBe(id);expect(api.errors).toEqual([]);
});

test('a failed folder read leaves accounts usable in Root without overwriting storage',async({page})=>{
 const api=await setup(page);await page.route('**/api/v1/client/localStorage?*',r=>r.fulfill({status:500,json:{error:'unavailable'}}));await openAccounts(page);await expect(page.getByRole('button',{name:'Account Player'})).toBeVisible();await page.getByRole('button',{name:'Account Player'}).click();await page.getByRole('button',{name:'Login',exact:true}).click();await expect.poll(()=>api.requests.filter(r=>r.path==='/client/account/login').length).toBe(1);expect(api.requests.filter(r=>r.path==='/client/localStorage'&&r.method==='PUT'&&r.body?.key===KEY)).toHaveLength(0);
});

test('account login success uses the existing island morph and success icon, then returns to hidden idle',async({page})=>{
 const api=await setup(page);await openAccounts(page);const shell=page.locator('.login-notice .island');await expect(page.locator('.login-notice .island-visibility')).toHaveAttribute('aria-hidden','true');api.emit('accountManagerLogin',{username:null,error:'Bad login'});await expect(shell.locator('[data-kind=success]')).toHaveCount(0);
 api.emit('accountManagerLogin',{username:'NewAccount',error:null});await expect(shell.locator('.notice-row')).toHaveCount(1);await expect(shell).toContainText('Alt Manager');await expect(shell).toContainText('Successfully login as NewAccount');await expect(page.getByRole('heading',{name:'Alt Manager',includeHidden:true})).toHaveCSS('opacity','0');await expect(shell.locator('[data-kind=success]')).toHaveCount(1);await expect(shell).toHaveAttribute('data-motion-active','true');await expect(shell).toHaveAttribute('data-motion-active','false');
 await page.locator('.login-notice').screenshot({path:'reports/free-0.1-login-notice.png'});await expect(shell.locator('.notice-row')).toHaveCount(0,{timeout:4500});await expect(page.locator('.login-notice .island-visibility')).toHaveAttribute('aria-hidden','true');await expect(page.getByRole('heading',{name:'Alt Manager'})).toHaveCSS('opacity','1');expect(api.errors).toEqual([]);
});

test('login notification also works on the game HUD and a late session response cannot revert the name',async({page})=>{
 const api=await setup(page);let release!:()=>void;const held=new Promise<void>(r=>release=r);await page.route('**/api/v1/client/session',async r=>{await held;await r.fulfill({json:{username:'OldAccount',uuid:'old',avatar:'',type:'Cracked',online:false}});});await page.goto('/#/hud?static&preview');await expect(page.locator('.island')).toBeVisible();api.emit('accountManagerLogin',{username:'ActualAccount',error:null});await expect(page.locator('.notice-row')).toContainText('ActualAccount');release();await expect(page.locator('.island .username')).toHaveText('ActualAccount');await expect(page.locator('.notice-row')).toHaveCount(0,{timeout:4500});await expect(page.locator('.island')).not.toHaveClass(/notice/);expect(api.errors).toEqual([]);
});
