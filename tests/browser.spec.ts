import {test,expect} from '@playwright/test';
import {MascotPhysics} from '../src/opai/mascotPhysics';
import {protocolArt} from '../src/opai/protocolArt';
import {opaiCategories} from '../src/opai/categories';
import {quintOut,cubicOut,Morph,SpriteClock,openingScale,Approach} from '../src/opai/motion';

import {setup} from './fixtures';
import {BlockStats} from '../src/opai/blockStats';
import {rgbToHsv,hsvToRgb} from '../src/opai/color';
import {intToRgba} from '../src/integration/util';

test('original easing, spring and five-column mapping',() => {
    expect(quintOut(.5)).toBe(.96875); expect(cubicOut(.5)).toBe(.875);
    const spring=new Morph();expect(spring.value(23,0)).toBe(23);spring.value(36,16,false,5);
    const samples=[32,64,128,256,512,1024,2048].map(t=>spring.value(36,t));
    expect(samples[0]).toBeGreaterThan(23);expect(samples.at(-1)).toBeCloseTo(36,2);
    const groups=opaiCategories([{name:'A',category:'Render'},{name:'B',category:'World'},{name:'C',category:'NewCategory'}] as any);
    expect(Object.keys(groups)).toEqual(['Combat','Movement','Player','Visual','Misc']);expect(groups.Visual[0].name).toBe('A');expect(Object.values(groups).flat()).toHaveLength(3);
});
test('title geometry, assets and real screen navigation',async ({page}) => {
    const api=await setup(page);await page.goto('/#/title?static&preview');
    await expect(page.getByRole('heading',{name:'Opai',exact:true})).toBeVisible();
    const box=await page.locator('.menu-buttons').boundingBox();expect(box?.width).toBeCloseTo(280);expect(box?.height).toBeCloseTo(296.4,0);expect(box?.x).toBeCloseTo(860);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.quick-links')).toHaveCount(0);await expect(page.getByRole('button',{name:'ClickGUI',exact:true})).toHaveCount(0);
    await page.screenshot({path:'reports/title.png'});
    await page.getByRole('button',{name:'Multi player',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Server Selector'})).toBeVisible();
    await expect(page.getByText('mc.loyisa.cn',{exact:true})).toBeVisible();
    await page.locator('.opai-list').evaluate(async el => {await Promise.all(el.getAnimations().map(a=>a.finished));});
    await page.screenshot({path:'reports/servers.png'});expect(api.errors).toEqual([]);
});
test('five columns, toggle event, right click settings and PUT save',async ({page}) => {
    const api=await setup(page);await page.goto('/#/clickgui?static&preview');
    await expect(page.locator('.panel')).toHaveCount(5);
    const first=page.locator('.panel').first();
    await expect(first.locator('.category')).toHaveText('Combat');
    await expect.poll(()=>first.evaluate(el=>el.getBoundingClientRect().width)).toBe(304);
    const box=await first.boundingBox();expect(box?.width).toBeCloseTo(304);expect(box?.x).toBeCloseTo(60);
    const aim=first.locator('.module .name').filter({hasText:'Aim Assist'}).first();await aim.click();
    await expect.poll(()=>api.requests.filter(r=>r.path==='/client/modules/toggle').length).toBe(1);
    expect(api.requests.find(r=>r.path==='/client/modules/toggle')?.body).toEqual({name:'AimAssist'});
    await expect(aim).not.toHaveClass(/enabled/);
    await aim.click({button:'right'});await expect(first.locator('.slider')).toHaveCount(3);
    await first.locator('.slider').first().focus();await page.keyboard.press('ArrowRight');
    await expect.poll(()=>api.requests.filter(r=>r.path==='/client/modules/settings' && r.method==='PUT').length).toBeGreaterThan(0);
    await page.mouse.move(1900,900);
    await expect(first.locator('.settings')).toBeVisible();
    await expect(first.locator('.module').first().locator('.reveal.visible').first()).toHaveAttribute('data-motion-active','false');
    const moduleName=(await first.locator('.module').first().locator('.name').boundingBox())!,firstLabel=(await first.locator('.number-label').first().boundingBox())!;expect(firstLabel.y).toBeGreaterThanOrEqual(moduleName.y+moduleName.height-.5);
    expect(await first.locator('.reveal').evaluateAll(nodes=>nodes.every(n=>n.scrollTop===0))).toBe(true);
    await first.locator('.modules').evaluate(el=>el.scrollTo({top:0,behavior:'instant'}));
    await first.locator('.settings').evaluate(async el => {await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished));});
    await expect(first.locator('[data-setting=Smoothness]')).toBeVisible();
    await expect(page.locator('.description-wrapper')).toHaveCount(0);
    await page.screenshot({path:'reports/clickgui-expanded.png'});expect(api.errors).toEqual([]);
});
test('server addition uses backend and refreshes the list',async ({page}) => {
    const api=await setup(page);await page.goto('/#/multiplayer?static&preview');await page.getByRole('button',{name:'Add Server',exact:true}).click();
    const modal=page.locator('.modal');await expect(modal).toBeVisible();
    await modal.locator('input').nth(0).fill('Test Server');await modal.locator('input').nth(1).fill('localhost:25565');
    await modal.getByRole('button',{name:'Confirm',exact:true}).click();
    await expect(page.getByText('Test Server',{exact:true})).toBeVisible();
    expect(api.requests.find(r=>r.path==='/client/servers/add')?.body.address).toBe('localhost:25565');expect(api.errors).toEqual([]);
});
test('dynamic island consumes session, FPS and module events',async ({page}) => {
    const api=await setup(page);await page.goto('/#/hud?static&preview');
    await expect(page.locator('.island')).toBeVisible();api.emit('fps',{fps:240});await expect(page.locator('.island')).toContainText('240 fps');
    api.emit('moduleToggle',{moduleName:'Flight',enabled:true});await expect(page.locator('.island')).toContainText('Module Toggled');
    await expect.poll(async () => (await page.locator('.island').boundingBox())?.height).toBeGreaterThan(65);
    await page.screenshot({path:'reports/island-notice.png'});await expect(page.locator('.island')).toContainText('240 fps',{timeout:3000});expect(api.errors).toEqual([]);
});
test('intro completes, small window and fresh open do not leak controls',async ({page}) => {
    const api=await setup(page,true);await page.setViewportSize({width:960,height:640});await page.goto('/#/title?static&preview');
    await expect(page.getByLabel('Loading Opai theme')).toBeVisible();
    await expect(page.locator('.stage path')).toHaveAttribute('d',/A/);
    await page.waitForFunction(() => {const cover=document.querySelector('.stage .cover');return !cover || cover.getBoundingClientRect().height<20;});
    await page.screenshot({path:'reports/intro.png'});
    await expect(page.getByLabel('Loading Opai theme')).toHaveCount(0,{timeout:7000});
    await expect(page.getByRole('button',{name:'Shutdown',exact:true})).toBeVisible();expect(api.errors).toEqual([]);
});

test('middle click captures a native key event and saves the bind',async ({page}) => {
    const api=await setup(page);await page.goto('/#/clickgui?static&preview');
    const aim=page.locator('.panel').first().locator('.module .name').first();
    await aim.click({button:'middle'});await expect(aim).toContainText('Press a key');
    api.emit('keyboardKey',{key:'key.keyboard.k',keyCode:107,action:1,scanCode:0,mods:0,screen:{class:'net.ccbluex.liquidbounce.ClickGui',title:'ClickGUI'}});
    await expect(aim).toContainText('Aim Assist');
    await expect.poll(()=>api.requests.filter(r=>r.path==='/client/modules/settings'&&r.method==='PUT').length).toBe(1);
    expect(api.requests.find(r=>r.path==='/client/modules/settings'&&r.method==='PUT')?.body.value.find((v:any)=>v.name==='Bind').value.boundKey).toBe('key.keyboard.k');
    expect(api.errors).toEqual([]);
});
test('installed theme resolves assets below /local/opai',async ({page}) => {
    const api=await setup(page);const failed:string[]=[];
    // Missing optional storage keys return 403; this check covers installed assets.
    page.on('response',r=>{if(r.status()>=400&&!new URL(r.url()).pathname.startsWith('/api/'))failed.push(r.url());});
    await page.route('**/local/opai/**',async route=>{
        const url=new URL(route.request().url());url.pathname=url.pathname.replace('/local/opai','') || '/';
        const response=await route.fetch({url:url.toString()});await route.fulfill({response});
    });
    await page.goto('/local/opai/#/title?static&preview');await page.evaluate(()=>document.fonts.ready);
    await expect(page.getByRole('button',{name:'Single player',exact:true})).toBeVisible();
    expect(await page.locator('.backdrop').evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('/local/opai/opai/image/background.png');
    expect(failed).toEqual([]);expect(api.errors).toEqual([]);
});
test('backend failure is visible and does not create a fake list',async ({page}) => {
    const api=await setup(page);
    await page.route('**/api/v1/client/servers',route=>route.fulfill({status:503,json:{error:'Service unavailable'}}));
    await page.goto('/#/multiplayer?static&preview');
    await expect(page.locator('.api-error')).toContainText('503');await expect(page.locator('.row')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Join Server'})).toBeDisabled();expect(api.errors).toEqual([]);
});

test('configuration create and load persist actual module snapshots',async ({page}) => {
    const api=await setup(page);await page.goto('/#/clickgui?static&preview');
    await page.getByRole('button',{name:'Configurations',exact:true}).click();
    await page.getByRole('button',{name:'Add configuration',exact:true}).click();
    await page.getByPlaceholder('Configuration name').fill('Opai Test');
    await page.getByRole('button',{name:'Create',exact:true}).click();
    await expect(page.getByRole('button',{name:'Opai Test.json',exact:true})).toBeVisible();
    // Change a mixed enabled/disabled snapshot before loading, then load it twice.
    const aim=page.locator('.panel').first().locator('.module .name').first();await aim.click();
    const flight=api.modules.find(m=>m.name==='Flight')!;flight.enabled=true;
    await page.getByRole('button',{name:'Load',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Loaded');
    expect(api.modules.filter(m=>m.enabled).map(m=>m.name)).toEqual(['AimAssist']);
    const writes=api.requests.filter(r=>r.path==='/client/modules/toggle');
    expect(writes.map(r=>r.method)).toEqual(['DELETE','PUT','DELETE']);
    expect(api.requests.filter(r=>r.path==='/client/modules/settings'&&r.method==='PUT').length).toBeGreaterThan(50);
    expect(api.requests.filter(r=>r.path==='/client/modules/settings'&&r.method==='PUT').every(r=>!r.body.value.some((v:any)=>v.name==='Enabled'))).toBe(true);
    await page.getByRole('button',{name:'Load',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Loaded');
    expect(api.modules.filter(m=>m.enabled).map(m=>m.name)).toEqual(['AimAssist']);
    expect(api.requests.filter(r=>r.path==='/client/modules/toggle')).toHaveLength(writes.length);
    await expect.poll(()=>api.requests.filter(r=>r.path==='/client/localStorage'&&r.method==='PUT').length).toBeGreaterThan(0);
    await page.screenshot({path:'reports/configurations.png'});expect(api.errors).toEqual([]);
});

test('island keeps the newest three notifications',async ({page}) => {
    const api=await setup(page);await page.goto('/#/hud?static&preview');await expect(page.locator('.island')).toBeVisible();
    for(const moduleName of ['One','Two','Three','Four'])api.emit('moduleToggle',{moduleName,enabled:true});
    await expect(page.locator('.notice-row')).toHaveCount(3);await expect(page.locator('.island')).not.toContainText('One has been');
    await expect(page.locator('.island')).toContainText('Four has been');expect(api.errors).toEqual([]);
});

test('HUD shows real inventory events, skin crop, potion names and target health',async ({page}) => {
    const api=await setup(page);await page.goto('/#/hud?static&preview');await expect(page.locator('.opai-inventory .slot')).toHaveCount(27);
    api.emit('clientPlayerEffect',{effects:[{effect:'minecraft:night_vision',localizedName:'Night Vision',duration:9580,amplifier:0,color:0x1f1fa1},{effect:'minecraft:speed',localizedName:'Speed',duration:1780,amplifier:1,color:0x7cafc6}]});
    api.emit('targetChange',{target:{username:'Player',uuid:'test',actualHealth:16,maxHealth:20}});
    await expect(page.locator('.targethud .name')).toContainText('Player 16');await expect(page.locator('.effects')).toContainText('II');
    await expect(page.locator('.session .head img').first()).toBeVisible();
    await expect(page.locator('.track>div')).toHaveAttribute('style',/80%/);
    await page.screenshot({path:'reports/hud.png'});expect(api.errors).toEqual([]);
});


test('oG timer advances one frame per sample and resets on a new collision',()=>{
    expect(openingScale(0)).toBeCloseTo(.58,8);expect(openingScale(320)).toBe(1);
    const sprite=new SpriteClock();expect(sprite.tick(100)).toBe(-1);
    sprite.start(100);expect(sprite.tick(159)).toBe(0);expect(sprite.tick(160)).toBe(1);
    expect(sprite.tick(900)).toBe(2);expect(sprite.tick(959)).toBe(2);
    sprite.start(1000);expect(sprite.tick(1000)).toBe(0);
    for(let frame=1;frame<=16;frame++)expect(sprite.tick(1000+frame*60)).toBe(frame);
    expect(sprite.tick(2020)).toBe(-1);expect(sprite.tick(3000)).toBe(-1);
});

test('ripple is clipped by its own menu button and releases outside it',async({page})=>{
    const api=await setup(page);await page.goto('/#/title?static&preview');
    const button=page.getByRole('button',{name:'Multi player',exact:true});
    const b=(await button.boundingBox())!;
    await page.mouse.move(b.x+10,b.y+10);await page.mouse.down();
    const wave=button.locator('.opai-ripple');await expect(wave).toHaveCount(1);
    expect(await button.evaluate(el=>getComputedStyle(el).overflow)).toBe('hidden');
    await expect.poll(()=>wave.evaluate(el=>Number(el.getAttribute('style')?.match(/scale\(([^)]+)\)/)?.[1]))).toBe(1);
    await page.screenshot({path:'reports/ripple-held.png'});
    await page.mouse.move(30,1000);await page.mouse.up();await expect(wave).toHaveCount(0);
    await expect(page.locator('.title-screen')).toBeVisible();expect(api.errors).toEqual([]);
});

test('requested screens have no search boxes',async({page})=>{
    const api=await setup(page);
    for(const route of ['clickgui','multiplayer','altmanager','proxymanager']){
        await page.goto('/#/'+route+'?static&preview');
        if(route==='clickgui')await expect(page.locator('.panel')).toHaveCount(5);
        else await expect(page.locator('.opai-list')).toBeVisible();
        await expect(page.locator('input[type=search],input[placeholder*=Search],.search-input,.account-search')).toHaveCount(0);
    }
    expect(api.errors).toEqual([]);
});

test('settings load on expansion, use Opai controls and save nested CHOICE',async({page})=>{
    const api=await setup(page);await page.goto('/#/clickgui?static&preview');
    await expect(page.locator('.panel')).toHaveCount(5);
    expect(api.requests.filter(r=>r.path==='/client/modules/settings' && !['ClickGUI','HUD'].includes(r.name??''))).toHaveLength(0);
    const aim=page.locator('.panel').first().locator('.module').first();await aim.locator('.name').first().click({button:'right'});
    const through=aim.locator('[data-setting=ThroughWalls]');await through.getByRole('checkbox').check();
    await expect.poll(()=>api.requests.filter(r=>r.method==='PUT'&&r.name==='AimAssist').length).toBeGreaterThan(0);
    const mode=aim.locator('[data-setting=Mode]');await mode.locator('.field').first().click();await mode.getByRole('button',{name:'Linear',exact:true}).click();
    await expect(aim.locator('[data-setting=Delay]')).toBeVisible();await expect(aim.locator('[data-setting=Smoothness]')).toHaveCount(0);
    const delay=aim.getByRole('spinbutton',{name:'Delay value'});await delay.fill('7');await delay.press('Tab');
    await expect.poll(()=>api.requests.filter(r=>r.method==='PUT'&&r.name==='AimAssist').at(-1)?.body.value.find((v:any)=>v.name==='Mode').choices.Linear.value[0].value).toBe(7);
    await expect(aim.locator('.noUi-target,.switch,.dropdown-setting')).toHaveCount(0);
    expect(api.errors).toEqual([]);
});

test('HUD pencil enters drag-only editor and saves alignment',async({page})=>{
    const api=await setup(page);await page.goto('/#/clickgui?static&preview');
    await page.getByRole('button',{name:'HUD Editor',exact:true}).click();
    await expect(page.locator('.opai-hud-editor')).toBeVisible();
    await expect(page.locator('.component-drawer,.component-settings,.tab-bar,.grid')).toHaveCount(0);
    await expect(page.locator('.opai-hud-editor button')).toHaveCount(0);
    const element=page.locator('[data-component=SessionInfo]');await expect(element).toBeVisible();
    const before=(await element.boundingBox())!;
    await page.mouse.move(before.x+15,before.y+15);await page.mouse.down();await page.mouse.move(before.x+135,before.y+95,{steps:8});await page.mouse.up();
    await expect.poll(()=>api.requests.filter(r=>r.path==='/client/components/sessioninfo/alignment').length).toBe(1);
    const after=(await element.boundingBox())!;expect(after.x-before.x).toBeCloseTo(120,0);expect(after.y-before.y).toBeCloseTo(80,0);
    expect(api.requests.find(r=>r.path==='/client/components/sessioninfo/alignment')?.body.horizontalAlignment).toBe('Left');
    await page.screenshot({path:'reports/hud-editor.png'});
    await page.keyboard.press('Escape');await expect(page.locator('.panel')).toHaveCount(5);expect(api.errors).toEqual([]);
});

test('island settles without animation mutations and uses supplied icon SVGs',async({page})=>{
    const api=await setup(page);await page.goto('/#/hud?static&preview');
    const island=page.locator('.island');await expect(island).toHaveAttribute('data-motion-active','false');
    await expect(island.locator('.opai-icon')).toHaveCount(4);
    const paths=await island.locator('.opai-icon').evaluateAll(elements=>elements.map(el=>(el as HTMLElement).style.maskImage));
    expect(paths.join(' ')).toContain('server.svg');expect(paths.join(' ')).toContain('frame.svg');
    api.emit('moduleToggle',{moduleName:'Flight',enabled:true});await expect(island).toContainText('Module Toggled');
    await expect(island.locator('.notice-row')).toHaveCount(0,{timeout:4000});await expect(island).toHaveAttribute('data-motion-active','false',{timeout:4000});
    const changes=await island.evaluate(async el=>{let n=0;const observer=new MutationObserver(()=>n++);observer.observe(el,{attributes:true});await new Promise(resolve=>setTimeout(resolve,250));observer.disconnect();return n;});
    expect(changes).toBe(0);expect(api.errors).toEqual([]);
});

test('folded categories have no added indicator and survive malformed saved positions',async({page})=>{
    const api=await setup(page);await page.addInitScript(()=>localStorage.setItem('opai.panel.Combat','{broken'));
    await page.goto('/#/clickgui?static&preview');const panel=page.locator('.panel').first();await expect(panel).toBeVisible();
    await panel.locator('.title').click({button:'right'});await expect(panel.locator('.modules')).not.toHaveClass(/expanded/);
    await panel.locator('.title').hover();await expect(panel.locator('.title button,.expand-toggle,.expand')).toHaveCount(0);
    await expect(panel.locator('.title')).toHaveText('Combat');await page.screenshot({path:'reports/clickgui-folded.png'});
    await page.reload();await expect(page.locator('.panel')).toHaveCount(5);expect(api.errors).toEqual([]);
});

test('startup failures do not block native routing or a subsequent reload',async({page})=>{
    const api=await setup(page);
    await page.route('**/api/v1/client/theme/opai',route=>route.fulfill({status:503,json:{error:'not ready'}}));
    await page.route('**/api/v1/client/localStorage/all',route=>route.fulfill({status:503,json:{error:'not ready'}}));
    await page.goto('/#/none');await expect(page.locator('.title-screen')).toBeVisible();
    api.emit('virtualScreen',{action:'open',screenName:'clickgui'});await expect(page.locator('.panel')).toHaveCount(5);
    await page.reload();await expect(page.locator('.title-screen')).toBeVisible();
    api.emit('virtualScreen',{action:'open',screenName:'clickgui'});await expect(page.locator('.panel')).toHaveCount(5);
    expect(api.errors).toEqual([]);
});

test('menu flip carries through page change and reverses back to title',async({page})=>{
    const api=await setup(page);await page.goto('/#/title?static&preview');
    await page.getByRole('button',{name:'Multi player',exact:true}).click();
    const rows=page.locator('.opai-list .rows');await expect(rows).toBeVisible();
    await expect.poll(()=>rows.evaluate(el=>el.getAttribute('style'))).toContain('rotateY(0deg) scale(1)');
    await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.locator('.title-screen')).toBeVisible();
    await expect.poll(()=>page.locator('.menu-buttons').getAttribute('style')).toContain('rotateY(0deg) scale(1, 1)');
    await page.getByRole('button',{name:'Multi player',exact:true}).click();await expect(page.locator('.opai-list')).toBeVisible();
    expect(api.errors).toEqual([]);
});


test('mascot keeps native physics but interpolates frames and skips hidden backlogs',()=>{
    const body=new MascotPhysics(100,100,0);
    body.sample(50,1000,550);
    const a=body.sample(60,1000,550),b=body.sample(75,1000,550),c=body.sample(90,1000,550);
    expect(a.x).toBeCloseTo(110);expect(b.x).toBeCloseTo(125);expect(c.x).toBeCloseTo(140);
    body.resume(100000);const resumed=body.sample(100001,1000,550);expect(resumed.x).toBe(150);
    body.sample(100050,1000,550);expect(body.x).toBeCloseTo(199.5);
});

test('collision rendering changes on consecutive frames and reuses preloaded audio',async({page})=>{
    const api=await setup(page);let audio=0;
    page.on('request',request=>{if(request.url().includes('snd_badexplosion.wav'))audio++;});
    await page.addInitScript(()=>Math.random=()=>1);
    await page.goto('/#/title?static&preview');await expect(page.locator('.logo-static')).toHaveAttribute('data-collided','true');
    const samples=await page.locator('.flying').evaluate(async el=>{
        const values:string[]=[];
        for(let i=0;i<15;i++){await new Promise(requestAnimationFrame);values.push((el as HTMLElement).style.transform);}
        return values;
    });
    expect(new Set(samples).size).toBeGreaterThan(10);expect(audio).toBe(1);expect(api.errors).toEqual([]);
});

test('protocol cards map version families to matching original or added artwork',()=>{
    expect(protocolArt('1.20.5-1.20.6')).toBe('opai/version/1.20.png');
    expect(protocolArt('1.21.2-1.21.3')).toBe('opai/version-extra/1.21.2.png');
    expect(protocolArt('1.21.7-1.21.8')).toBe('opai/version-extra/1.21.6.png');
    expect(protocolArt('1.21.11')).toBe('opai/version-extra/1.21.11.png');
    expect(protocolArt('26.1-26.1.2')).toBe('opai/version-extra/26.1.png');
    expect(protocolArt('26.3')).toBe('opai/version/26.3.png');
});

test('Via uses original four-column image cards, pagination animation and confirmed protocol PUT',async({page})=>{
    const api=await setup(page);
    const versions=['26.3','26.2','26.1-26.1.2','1.21.11','1.21.9-1.21.10','1.21.7-1.21.8','1.21.6','1.21.5','1.21.4','1.21.2-1.21.3','1.21-1.21.1','1.20.5-1.20.6','1.20.3-1.20.4','1.20.2','1.20-1.20.1','1.19.4','1.19.3','1.19.1-1.19.2','1.19','1.18.2','1.18-1.18.1','1.17.1','1.17','1.16.4-1.16.5','1.16.3','1.16.2','1.16.1','1.16','1.15.2','1.15.1','1.15','1.14.4','1.14.3','1.14.2','1.14.1','1.14','1.13.2','1.13.1','1.13','1.12.2','1.12.1','1.12','1.11.1-1.11.2','1.11','1.10','1.9.3-1.9.4','1.9.2','1.9.1','1.9','1.8','1.7.6-1.7.10','1.7.2-1.7.5'];
    let chosen={name:versions[0],version:1000};
    await page.route('**/api/v1/client/protocols',r=>r.fulfill({json:versions.map((name,i)=>({name,version:1000-i}))}));
    await page.route('**/api/v1/client/protocols/protocol',async r=>{if(r.request().method()==='PUT')chosen={name:'1.7.2-1.7.5',...r.request().postDataJSON()};await r.fulfill({json:chosen});});
    await page.goto('/#/multiplayer?static&preview');await page.getByRole('button',{name:'Via Version',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Protocol Selector'});await expect(dialog).toHaveAttribute('data-motion-active','false');
    expect(await dialog.locator('.confirm').evaluate(el=>{const probe=document.createElement('span');probe.style.color='var(--accent-color)';el.append(probe);const expected=getComputedStyle(probe).color;probe.remove();return getComputedStyle(el).color===expected;})).toBe(true);
    await expect(dialog.locator('.version-card')).toHaveCount(16);await expect(dialog.getByRole('button',{name:'Previous page'})).toBeDisabled();
    expect(await dialog.locator('.version-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns)).toBe('88px 88px 88px 88px');
    await expect(dialog.locator('.version-card img')).toHaveCount(16);
    await expect.poll(()=>dialog.locator('.version-card img').evaluateAll(images=>images.every(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth>0))).toBe(true);
    await dialog.evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished));});
    await page.screenshot({path:'reports/via-page1.png'});
    expect(await dialog.getByRole('button',{name:'Previous page'}).innerText()).toBe('<');expect(await dialog.getByRole('button',{name:'Next page'}).innerText()).toBe('>');
    for(let i=0;i<3;i++)await dialog.getByRole('button',{name:'Next page'}).click();
    await expect(dialog.locator('.page-count')).toHaveText('4 / 4');await expect(dialog.getByRole('button',{name:'Next page'})).toBeDisabled();await expect(dialog.locator('.version-card')).toHaveCount(4);
    await dialog.getByRole('button',{name:'1.7.2-1.7.5',exact:true}).click();
    await expect(dialog.getByRole('button',{name:'1.7.2-1.7.5',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.screenshot({path:'reports/via-page4.png'});await dialog.getByRole('button',{name:'Confirm',exact:true}).click();
    await expect(dialog).toHaveCount(0);expect(chosen.version).toBe(949);
    await page.getByRole('button',{name:'Via Version',exact:true}).click();await expect(page.locator('.page-count')).toHaveText('4 / 4');
    await page.keyboard.press('Escape');await expect(page.locator('.via-selector')).toHaveCount(0);expect(api.errors).toEqual([]);
});

test('server, account and proxy dialogs use Opai fields without shrinking icons',async({page})=>{
    const api=await setup(page);await page.setViewportSize({width:1000,height:700});
    await page.goto('/#/multiplayer?static&preview');await page.getByRole('button',{name:'Add Server',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Add New Server'});await expect(dialog).toBeVisible();await expect(dialog).toHaveAttribute('data-motion-active','false');
    expect((await dialog.boundingBox())!.width).toBeCloseTo(500,0);
    await expect(dialog.getByRole('textbox',{name:'Server Name',exact:true})).toHaveValue('Minecraft Server');await expect(dialog.locator('.icon-text-input.floating').first()).toBeVisible();await expect(dialog.getByRole('button',{name:'Cancel',exact:true})).toBeVisible();
    await dialog.locator('summary').click();
    await dialog.getByRole('button',{name:'Server Resource Packs',exact:true}).click();await dialog.getByRole('button',{name:'Disabled',exact:true}).click();
    await dialog.locator('summary').click();await page.screenshot({path:'reports/add-server-opai.png'});await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect(dialog).toHaveCount(0);await page.getByRole('button',{name:'Direct Connect',exact:true}).click();const direct=page.getByRole('dialog',{name:'Direct Connect Server'});await expect(direct).toHaveAttribute('data-motion-active','false');await direct.getByRole('textbox',{name:'Server Address'}).fill('localhost');await page.screenshot({path:'reports/direct-connect-opai.png'});await direct.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.goto('/#/altmanager?static&preview');await page.getByRole('button',{name:'Add Account',exact:true}).click();
    const account=page.getByRole('dialog',{name:'Add Account'});await expect(account).toHaveAttribute('data-motion-active','false');await account.evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished));});await page.screenshot({path:'reports/add-account-opai.png'});
    await account.getByRole('button',{name:'Cracked',exact:true}).click();await account.getByRole('textbox',{name:'Username',exact:true}).fill('Test');
    await expect(account.getByRole('checkbox',{name:'Use online UUID'})).toBeVisible();await expect(account.getByRole('button',{name:'Random',exact:true})).toBeVisible();await page.keyboard.press('Escape');
    await page.goto('/#/proxymanager?static&preview');await page.getByRole('button',{name:'Add',exact:true}).click();
    const proxy=page.getByRole('dialog',{name:'Add Proxy'});await expect(proxy).toHaveAttribute('data-motion-active','false');await proxy.getByRole('checkbox',{name:'Requires Authentication',exact:true}).check();
    await expect(proxy.getByRole('textbox',{name:'Username',exact:true})).toBeVisible();await expect(proxy.getByRole('heading',{name:'Add Proxy'})).toBeInViewport();await page.screenshot({path:'reports/add-proxy-opai.png'});expect(api.errors).toEqual([]);
});

test('long setting names keep slider labels and values on one row',async({page})=>{
    const api=await setup(page);
    await page.route('**/api/v1/client/modules/settings?name=AimAssist',r=>r.fulfill({json:{name:'AimAssist',valueType:'CONFIGURABLE',value:[{name:'ObfuscatedMaxLength',valueType:'INT',value:173,range:{from:0,to:512},suffix:'chars'},{name:'VFPScoreboardFix',valueType:'BOOLEAN',value:false},{name:'CustomRange',valueType:'TOGGLEABLE',value:[{name:'Enabled',valueType:'BOOLEAN',value:false},{name:'Range',valueType:'FLOAT',value:3,range:{from:1,to:6},suffix:''}]}]}}));
    await page.goto('/#/clickgui?static&preview');const module=page.locator('.panel').first().locator('.module').first();await module.locator('.name').first().click({button:'right'});
    const setting=module.locator('[data-setting=ObfuscatedMaxLength]');await expect(setting).toBeVisible();
    expect(await setting.locator('.setting-label').evaluate(el=>getComputedStyle(el).whiteSpace)).toBe('nowrap');
    const label=(await setting.locator('.setting-label').boundingBox())!,slider=(await setting.locator('.slider').boundingBox())!;expect(label.y+label.height).toBeLessThanOrEqual(slider.y+4);
    await module.getByRole('button',{name:'Expand Custom Range',exact:true}).click();await expect(module.locator('[data-setting=Range]')).toBeVisible();
    const arrow=module.locator('.group-expand .vector-icon');expect((await arrow.boundingBox())!.width).toBe(16);await expect(module.locator('.reveal.visible').first()).toHaveAttribute('data-motion-active','false');await page.mouse.move(1900,900);await page.screenshot({path:'reports/clickgui-long-label.png'});expect(api.errors).toEqual([]);
});

test('native rapid menu switching and remounts always restore a readable title',async({page})=>{
    const api=await setup(page);await page.goto('/#/none');await expect(page.locator('.title-screen')).toBeVisible();
    for(let i=0;i<3;i++){
        await page.getByRole('button',{name:'Multi player',exact:true}).click();await expect(page.locator('.opai-list')).toBeVisible();
        api.emit('virtualScreen',{action:'close'});await expect(page.locator('.opai-list')).toHaveCount(0);
        api.emit('virtualScreen',{action:'open',screenName:'title'});await expect(page.locator('.title-screen')).toBeVisible();
        await expect.poll(()=>page.locator('.menu-buttons').getAttribute('style')).toContain('rotateY(0deg) scale(1, 1)');
    }
    expect(api.errors).toEqual([]);
});


test('ClickGUI columns and configurations drag outside headers and persist at GUI scales 2 and 3',async({page})=>{
    const api=await setup(page);
    let scale=2;
    await page.route('**/api/v1/client/modules/settings?name=ClickGUI',r=>r.fulfill({json:{name:'ClickGUI',valueType:'CONFIGURABLE',value:[{name:'Scale',valueType:'FLOAT',value:1},{name:'Snapping',valueType:'TOGGLEABLE',value:[{name:'Enabled',valueType:'BOOLEAN',value:false}]}]}}));
    await page.route('**/api/v1/client/window',r=>r.fulfill({json:{width:2000,height:1100,scaledWidth:2000/scale,scaledHeight:1100/scale,scaleFactor:scale,guiScale:scale}}));
    for(scale of [2,3]){
        await page.goto(`/?gui-scale=${scale}#/clickgui?static&preview`);const panel=page.locator('.panel').first();await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');
        const before=(await panel.boundingBox())!,header=(await panel.locator('.title').boundingBox())!;
        await page.mouse.move(header.x+50,header.y+20);await page.mouse.down();await page.mouse.move(header.x+170,header.y+200,{steps:10});await page.mouse.up();
        const after=(await panel.boundingBox())!;expect(after.x-before.x).toBeCloseTo(120,0);expect(after.y-before.y).toBeCloseTo(180,0);
        await page.getByRole('button',{name:'Configurations',exact:true}).click();const config=page.getByRole('region',{name:'Configurations panel'});
        await expect(config).toBeVisible();await expect(config).toHaveAttribute('data-motion-active','false');await config.evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished));});
        const c=(await config.boundingBox())!;
        await page.mouse.move(c.x+50,c.y+15);await page.mouse.down();await page.mouse.move(c.x-190,c.y+175,{steps:10});await page.mouse.up();
        const moved=(await config.boundingBox())!;expect(moved.x-c.x).toBeCloseTo(-240,0);expect(moved.y-c.y).toBeCloseTo(160,0);
        await expect.poll(()=>api.requests.filter(r=>r.path==='/client/localStorage'&&r.method==='PUT'&&r.body.key==='opai.config.position').at(-1)?.body.value).toBe(await page.evaluate(()=>localStorage.getItem('opai.config.position')));
        await page.reload();await page.getByRole('button',{name:'Configurations',exact:true}).click();await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');
        await expect(page.locator('.config-popup')).toHaveAttribute('data-motion-active','false');
        const restored=(await page.locator('.config-popup').boundingBox())!;expect(restored.x).toBeCloseTo(moved.x,0);expect(restored.y).toBeCloseTo(moved.y,0);
        await page.locator('.config-popup').evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished));});
        await page.screenshot({path:`reports/drag-scale-${scale}.png`});
    }
    expect(api.errors).toEqual([]);
});

test('ClickGUI opening waits for module data, replays on cached reopen, and sections animate without overlap',async({page})=>{
    const api=await setup(page);
    await page.route('**/api/v1/client/modules',async route=>{await new Promise(resolve=>setTimeout(resolve,450));await route.fallback();});
    await page.goto('/#/clickgui?static&preview');await expect(page.locator('.panel')).toHaveCount(5);
    const gui=page.locator('.clickgui');await expect(gui).toHaveAttribute('data-motion-active','false');
    api.emit('virtualScreen',{action:'open',screenName:'clickgui'});
    await expect(gui).toHaveAttribute('data-motion-active','true');expect(await gui.evaluate(el=>el.getAnimations().length)).toBeGreaterThan(0);await expect(gui).toHaveAttribute('data-motion-active','false');
    const module=page.locator('.panel').first().locator('.module').first();await module.locator('.name').first().click({button:'right'});
    const reveal=module.locator('.reveal.visible').first();await expect(reveal).toHaveAttribute('data-motion-active','true');await expect(reveal).toHaveAttribute('data-motion-active','false');
    const name=(await module.locator('.name').first().boundingBox())!,label=(await module.locator('.number-label').first().boundingBox())!;expect(label.y).toBeGreaterThanOrEqual(name.y+name.height-.5);
    await module.locator('.name').first().click({button:'right'});await expect(module.locator('.reveal').first()).toHaveAttribute('data-motion-active','true');await expect(module.locator('.reveal').first()).toHaveCSS('height','0px');
    expect(api.errors).toEqual([]);
});

test('island uses original toggle geometry, reverses its animation, and draws typed notification icons',async({page})=>{
    const api=await setup(page);await page.goto('/#/hud?static&preview');await expect(page.locator('.island')).toBeVisible();
    api.emit('moduleToggle',{moduleName:'Flight',enabled:true});const toggle=page.locator('.notice-icon[data-kind=toggle]');await expect(toggle).toBeVisible();
    await expect.poll(()=>toggle.getAttribute('data-toggle')).toBe('1');
    await expect(toggle.locator('rect').first()).toHaveAttribute('width','26');await expect(toggle.locator('rect').first()).toHaveAttribute('height','16');
    api.emit('moduleToggle',{moduleName:'Flight',enabled:false});await expect.poll(async()=>Number(await toggle.getAttribute('data-toggle'))).toBeLessThan(1);await expect(toggle).toHaveAttribute('data-toggle','0');
    await expect(page.locator('.notice-row')).toHaveCount(1);
    api.emit('notification',{title:'Error',message:'Test failure',severity:'ERROR'});await expect(page.locator('.notice-icon[data-kind=warning]')).toBeVisible();
    api.emit('notification',{title:'Saved',message:'Test saved',severity:'SUCCESS'});await expect(page.locator('.notice-icon[data-kind=success]')).toBeVisible();
    await expect.poll(async()=>(await page.locator('.island').boundingBox())!.height).toBeGreaterThan(210);
    await page.screenshot({path:'reports/island-icons.png'});
    await expect(page.locator('.notice-row')).toHaveCount(0,{timeout:5000});await expect(page.locator('.island')).toHaveAttribute('data-motion-active','false',{timeout:4000});
    api.emit('session',{session:{username:'A'.repeat(150)}});await expect(page.locator('.idle-content .opai-icon')).toHaveCount(4);
    await expect.poll(async()=>{const fps=(await page.locator('.island .fps').boundingBox())!,shell=(await page.locator('.island').boundingBox())!;return fps.x+fps.width<=shell.x+shell.width+1;}).toBe(true);expect(api.errors).toEqual([]);
});

test('animation timing produces intermediate samples at 120 Hz without changing duration',()=>{
    const samples=Array.from({length:39},(_,i)=>openingScale(i*1000/120));
    expect(new Set(samples).size).toBe(39);expect(openingScale(320)).toBe(1);
    const fast=new Approach(0),slow=new Approach(0);fast.value(1,0);slow.value(1,0);
    const fastSamples=Array.from({length:12},(_,i)=>fast.value(1,(i+1)*1000/120));
    for(let i=1;i<=3;i++)slow.value(1,i*1000/30);
    expect(new Set(fastSamples).size).toBe(12);expect(fast.current).toBeCloseTo(slow.current,10);
});

test('native renderer migration caps only the webpage, disables game sync once and keeps later manual choices',async({page})=>{
    const api=await setup(page);const updates:any[]=[];const caps:Record<string,number>={HUD:0,ClickGUI:30};const sync:Record<string,boolean>={HUD:true,ClickGUI:true};
    await page.route('**/api/v1/client/modules/settings?name=*',async route=>{
        const name=new URL(route.request().url()).searchParams.get('name')!;if(!(name in caps)){await route.fallback();return;}
        if(route.request().method()==='PUT'){const body=route.request().postDataJSON();const r=body.value.find((v:any)=>v.name==='Renderer').value;caps[name]=r.find((v:any)=>v.name==='Fps').value;sync[name]=r.find((v:any)=>v.name==='SyncGameFps').value;expect(body.value.find((v:any)=>v.name==='Scale').value).toBe(1);updates.push({name,fps:caps[name],sync:sync[name]});}
        await route.fulfill({json:{name,valueType:'CONFIGURABLE',value:[{name:'Scale',valueType:'FLOAT',value:1},{name:'Renderer',valueType:'CONFIGURABLE',value:[{name:'Fps',valueType:'INT',value:caps[name],range:{from:0,to:name==='HUD'?165:90}},{name:'SyncGameFps',valueType:'BOOLEAN',value:sync[name]}]}]}});
    });
    await page.goto('/#/none');await expect.poll(()=>caps.HUD).toBe(60);expect(sync.HUD).toBe(false);api.emit('virtualScreen',{action:'open',screenName:'clickgui'});await expect(page.locator('.panel')).toHaveCount(5);await expect.poll(()=>sync.ClickGUI).toBe(false);expect(caps.ClickGUI).toBe(30);
    expect(updates).toEqual([{name:'HUD',fps:60,sync:false},{name:'ClickGUI',fps:30,sync:false}]);const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('opai.renderer.balanced60.v1.HUD')!));expect(saved.original).toEqual({fps:0,sync:true});
    caps.HUD=144;caps.ClickGUI=75;sync.HUD=true;await page.reload();await expect(page.locator('.title-screen')).toBeVisible();api.emit('virtualScreen',{action:'open',screenName:'clickgui'});await expect(page.locator('.panel')).toHaveCount(5);await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');expect(caps).toEqual({HUD:144,ClickGUI:75});expect(sync.HUD).toBe(true);expect(updates).toHaveLength(2);expect(api.errors).toEqual([]);
});

test('cached native HUD applies the balanced UI cap after the old 120 marker and respects the display range',async({page})=>{
 const shared={'opai.renderer.120.v1.HUD':'1'};const api=await setup(page,false,shared);let cap=120;
 await page.route('**/api/v1/client/modules/settings?name=HUD',async r=>{if(r.request().method()==='PUT')cap=r.request().postDataJSON().value[0].value[0].value;await r.fulfill({json:{name:'HUD',valueType:'CONFIGURABLE',value:[{name:'Renderer',valueType:'CONFIGURABLE',value:[{name:'Fps',valueType:'INT',value:cap,range:{from:0,to:45}}]}]}});});
 await page.goto('/#/hud?static');await expect.poll(()=>cap).toBe(45);expect(api.errors).toEqual([]);
});

test('CEF right button down works without contextmenu and duplicate contextmenu does not close it',async({page})=>{
    const api=await setup(page);await page.goto('/#/clickgui?static&preview');await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');
    const panel=page.locator('.panel').first(),name=panel.locator('.module .name').first();
    await name.dispatchEvent('mousedown',{button:2,bubbles:true});
    await expect(panel.locator('[data-setting=Range]')).toBeVisible();
    await name.dispatchEvent('contextmenu',{button:2,bubbles:true});await name.dispatchEvent('mouseup',{button:2,bubbles:true});
    await expect(panel.locator('.module').first().locator('.reveal.visible').first()).toHaveAttribute('data-motion-active','false');await expect(panel.locator('[data-setting=Range]')).toBeVisible();
    expect(api.requests.filter(r=>r.path==='/client/modules/settings'&&r.name==='AimAssist')).toHaveLength(1);
    await name.dispatchEvent('mousedown',{button:2,bubbles:true});await name.dispatchEvent('mouseup',{button:2,bubbles:true});await expect(panel.locator('.module').first().locator('.reveal').first()).toHaveCSS('height','0px');
    await panel.locator('.title').dispatchEvent('mousedown',{button:2,bubbles:true});await panel.locator('.title').dispatchEvent('mouseup',{button:2,bubbles:true});await expect(panel.locator('>.reveal')).toHaveCSS('height','0px');
    await panel.locator('.title').dispatchEvent('mousedown',{button:2,bubbles:true});await panel.locator('.title').dispatchEvent('mouseup',{button:2,bubbles:true});await expect(panel.locator('.module').first()).toBeVisible();expect(api.errors).toEqual([]);
});

test('island retains Opai bold fonts, enlarged glyph and notice word order while the list uses regular fonts',async({page})=>{
    const api=await setup(page);const fonts:string[]=[];page.on('request',r=>{if(r.url().includes('/fonts/'))fonts.push(r.url());});
    await page.goto('/#/hud?static&preview');await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('.island .opai-icon').first()).toHaveCSS('width','12px');
    api.emit('moduleToggle',{moduleName:'KillAura',enabled:false});
    const row=page.locator('.notice-row');await expect(row.locator('.title')).toHaveText('Module Toggled');await expect(row.locator('.detail')).toHaveText('Kill Aura has been Disabled!');
    await expect(row.locator('.status')).toHaveText('Disabled');await expect(row.locator('.punctuation')).toHaveText('!');await expect(row.locator('.notice-glyph')).toHaveAttribute('transform',/scale\(1.12\)/);
    await expect.poll(async()=>(await page.locator('.island').boundingBox())!.height).toBeGreaterThan(70);
    const glyph=(await row.locator('.notice-glyph').boundingBox())!;expect(glyph.width).toBeCloseTo(26*1.12*2,0);
    expect(fonts.some(f=>f.endsWith('GoogleSans-Bold.ttf'))).toBe(true);expect(fonts.some(f=>f.endsWith('GoogleSans-Regular.ttf'))).toBe(true);
    await expect(page.locator('.island')).toHaveCSS('font-family','"Google Sans", "Opai CJK", sans-serif');
    await page.screenshot({path:'reports/island-opai-reference.png'});expect(api.errors).toEqual([]);
});

test('animation diagnostics is opt-in, measures RAF and survives native route changes',async({page})=>{
    const api=await setup(page);await page.goto('/#/title?static&preview');const diagnostics=page.getByRole('complementary',{name:'Animation diagnostics'});await expect(diagnostics).toHaveCount(0);
    await page.keyboard.press('Control+Shift+F8');await expect(diagnostics).toBeVisible();api.emit('fps',{fps:114});await expect(diagnostics).toContainText('114');
    await expect.poll(()=>diagnostics.locator('dd').nth(1).innerText()).not.toBe('0.0 Hz');
    await page.getByRole('button',{name:'Multi player',exact:true}).click();await expect(page.locator('.opai-list')).toBeVisible();await expect(diagnostics).toBeVisible();
    api.emit('keyboardKey',{key:'key.keyboard.f8',keyCode:297,action:1,scanCode:0,mods:3});await expect(diagnostics).toHaveCount(0);expect(api.errors).toEqual([]);
});

test('settings remain usable when a CEF host pauses animation frames',async({page})=>{
    const api=await setup(page);await page.goto('/#/clickgui?static&preview');await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');
    await page.evaluate(()=>{window.requestAnimationFrame=()=>1;});
    const module=page.locator('.panel').first().locator('.module').first(),name=module.locator('.name').first();
    await name.dispatchEvent('mousedown',{button:2,bubbles:true});await name.dispatchEvent('mouseup',{button:2,bubbles:true});
    await expect(module.locator('[data-setting=Range]')).toBeVisible();await expect(module.locator('.reveal.visible').first()).toHaveAttribute('data-motion-active','false');
    await name.dispatchEvent('mousedown',{button:2,bubbles:true});await name.dispatchEvent('mouseup',{button:2,bubbles:true});await expect(module.locator('.reveal').first()).toHaveCSS('height','0px');expect(api.errors).toEqual([]);
});

test('Scaffold island uses live counts, an observed maximum and clears on disable',async({page})=>{
    const api=await setup(page);await page.goto('/#/hud?static&preview');await expect(page.locator('.island')).toBeVisible();
    api.emit('moduleToggle',{moduleName:'Scaffold',enabled:true});api.emit('blockCountChange',{count:128,nextBlock:'minecraft:stone'});
    const scaffold=page.locator('.scaffold-content');await expect(scaffold).not.toHaveClass(/content-hidden/);
    await expect(scaffold).toContainText('128 blocks left - 0.0 block/s');expect((await scaffold.boundingBox())!.width).toBeLessThan(400);
    const bar=page.getByRole('progressbar',{name:'Remaining blocks'});await expect(bar).toHaveAttribute('aria-valuemax','128');
    api.emit('blockCountChange',{count:64});await expect(bar).toHaveAttribute('aria-valuenow','64');
    await expect.poll(()=>bar.locator('span').evaluate(el=>getComputedStyle(el).transform)).toBe('matrix(0.5, 0, 0, 1, 0, 0)');
    await expect(scaffold).not.toContainText('0.0 block/s');await page.waitForTimeout(2200);await expect(scaffold).toContainText('0.0 block/s');
    api.emit('blockCountChange',{count:192});await expect(bar).toHaveAttribute('aria-valuemax','192');
    await expect(bar.locator('span')).toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 0)');await page.screenshot({path:'reports/scaffold-island.png'});
    api.emit('moduleToggle',{moduleName:'Scaffold',enabled:false});await expect(scaffold).toHaveClass(/content-hidden/);
    api.emit('moduleToggle',{moduleName:'Scaffold',enabled:true});api.emit('blockCountChange',{count:32});await expect(bar).toHaveAttribute('aria-valuemax','32');
    api.emit('blockCountChange',{});await expect(scaffold).toHaveClass(/content-hidden/);expect(api.errors).toEqual([]);
});

test('player list hides and restores island using the actual rebound key',async({page})=>{
    const api=await setup(page);let key='tab',keyRequests=0;
    await page.route('**/api/v1/client/keybinds',r=>{keyRequests++;return r.fulfill({json:[{bindName:'key.playerlist',key:{translationKey:`key.keyboard.${key}`,localized:key}}]});});
    await page.goto('/#/hud?static&preview');const visibility=page.locator('.island-visibility');await expect(visibility).toHaveAttribute('aria-hidden','false');
    api.emit('keyboardKey',{key:'key.keyboard.tab',keyCode:258,action:1});await expect(visibility).toHaveAttribute('aria-hidden','true');await expect(visibility).toHaveCSS('opacity','0');
    api.emit('moduleToggle',{moduleName:'Flight',enabled:true});api.emit('keyboardKey',{key:'key.keyboard.tab',keyCode:258,action:0});await expect(visibility).toHaveAttribute('aria-hidden','false');await expect(visibility).toContainText('Flight has been');
    key='g';const count=keyRequests;api.emit('keybindChange',{});await expect.poll(()=>keyRequests).toBe(count+1);
    api.emit('key',{key:'key.keyboard.tab',action:1});await expect(visibility).toHaveAttribute('aria-hidden','false');
    api.emit('key',{key:'key.keyboard.g',action:1});await expect(visibility).toHaveAttribute('aria-hidden','true');
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect(visibility).toHaveAttribute('aria-hidden','false');expect(api.errors).toEqual([]);
});

test('period command palette binds from clickable and physical keys without enabling modules',async({page})=>{
    const api=await setup(page);await page.goto('/#/hud?static&preview');await expect(page.locator('.island')).toBeVisible();await page.keyboard.press('Period');
    const palette=page.getByRole('region',{name:'Command palette'});await expect(palette).toBeVisible();const search=page.getByRole('textbox',{name:'Search commands'});
    await search.fill('bind for aim assist');await page.getByRole('option',{name:'Bind for Aim Assist',exact:true}).click();
    await expect(page.getByRole('button',{name:'Bind W',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.command-palette')).toHaveCSS('width','930px');await expect(page.getByRole('button',{name:'Bind W',exact:true})).toHaveCSS('height','54px');await page.screenshot({path:'reports/binding-keyboard.png'});await page.getByRole('button',{name:'Bind K',exact:true}).click();
    await expect(palette).toContainText('Aim Assist bound to k');expect(api.modules.find(m=>m.name==='AimAssist')?.keyBind.boundKey).toBe('key.keyboard.k');
    await page.getByRole('option',{name:'Bind for Aim Assist',exact:true}).click();await expect(page.getByRole('button',{name:'Bind K',exact:true})).toHaveAttribute('aria-pressed','true');
    api.emit('keyboardKey',{key:'key.keyboard.f6',keyCode:295,action:1});await expect(palette).toContainText('Aim Assist bound to f6');
    await search.fill('bind for anti bot');await page.keyboard.press('Enter');await expect(page.getByLabel('Key binding keyboard')).toBeVisible();await page.keyboard.press('KeyH');
    await expect(palette).toContainText('Anti Bot bound to h');expect(api.modules.filter(m=>m.enabled).map(m=>m.name)).toEqual(['AimAssist']);
    await page.keyboard.press('Escape');await expect(page.locator('.island')).toBeVisible();await expect.poll(()=>api.requests.filter(r=>r.path==='/client/typing').at(-1)?.body).toEqual({typing:false});expect(api.errors).toEqual([]);
});

test('native period hands off to an input screen and cached reopen retains event listeners',async({page})=>{
    const api=await setup(page);let screen='hud';
    await page.route('**/api/v1/client/virtualScreen',r=>r.fulfill({json:{name:screen}}));
    await page.goto('/');await expect(page.locator('.island')).toBeVisible();
    screen='clickgui';api.emit('keyboardKey',{key:'key.keyboard.period',keyCode:46,action:1,screen:null});
    await expect(page.getByLabel('Search commands')).toBeVisible();expect(api.requests.some(r=>r.path==='/client/screen'&&r.method==='PUT'&&r.body.name==='clickgui')).toBe(true);
    await page.getByLabel('Search commands').fill('bind for aim');await page.getByRole('option',{name:'Bind for Aim Assist',exact:true}).click();
    await page.getByRole('button',{name:'Back to commands',exact:true}).click();await page.getByLabel('Search commands').fill('show aim');await page.getByRole('option',{name:'Show Aim Assist',exact:true}).click();
    await expect(page.locator('.panel')).toHaveCount(5);
    api.emit('virtualScreen',{action:'open',screenName:'clickgui'});api.emit('moduleToggle',{moduleName:'AimAssist',enabled:false});
    await expect(page.locator('.panel').first().locator('.module .name').first()).not.toHaveClass(/enabled/);expect(api.errors).toEqual([]);
});

test('palette commands use real module state, visibility, profiles and config folder',async({page})=>{
    const api=await setup(page);await page.addInitScript(()=>localStorage.setItem('opai.profiles',JSON.stringify([{name:'Only Aim',created:'now',modules:[{name:'AimAssist',enabled:false,settings:{name:'AimAssist',valueType:'CONFIGURABLE',value:[]}}]}])));
    await page.goto('/#/hud?static&preview');await expect(page.locator('.island')).toBeVisible();await page.keyboard.press('Period');const search=page.getByLabel('Search commands');
    await search.fill('disable aim');await page.getByRole('option',{name:'Disable Aim Assist',exact:true}).click();await expect.poll(()=>api.modules.find(m=>m.name==='AimAssist')?.enabled).toBe(false);
    await page.getByRole('option',{name:'Disable Aim Assist',exact:true}).click();expect(api.requests.filter(r=>r.path==='/client/modules/toggle')).toHaveLength(1);
    await search.fill('enable aim');await page.getByRole('option',{name:'Enable Aim Assist',exact:true}).click();await expect.poll(()=>api.modules.find(m=>m.name==='AimAssist')?.enabled).toBe(true);
    await search.fill('hide aim');await page.getByRole('option',{name:'Hide Aim Assist',exact:true}).click();await expect.poll(()=>api.modules.find(m=>m.name==='AimAssist')?.hidden).toBe(true);
    await search.fill('load only');await page.getByRole('option',{name:'Load Only Aim.json',exact:true}).click();await expect.poll(()=>api.modules.find(m=>m.name==='AimAssist')?.enabled).toBe(false);
    await search.fill('directory');await page.getByRole('option',{name:'Open Config Directory',exact:true}).click();await expect.poll(()=>api.requests.find(r=>r.path==='/client/browsePath')?.body).toEqual({path:'/fixture/LiquidBounce/configs'});
    await search.fill('not-a-real-module');await expect(page.locator('.no-results')).toContainText('No matching commands');expect(api.errors).toEqual([]);
});

test('settings expose language and translation from global backend without dropping other groups',async({page})=>{
    const api=await setup(page);await page.goto('/#/clickgui?static&preview');await page.getByRole('button',{name:'Configurations',exact:true}).click();await page.getByRole('button',{name:'Configuration settings',exact:true}).click();
    const popup=page.locator('.config-popup');await expect(popup.getByRole('button',{name:'Language',exact:true})).toBeVisible();await expect(popup.getByRole('button',{name:'Auto Translate',exact:true})).toBeVisible();
    await page.screenshot({path:'reports/global-settings.png'});
    await popup.getByRole('button',{name:'Language',exact:true}).click();await popup.locator('.choice-field').click();await popup.getByRole('button',{name:'zh_cn',exact:true}).click();
    await expect.poll(()=>api.requests.filter(r=>r.path==='/client/global'&&r.method==='PUT').length).toBe(1);
    const saved=api.requests.find(r=>r.path==='/client/global'&&r.method==='PUT')!.body;expect(saved.value.map((v:any)=>v.name)).toEqual(['Language','Targets','AutoTranslate']);expect(saved.value[0].value[0].value).toBe('zh_cn');
    await popup.getByRole('button',{name:'Back to configurations',exact:true}).click();await popup.getByRole('button',{name:'Auto Translate',exact:true}).click();await popup.getByRole('checkbox',{name:'Enabled',exact:true}).check();
    await expect.poll(()=>api.requests.filter(r=>r.path==='/client/global'&&r.method==='PUT').length).toBe(2);expect(api.errors).toEqual([]);
});

test('keystrokes count one-second native mouse CPS and animate labels back to LMB/RMB',async({page})=>{
    const api=await setup(page);await page.route('**/api/v1/client/components/opai',r=>r.fulfill({json:[{id:'keystrokes',name:'Keystrokes',settings:{enabled:true,zIndex:0,alignment:{horizontalAlignment:'Left',horizontalOffset:15,verticalAlignment:'Bottom',verticalOffset:15}}}]}));
    await page.goto('/#/hud?static&preview');await page.evaluate(()=>document.fonts.ready);const left=page.locator('.mouse-key[data-button=LMB]'),right=page.locator('.mouse-key[data-button=RMB]');await expect(left).toContainText('LMB');
    for(let i=0;i<3;i++){api.emit('mouseButton',{button:0,action:1,screen:null});api.emit('mouseButton',{button:0,action:0,screen:null});}
    await expect(left).toHaveText('3');await expect(left.locator('.key-wave')).toHaveCount(1);
    api.emit('mouseButton',{button:1,action:1,screen:null});await expect(right).toHaveText('1');await expect(right).toHaveClass(/active/);
    await page.screenshot({path:'reports/keystrokes-cps.png'});
    api.emit('mouseButton',{button:1,action:0,screen:'inventory'});await expect(right).not.toHaveClass(/active/);
    await expect(left).toContainText('LMB');await expect(right).toContainText('RMB');expect(await left.locator('.key-wave').evaluate(el=>el.getAnimations().length)).toBe(0);
    api.emit('mouseButton',{button:0,action:1,screen:'chat'});await expect(left).toContainText('LMB');expect(api.errors).toEqual([]);
});

test('module descriptions follow the right side of the mouse and clamp within the viewport',async({page})=>{
    const api=await setup(page);await page.goto('/#/clickgui?static&preview');await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');
    const name=page.locator('.panel').nth(2).locator('.module .name').first();await name.hover({position:{x:100,y:18}});const tip=page.getByRole('tooltip');await expect(tip).toContainText('AutoHead description');
    let mouse=(await name.boundingBox())!;let box=(await tip.boundingBox())!;expect(box.x).toBeGreaterThan(mouse.x+100);const old=box.x;
    await name.hover({position:{x:180,y:28}});await expect.poll(async()=>((await tip.boundingBox())!.x)).toBeGreaterThan(old+60);box=(await tip.boundingBox())!;expect(box.x).toBeGreaterThan(mouse.x+180);
    await page.locator('.panel').first().locator('.module .name').first().hover({position:{x:2,y:10}});await expect(tip).toContainText('AimAssist description');expect((await tip.boundingBox())!.x).toBeGreaterThanOrEqual(0);
    await page.screenshot({path:'reports/module-tooltip.png'});expect(api.errors).toEqual([]);
});

test('block consumption excludes pickups, expires after two seconds and resets its maximum',()=>{
    const blocks=new BlockStats();blocks.update(64,0);blocks.update(60,1000);expect(blocks.rate(1000)).toBe(4);expect(blocks.progress).toBe(.9375);
    blocks.update(128,1500);expect(blocks.maximum).toBe(128);expect(blocks.rate(1500)).toBeCloseTo(4/1.5);expect(blocks.rate(3100)).toBe(0);
    blocks.reset();blocks.update(0,4000);expect(blocks.progress).toBe(0);expect(blocks.maximum).toBe(0);blocks.update(32,4100);expect(blocks.maximum).toBe(32);
});

test('invalid profile enabled flags are rejected before any module write',async({page})=>{
    const api=await setup(page);await page.addInitScript(()=>localStorage.setItem('opai.profiles',JSON.stringify([{name:'Broken',created:'now',modules:[{name:'AimAssist',enabled:'false',settings:{name:'AimAssist',valueType:'CONFIGURABLE',value:[]}}]}])));
    await page.goto('/#/clickgui?static&preview');await page.getByRole('button',{name:'Configurations',exact:true}).click();await page.getByRole('button',{name:'Broken.json',exact:true}).click();await page.getByRole('button',{name:'Load',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Invalid configuration');expect(api.requests.filter(r=>r.path==='/client/modules/toggle'||r.path==='/client/modules/settings'&&r.method==='PUT')).toHaveLength(0);expect(api.modules.filter(m=>m.enabled).map(m=>m.name)).toEqual(['AimAssist']);expect(api.errors).toEqual([]);
});

test('native static HUD hands input to a separate main WebView through the host bridge',async({browser,page})=>{
    const shared:Record<string,string>={};const main=await setup(page,false,shared);
    const hudContext=await browser.newContext({viewport:{width:2000,height:1100}});const hud=await hudContext.newPage(),overlay=await setup(hud,false,shared);
    const cached=await page.context().newPage(),cache=await setup(cached,false,shared);await cached.goto('/#/clickgui?static');await expect(cached.locator('.panel')).toHaveCount(5);
    const acknowledgements:string[]=[];await page.route('**/api/v1/client/virtualScreen',r=>{if(r.request().method()==='POST')acknowledgements.push(r.request().postDataJSON().name);return r.fulfill({json:{name:'none'}});});await page.goto('/#/none');
    await hud.goto('/#/hud?static');await expect(hud.locator('.island')).toBeVisible();const anchor=(await hud.locator('.island-visibility').boundingBox())!;
    overlay.emit('keyboardKey',{key:'key.keyboard.period',keyCode:46,action:1,screen:null});
    await expect.poll(()=>overlay.requests.filter(r=>r.path==='/client/screen'&&r.method==='PUT').length).toBe(1);
    expect(overlay.requests.find(r=>r.path==='/client/screen')?.body).toEqual({name:'clickgui'});await expect(hud).toHaveURL(/#\/hud\?static$/);await expect(hud.locator('.command-palette')).toHaveCount(0);
    cache.emit('virtualScreen',{action:'open',screenName:'clickgui'});await expect(cached.locator('.command-palette')).toHaveCount(0);
    await page.evaluate(()=>{(window as any).__morph=[];function draw(){const el=document.querySelector('.palette-island');if(el){const b=el.getBoundingClientRect();(window as any).__morph.push({width:b.width,height:b.height,active:el.getAttribute('data-motion-active')});}if((window as any).__morph.length<130)requestAnimationFrame(draw);}requestAnimationFrame(draw);});
    main.emit('virtualScreen',{action:'open',screenName:'clickgui'});await page.bringToFront();const search=page.getByRole('textbox',{name:'Search commands'});await expect(search).toBeFocused();await page.keyboard.type('bind for flight');await expect(search).toHaveValue('bind for flight');
    await expect(hud.locator('.island-visibility')).toHaveClass(/palette-suspended/);await expect(page.locator('.palette-island')).toHaveAttribute('data-origin','dynamic-island');
    await expect.poll(()=>acknowledgements.includes('clickgui')).toBe(true);
    await expect(page.locator('.palette-island')).toHaveAttribute('data-motion-active','false');const box=(await page.locator('.palette-island').boundingBox())!;expect(box.y).toBeCloseTo(anchor.y,0);expect(box.x+box.width/2).toBeCloseTo(anchor.x+anchor.width/2,0);
    const frames=await page.evaluate(()=>(window as any).__morph as {width:number;height:number}[]);expect(frames.some(f=>f.width>anchor.width+2&&f.width<box.width-2&&f.height>anchor.height+2)).toBe(true);
    await page.getByRole('option',{name:'Bind for Flight',exact:true}).click();await page.getByRole('button',{name:'Bind K',exact:true}).click();await expect(page.locator('.palette-message')).toContainText('Flight bound to k');
    await page.keyboard.press('Escape');await expect.poll(()=>main.requests.filter(r=>r.path==='/client/screen'&&r.method==='DELETE').length).toBe(1);
    overlay.emit('virtualScreen',{action:'close',screenName:'clickgui'});await expect(hud.locator('.island-visibility')).not.toHaveClass(/palette-suspended/);
    expect(main.requests.filter(r=>r.path==='/client/localStorage/all'&&r.method==='PUT')).toHaveLength(0);expect(main.errors).toEqual([]);expect(overlay.errors).toEqual([]);expect(cache.errors).toEqual([]);await hudContext.close();await cached.close();
});

test('movement keys, space and mouse share very faint pulses and release in menus',async({page})=>{
    const api=await setup(page);await page.route('**/api/v1/client/components/opai',r=>r.fulfill({json:[{id:'keystrokes',name:'Keystrokes',settings:{enabled:true,alignment:{horizontalAlignment:'Left',horizontalOffset:15,verticalAlignment:'Bottom',verticalOffset:15}}}]}));
    await page.goto('/#/hud?static&preview');await expect(page.locator('.key')).toHaveCount(5);await expect(page.locator('[data-key="key.keyboard.w"]')).toHaveText('W');
    for(const key of ['w','a','s','d','space']){
        api.emit('key',{key:`key.keyboard.${key}`,action:1});const item=page.locator(`[data-key="key.keyboard.${key}"]`);await expect(item).toHaveClass(/active/);await expect(item.locator('.key-wave')).toHaveCount(1);
        const opacity=await item.locator('.key-wave').evaluate(el=>Number((el.getAnimations()[0].effect as KeyframeEffect).getKeyframes()[0].opacity));expect(opacity).toBeLessThan(.06);
        api.emit('key',{key:`key.keyboard.${key}`,action:-1});await expect(item.locator('.key-wave')).toHaveCount(1);api.emit('keyboardKey',{key:`key.keyboard.${key}`,action:0,screen:'inventory'});await expect(item).not.toHaveClass(/active/);
    }
    api.emit('mouseButton',{button:0,action:1,screen:null});await expect(page.locator('.mouse-key').first().locator('.key-wave')).toHaveCount(1);expect(api.errors).toEqual([]);
});

test('array list uses white names, accent tags and continuous right-aligned steps',async({page})=>{
    const api=await setup(page);for(const [name,tag] of [['Scaffold','Normal'],['KillAura','Single'],['AutoClicker','']]){const module=api.modules.find(m=>m.name===name)!;module.enabled=true;module.tag=tag as any;}
    await page.route('**/api/v1/client/components/opai',r=>r.fulfill({json:[{id:'arraylist',name:'ArrayList',settings:{enabled:true,showTags:true,order:'Descending',itemAlignment:'Right',alignment:{horizontalAlignment:'Right',horizontalOffset:4,verticalAlignment:'Top',verticalOffset:28}}}]}));
    await page.goto('/#/hud?static&preview');const rows=page.locator('.arraylist .module');await expect(rows).toHaveCount(4);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);
    const boxes=await rows.evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}));for(let i=1;i<boxes.length;i++){expect(boxes[i-1].width).toBeGreaterThanOrEqual(boxes[i].width);expect(boxes[i].x+boxes[i].width).toBeCloseTo(boxes[0].x+boxes[0].width,0);expect(boxes[i].y).toBeCloseTo(boxes[i-1].y+boxes[i-1].height,0);expect(boxes[i].height).toBeLessThanOrEqual(26);}
    expect(await page.locator('.arraylist').evaluate(el=>getComputedStyle(el,'::after').backgroundImage)).toContain('linear-gradient');expect(await page.locator('.arraylist').evaluate(el=>getComputedStyle(el,'::after').width)).toBe('1px');
    await expect(page.locator('.arraylist .module-name').first()).toHaveCSS('color','rgb(255, 255, 255)');await expect(page.locator('.arraylist .tag').first()).toHaveCSS('color','rgb(255, 182, 170)');await page.locator('.arraylist').screenshot({path:'reports/arraylist-detail.png'});expect(api.errors).toEqual([]);
});

test('every HUD component receives the shared soft shadow without doubling the island shadow',async({page})=>{
    const api=await setup(page);await page.goto('/#/hud?static&preview');await expect(page.locator('.island')).toBeVisible();const wrappers=page.locator('.draggable-element');await expect(wrappers).toHaveCount(6);
    for(const wrapper of await wrappers.all()){const name=await wrapper.getAttribute('data-component'),filter=await wrapper.locator('.contained-element').evaluate(el=>getComputedStyle(el).filter);expect(filter).toBe('none');if(name==='Keystrokes')await expect(wrapper.locator('.key').first()).not.toHaveCSS('box-shadow','none');}
    await expect(page.locator('.island')).not.toHaveCSS('box-shadow','none');expect(api.errors).toEqual([]);
});

test('singleplayer uses the menu flip in both directions with a lighter title backdrop',async({page})=>{
    const api=await setup(page);await page.goto('/#/title?static&preview');await expect(page.locator('.backdrop')).toHaveCSS('background-image',/rgba\(0, 0, 0, 0\.467\)/);
    await page.evaluate(()=>{(window as any).__single=[];let count=0;function frame(){const el=document.querySelector('.menu-buttons,.opai-list .rows');if(el)(window as any).__single.push(el.getAttribute('style'));if(++count<80)requestAnimationFrame(frame);}requestAnimationFrame(frame);});
    await page.getByRole('button',{name:'Single player',exact:true}).click();const rows=page.locator('.opai-list[aria-label="Select World"] .rows');await expect(rows).toBeVisible();await expect.poll(()=>rows.getAttribute('style')).toContain('rotateY(0deg) scale(1)');
    expect((await page.evaluate(()=>(window as any).__single as string[])).some(s=>/rotateY\(-[\d.]+deg\)/.test(s)&&!s.includes('rotateY(-180deg)'))).toBe(true);
    await page.getByRole('button',{name:'Back',exact:true}).click();await expect.poll(()=>page.locator('.menu-buttons').getAttribute('style')).toContain('rotateY(0deg) scale(1, 1)');expect(api.errors).toEqual([]);
});


test('HSV conversion preserves RGB including greys and hue wrap',()=>{
    for(const rgb of [[0,0,0],[255,255,255],[128,128,128],[255,0,0],[0,255,0],[0,0,255],[255,165,0],[123,45,210]]){const hsv=rgbToHsv(...rgb as [number,number,number]);const result=hsvToRgb(hsv.h,hsv.s,hsv.v);for(let i=0;i<3;i++)expect(result[i]).toBeCloseTo(rgb[i],0);}
    expect(hsvToRgb(360,1,1)).toEqual([255,0,0]);expect(hsvToRgb(-120,1,1)).toEqual([0,0,255]);
});

test('inline HSV color picker drags without opening an OS dialog and preserves alpha on commit',async({page})=>{
    const api=await setup(page);let saved:any;
    await page.route('**/api/v1/client/modules/settings?name=AimAssist',async route=>{
        if(route.request().method()==='PUT'){saved=route.request().postDataJSON();await route.fulfill({status:204});}
        else await route.fulfill({json:{name:'AimAssist',valueType:'CONFIGURABLE',value:[{name:'BoxColor',valueType:'COLOR',value:-2130771968}]}});
    });
    await page.goto('/#/clickgui?static&preview');const module=page.locator('.panel').first().locator('.module').first();await module.locator('.name').first().click({button:'right'});const picker=module.locator('.color-picker');await expect(picker).toBeVisible();await expect(module.locator('.reveal.visible').first()).toHaveAttribute('data-motion-active','false');
    await expect(module.locator('input[type=color]')).toHaveCount(0);await expect(module.locator('.settings')).toHaveCSS('background-color','rgb(33, 27, 26)');
    const surface=picker.getByRole('slider',{name:'Box Color saturation and brightness',exact:true}),box=(await surface.boundingBox())!;expect(box.width/box.height).toBeCloseTo(2.08,1);
    await page.mouse.move(box.x+box.width*.75,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.5);expect(saved).toBeUndefined();await page.mouse.move(box.x+box.width*.75,box.y+box.height*.5);await page.mouse.up();
    await expect.poll(()=>!!saved).toBe(true);const color=intToRgba(saved.value[0].value);expect(color[0]).toBeCloseTo(128,0);expect(color[1]).toBeCloseTo(32,0);expect(color[2]).toBeCloseTo(32,0);expect(color[3]).toBe(128);
    const alpha=picker.getByRole('slider',{name:'Box Color opacity',exact:true});await alpha.focus();await page.keyboard.press('ArrowLeft');await expect.poll(()=>intToRgba(saved.value[0].value)[3]).toBe(127);
    const hue=(await picker.getByRole('slider',{name:'Box Color hue',exact:true}).boundingBox())!;await page.mouse.click(hue.x+hue.width/2,hue.y+hue.height/3);await expect.poll(()=>intToRgba(saved.value[0].value)[1]).toBeGreaterThan(120);
    await page.screenshot({path:'reports/inline-color-settings.png'});expect(api.errors).toEqual([]);
});

test('potion cards are compact with matched icon, title and tinted backgrounds',async({page})=>{
    const api=await setup(page);await page.goto('/#/hud?static&preview');await expect(page.locator('.island')).toBeVisible();api.emit('clientPlayerEffect',{effects:[
        {effect:'minecraft:haste',localizedName:'Haste',duration:5860,amplifier:1,color:0xd9c550},
        {effect:'minecraft:absorption',localizedName:'Absorption',duration:260,amplifier:1,color:0x2a68a4},
        {effect:'minecraft:resistance',localizedName:'Resistance',duration:160,amplifier:1,color:0x9e5247}
    ]});const cards=page.locator('.effects .effect');await expect(cards).toHaveCount(3);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);
    for(const card of await cards.all()){expect((await card.boundingBox())!.height).toBe(64);const icon=await card.locator('.effect-icon').evaluate(el=>getComputedStyle(el).backgroundColor),name=await card.locator('.name').evaluate(el=>getComputedStyle(el).color);expect(icon).toBe(name);expect(await card.evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('linear-gradient');await expect(card.locator('.amplifier')).toHaveCSS('color',name);}
    await expect(cards.nth(0).locator('.duration')).toHaveText('4:53');await expect(cards.nth(1).locator('.duration')).toHaveText('0:13');await expect(cards.nth(1).locator('.duration')).toHaveClass(/urgent/);
    expect((await cards.first().boundingBox())!.width).toBeLessThan((await cards.last().boundingBox())!.width);await page.locator('.effects').screenshot({path:'reports/effects-detail.png'});expect(api.errors).toEqual([]);
});

test('HUD editor has no pink frame on hover or while dragging',async({page})=>{
    const api=await setup(page);await page.goto('/#/clickgui?static&preview');await page.getByRole('button',{name:'HUD Editor',exact:true}).click();const hud=page.locator('[data-component=SessionInfo]');await expect(hud).toBeVisible();await hud.hover();await expect(hud).toHaveCSS('outline-style','none');const before=(await hud.boundingBox())!;
    await page.mouse.move(before.x+12,before.y+12);await page.mouse.down();await page.mouse.move(before.x+62,before.y+42);await expect(hud).toHaveCSS('outline-style','none');await page.mouse.up();await expect.poll(()=>api.requests.filter(r=>r.path==='/client/components/sessioninfo/alignment').length).toBe(1);expect(api.errors).toEqual([]);
});

test('command palette bounds rendered rows and keeps keyboard navigation usable across the virtual window',async({page})=>{
    const api=await setup(page);await page.goto('/#/hud?static&preview');await expect(page.locator('.island')).toBeVisible();await page.keyboard.press('Period');const list=page.getByRole('listbox',{name:'Commands'});await expect(list).toHaveAttribute('aria-busy','false');
    expect(await list.getByRole('option').count()).toBeLessThanOrEqual(20);const total=api.modules.length*7+1;await expect(list.getByRole('option').first()).toHaveAttribute('aria-setsize',String(total));
    await list.evaluate(el=>el.scrollTo({top:el.scrollHeight,behavior:'instant'}));await expect.poll(async()=>Number(await list.getByRole('option').last().getAttribute('aria-posinset'))).toBe(total);
    await list.getByRole('option').last().click();await expect(page.getByLabel('Key binding keyboard')).toBeVisible();await page.getByRole('button',{name:'Back to commands',exact:true}).click();await expect(list.getByRole('option').last()).toHaveAttribute('aria-posinset',String(total));
    const search=page.getByLabel('Search commands');await search.fill('aim');await search.fill('');await search.focus();for(let i=0;i<22;i++)await page.keyboard.press('ArrowDown');await expect(list.locator('[aria-selected=true]')).toHaveAttribute('data-index','22');await expect(list.locator('[aria-selected=true]')).toBeInViewport();
    await search.fill('bind for flight');await expect(list.getByRole('option')).toHaveCount(1);await page.keyboard.press('Enter');await expect(page.getByLabel('Key binding keyboard')).toBeVisible();await page.setViewportSize({width:1400,height:900});await expect.poll(async()=>{const box=(await page.locator('.palette-island').boundingBox())!;return box.x+box.width;}).toBeLessThanOrEqual(1400);expect(api.errors).toEqual([]);
});

test('ClickGUI grows with a spring and the HUD editor button rises from below the viewport on cached opens',async({page})=>{
    const api=await setup(page);await page.goto('/#/clickgui?static&preview');await expect(page.locator('.panel')).toHaveCount(5);await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');
    api.emit('virtualScreen',{action:'open',screenName:'clickgui'});
    const frames=await page.locator('.clickgui').evaluate(el=>el.getAnimations().map(a=>(a.effect as KeyframeEffect).getKeyframes()));expect(frames[0][0].transform).toContain('0.58');expect(frames[0].some(f=>Number(String(f.transform).match(/scale\(([^)]+)/)?.[1])>1)).toBe(true);
    const rise=await page.getByRole('button',{name:'HUD Editor',exact:true}).evaluate(el=>el.getAnimations().map(a=>(a.effect as KeyframeEffect).getKeyframes()).some(frames=>parseFloat(String(frames[0].transform).slice(11))>50));expect(rise).toBe(true);
    await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');expect(api.errors).toEqual([]);
});

// One asynchronous content/layout retarget is allowed; per-frame style writes are not.
test('palette spring runs as compositor keyframes without per-frame style writes and reverses cleanly',async({page})=>{
    const api=await setup(page);await page.goto('/#/hud?static&preview');await expect(page.locator('.island')).toBeVisible();await page.evaluate(()=>document.fonts.ready);await page.keyboard.press('Period');const palette=page.locator('.palette-island');await expect(palette).toBeVisible();await expect(palette).toHaveAttribute('data-motion-active','false');
    await page.getByLabel('Search commands').fill('bind for flight');await page.keyboard.press('Enter');await expect(palette).toHaveAttribute('data-motion-active','true');
    const sample=await palette.evaluate(async el=>{let writes=0;const observer=new MutationObserver(m=>writes+=m.length);observer.observe(el,{attributes:true,attributeFilter:['style']});const before=el.getBoundingClientRect().width;const keyframes=el.getAnimations().some(a=>(a.effect as KeyframeEffect).getKeyframes().length>40);await new Promise(r=>setTimeout(r,110));const after=el.getBoundingClientRect().width;observer.disconnect();return{writes,before,after,keyframes};});expect(sample.keyframes).toBe(true);expect(sample.writes).toBeLessThanOrEqual(3);expect(Math.abs(sample.after-sample.before)).toBeGreaterThan(3);
    await page.keyboard.press('Escape');await expect(page.getByLabel('Search commands')).toBeFocused();await page.getByRole('button',{name:'Close commands',exact:true}).click();await expect(palette).toHaveCount(0);await expect(page.locator('.island')).toBeVisible();expect(api.errors).toEqual([]);
});

test('rapid key presses reuse seven ripple nodes and stop their animations at idle',async({page})=>{
    const api=await setup(page);await page.route('**/api/v1/client/components/opai',r=>r.fulfill({json:[{id:'keystrokes',name:'Keystrokes',settings:{enabled:true,zIndex:0,alignment:{horizontalAlignment:'Left',horizontalOffset:15,verticalAlignment:'Bottom',verticalOffset:15}}}]}));await page.goto('/#/hud?static&preview');const keys=page.locator('.keystrokes .key-wave');await expect(keys).toHaveCount(7);
    for(let i=0;i<100;i++){api.emit('mouseButton',{button:0,action:1,screen:null});api.emit('mouseButton',{button:0,action:0,screen:null});api.emit('key',{key:'key.keyboard.w',action:1});api.emit('key',{key:'key.keyboard.w',action:0});}
    await expect(page.locator('.mouse-key').first()).toHaveText('100');await expect(keys).toHaveCount(7);await expect.poll(()=>keys.evaluateAll(els=>els.reduce((n,el)=>n+el.getAnimations().length,0))).toBe(0);await expect(page.locator('.mouse-key').first()).toHaveText('LMB');expect(api.errors).toEqual([]);
});

test('loader assembles its center and original parts before the final logo departs',async({page})=>{
    const api=await setup(page,true);await page.goto('/#/title?static&preview');await expect(page.locator('.intro.finishing:not(.joined) .core')).toBeVisible();await expect(page.locator('.intro .part')).toHaveCount(3);await page.screenshot({path:'reports/intro-assembling.png'});await expect(page.locator('.intro.joined .whole')).toBeVisible();await expect(page.locator('.intro')).toHaveCount(0);expect(api.errors).toEqual([]);
});

test('LiquidScript bridge shows live server address and ping and drops expired telemetry',async({page})=>{
    const shared:Record<string,string>={};const snapshot=()=>JSON.stringify({protocol:1,version:'1.0.0',at:Date.now(),connected:true,inWorld:true,serverAddress:'play.example.org:25565',ping:37,capabilities:{serverInfo:true,nametags:true,preview:true},errors:[]});shared['opai.bridge.snapshot']=snapshot();
    const api=await setup(page,false,shared);await page.goto('/#/hud?static&preview');await expect(page.locator('.island .connection')).toHaveText('play.example.org:25565');await expect(page.locator('.island .ping')).toHaveText('37 ms');
    await page.evaluate(()=>{(window as any).__bridge= (window as any).OpaiTheme.getState();});expect(await page.evaluate(()=>(window as any).__bridge.capabilities.nametags)).toBe(true);
    shared['opai.bridge.snapshot']=JSON.stringify({...JSON.parse(snapshot()),at:Date.now()-10000});await expect(page.locator('.island .ping')).toHaveCount(0);await expect(page.locator('.island .connection')).not.toHaveText('play.example.org:25565');expect(api.errors).toEqual([]);
});

test('ESP settings open a leased native preview and theme API feature writes stay isolated',async({page})=>{
    const shared:Record<string,string>={'opai.bridge.snapshot':JSON.stringify({protocol:1,version:'1.0.0',at:Date.now(),connected:true,inWorld:true,serverAddress:null,ping:null,capabilities:{serverInfo:true,nametags:true,preview:true},errors:[]})};
    const api=await setup(page,false,shared);await page.goto('/#/clickgui?static&preview');await expect.poll(()=>page.evaluate(()=>(window as any).OpaiTheme?.getState()?.capabilities.preview)).toBe(true);
    const row=page.locator('.module .name').filter({hasText:/^Player ESP$/});await row.click({button:'right'});const card=page.getByLabel('Entity render preview');await expect(card).toBeVisible();
    await expect.poll(()=>JSON.parse(shared['opai.bridge.preview']??'{}').module).toBe('PlayerESP');const request=JSON.parse(shared['opai.bridge.preview']);expect(request.rect.width).toBeGreaterThan(100);expect(request.rect.height).toBeGreaterThan(100);expect(request.at).toBeGreaterThan(Date.now()-2000);expect(request.viewport.width).toBe(2000);
    await page.evaluate(()=>(window as any).OpaiTheme.setFeatures({nametags:false}));expect(JSON.parse(shared['opai.bridge.features']).nametags).toBe(false);expect(shared['opai.bridge.snapshot']).toBeDefined();
    await row.click({button:'right'});await expect(card).toHaveCount(0);await expect.poll(()=>JSON.parse(shared['opai.bridge.preview']??'{}').at).toBe(0);await page.screenshot({path:'reports/bridge-clickgui.png'});expect(api.errors).toEqual([]);
});

test('LiquidScript data does not leak into the theme preference diff',async({page})=>{
    const shared:Record<string,string>={'opai.bridge.snapshot':'{"protocol":1,"at":0}','opai.bridge.preview':'{"protocol":1,"at":0}'};const api=await setup(page,false,shared);await page.goto('/#/clickgui?static&preview');await expect(page.locator('.panel')).toHaveCount(5);
    expect(await page.evaluate(()=>localStorage.getItem('opai.bridge.snapshot'))).toBeNull();await page.locator('.panel .module .name').first().click({button:'right'});await page.waitForTimeout(350);expect(shared['opai.bridge.snapshot']).toBe('{"protocol":1,"at":0}');expect(api.requests.some(r=>r.path==='/client/localStorage/all'&&r.method==='PUT')).toBe(false);expect(api.errors).toEqual([]);
});

test('native static ClickGUI publishes ESP preview, retires its lease on close and resumes on reopen',async({page})=>{
    const shared:Record<string,string>={};
    const snapshot=()=>shared['opai.bridge.snapshot']=JSON.stringify({protocol:1,version:'1.1.0',at:Date.now(),connected:true,inWorld:true,serverAddress:'native.example.org',ping:48,capabilities:{serverInfo:true,nametags:true,preview:true},errors:[]});
    snapshot();const keep=setInterval(snapshot,500);
    try{
        const api=await setup(page,false,shared);await page.goto('/#/clickgui?static');const row=page.locator('.module .name').filter({hasText:/^Player ESP$/});await row.click({button:'right'});
        await expect(page.getByLabel('Entity render preview')).toBeVisible();await expect.poll(()=>JSON.parse(shared['opai.bridge.preview']??'{}').module).toBe('PlayerESP');
        api.emit('virtualScreen',{action:'close',screenName:'clickgui'});await expect(page.getByLabel('Entity render preview')).toHaveCount(0);await expect.poll(()=>JSON.parse(shared['opai.bridge.preview']??'{}').at).toBe(0);
        api.emit('virtualScreen',{action:'open',screenName:'clickgui'});await expect(page.getByLabel('Entity render preview')).toBeVisible();await expect.poll(()=>JSON.parse(shared['opai.bridge.preview']??'{}').at).toBeGreaterThan(Date.now()-1500);expect(api.errors).toEqual([]);
    }finally{clearInterval(keep);}
});

test('Windows software animation has intermediate frames and finishes with suspended RAF',async({page})=>{
    const api=await setup(page);await page.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{value:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'}));
    await page.goto('/#/clickgui?static&preview');await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');
    await page.evaluate(()=>{window.requestAnimationFrame=()=>123456;});api.emit('virtualScreen',{action:'open',screenName:'clickgui'});
    await page.waitForTimeout(75);const scale=await page.locator('.clickgui').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a);expect(scale).toBeGreaterThan(.58);expect(scale).not.toBe(1);
    await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');await expect(page.locator('.clickgui')).toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 0)');
    const button=page.getByRole('button',{name:'HUD Editor',exact:true});await expect(button).toHaveCSS('opacity','1');
    await page.goto('/#/hud?static&preview');await expect(page.locator('.island')).toBeVisible();await page.evaluate(()=>{window.requestAnimationFrame=()=>123456;});
    api.emit('moduleToggle',{moduleName:'KillAura',enabled:true});await expect(page.locator('.notice-row')).toBeVisible();await expect.poll(async()=>(await page.locator('.island').boundingBox())!.height).toBeGreaterThan(65);
    await expect(page.locator('.notice-row')).toHaveCount(0);await expect(page.locator('.island')).toHaveAttribute('data-motion-active','false');expect(api.errors).toEqual([]);
});

test('Windows period panel retains focus and completes expansion and closing without RAF',async({page})=>{
    const api=await setup(page);await page.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{value:'Windows NT 10.0'}));await page.goto('/#/hud?static&preview');await expect(page.locator('.island')).toHaveAttribute('data-motion-active','false');
    await page.evaluate(()=>{window.requestAnimationFrame=()=>123456;});await page.keyboard.press('Period');await expect(page.locator('.palette-island')).toBeVisible();await expect(page.getByLabel('Search commands')).toBeFocused();
    await expect(page.locator('.palette-island')).toHaveAttribute('data-motion-active','false');await page.keyboard.press('Escape');await expect(page.locator('.palette-island')).toHaveCount(0);await expect(page.locator('.island')).toBeVisible();expect(api.errors).toEqual([]);
});

test('island uses resolved IP fallback, preserves zero latency and clears data outside a world',async({page})=>{
    const shared:Record<string,string>={};const state={protocol:1,version:'1.1.0',at:Date.now(),connected:true,inWorld:true,serverAddress:null,serverIP:'203.0.113.55',ping:0,capabilities:{serverInfo:true,nametags:true,preview:true},errors:[]};shared['opai.bridge.snapshot']=JSON.stringify(state);
    const api=await setup(page,false,shared);await page.goto('/#/hud?static');await expect(page.locator('.island .connection')).toHaveText('203.0.113.55');await expect(page.locator('.island .ping')).toHaveText('0 ms');
    shared['opai.bridge.snapshot']=JSON.stringify({...state,at:Date.now(),serverIP:null,singleplayer:true,ping:null});await expect(page.locator('.island .connection')).toHaveText('singleplayer');await expect(page.locator('.island .ping')).toHaveCount(0);
    shared['opai.bridge.snapshot']=JSON.stringify({...state,at:Date.now(),inWorld:false});await expect(page.locator('.island .connection')).toHaveText('Minecraft');await expect(page.locator('.island .ping')).toHaveCount(0);expect(api.errors).toEqual([]);
});

test('potion icons are 15 percent larger and background is more transparent',async({page})=>{
    const api=await setup(page);await page.goto('/#/hud?static&preview');await expect(page.locator('.island')).toBeVisible();api.emit('clientPlayerEffect',{effects:[{effect:'minecraft:speed',localizedName:'Speed',duration:1780,amplifier:1,color:0x7cafc6}]});
    const icon=page.locator('.effect-icon');expect(await icon.evaluate(el=>parseFloat(getComputedStyle(el).width))).toBeCloseTo(13.8,1);expect(await icon.evaluate(el=>parseFloat(getComputedStyle(el).height))).toBeCloseTo(13.8,1);
    expect(await page.locator('.effect').evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('0.56');expect(api.errors).toEqual([]);
});

test('Scaffold opens its counter immediately and skips only its own generic toggle notice',async({page})=>{
 const api=await setup(page);await page.goto('/#/hud?static&preview');await expect(page.locator('.island')).toBeVisible();
 api.emit('moduleToggle',{moduleName:'Scaffold',enabled:true});await expect(page.locator('.scaffold-content')).not.toHaveClass(/content-hidden/);await expect(page.locator('.notice-row')).toHaveCount(0);
 api.emit('blockCountChange',{count:96});await expect(page.locator('.scaffold-content')).toContainText('96 blocks left');
 api.emit('moduleToggle',{moduleName:'Flight',enabled:true});await expect(page.locator('.notice-row')).toContainText('Flight has been Enabled!');await expect(page.locator('.scaffold-content')).toHaveClass(/content-hidden/);
 await expect(page.locator('.notice-row')).toHaveCount(0);await expect(page.locator('.scaffold-content')).not.toHaveClass(/content-hidden/);
 api.emit('moduleToggle',{moduleName:'Scaffold',enabled:false});await expect(page.locator('.notice-row')).toHaveCount(0);await expect(page.locator('.scaffold-content')).toHaveClass(/content-hidden/);expect(api.errors).toEqual([]);
});

test('cached native ClickGUI replays on every real screen reopen without virtualScreen events',async({page})=>{
 const api=await setup(page);let screen:string|null=null;
 await page.route('**/api/v1/client/screen',route=>screen?route.fulfill({json:{name:screen}}):route.fulfill({status:403,json:{error:'No screen'}}));
 await page.goto('/#/clickgui?static');await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');
 await page.evaluate(()=>{(window as any).__reopens=0;window.addEventListener('opai-clickgui-open',()=>{(window as any).__reopens++;});});
 for(let cycle=1;cycle<=3;cycle++){
   screen='net.ccbluex.liquidbounce.integration.screen.impl.CustomStandaloneMinecraftScreen';
   await expect.poll(()=>page.evaluate(()=>(window as any).__reopens),{intervals:[16,32,50]}).toBe(cycle);
   expect(await page.locator('.clickgui').evaluate(el=>el.getAnimations().some(a=>(a.effect as KeyframeEffect).getKeyframes().some(f=>String(f.transform).includes('0.58'))))).toBe(true);
   await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');screen=null;await page.waitForTimeout(180);
 }
 expect(api.errors).toEqual([]);
});

for(const [label,route] of [['Single player','singleplayer'],['Multi player','multiplayer'],['Alt Manager','altmanager'],['Proxy Manager','proxymanager']] as const){
 test(`Windows ${route} flip survives reduced-motion, paused RAF and native page recreation`,async({page})=>{
    const api=await setup(page);await page.emulateMedia({reducedMotion:'reduce'});
    await page.addInitScript(()=>{
        Object.defineProperty(navigator,'userAgent',{value:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'});
        (window as any).__menuSamples=[];
        new MutationObserver(records=>{for(const record of records){const node=record.target;if(node instanceof HTMLElement&&node.matches('.rows,.menu-buttons'))(window as any).__menuSamples.push(node.style.transform);}}).observe(document,{subtree:true,attributes:true,attributeFilter:['style']});
    });
    // Native screen creation takes time and can recreate the CEF document. No
    // virtualScreen acknowledgement is emitted until the new page is available.
    await page.route('**/api/v1/client/screen',r=>r.fulfill({json:{}}));
    await page.goto('/#/none');await expect(page.locator('.title-screen')).toBeVisible();await expect(page.locator('.opai-menu')).toHaveAttribute('data-projection','software');
    await page.evaluate(()=>{window.requestAnimationFrame=()=>123456;});await page.getByRole('button',{name:label,exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('opai.menu.handoff'))).not.toBeNull();
    const before=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('opai.menu.handoff')!));expect(before.tweens[0].current).toBeLessThan(-70);expect(before.tweens[0].current).toBeGreaterThan(-180);
    await page.waitForTimeout(850);expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('opai.menu.handoff')!).tweens[0].current)).toBe(before.tweens[0].current);
    await page.goto(`/?recreated=${route}#/${route}?static&preview`);await expect(page.locator('.opai-list')).toBeVisible();await expect(page.locator('.opai-menu')).toHaveAttribute('data-motion-active','false');
    const incoming=await page.evaluate(()=>(window as any).__menuSamples as string[]);expect(incoming.some(s=>s.includes('matrix(')&&!s.includes('matrix(1, 0, 0, 1, 0, 0)'))).toBe(true);
    const final=await page.locator('.rows').evaluate(el=>{const matrix=new DOMMatrix(getComputedStyle(el).transform);return{a:matrix.a,d:matrix.d};});expect(final.a).toBeCloseTo(1);expect(final.d).toBeCloseTo(1);
    await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.locator('.title-screen')).toBeVisible();await expect(page.locator('.opai-menu')).toHaveAttribute('data-motion-active','false');
    expect(await page.evaluate(()=>sessionStorage.getItem('opai.menu.handoff'))).toBeNull();expect(api.errors).toEqual([]);
 });
}

test('latency precedes server address, changes color and preserves existing island scale',async({page})=>{
    const shared:Record<string,string>={};const state={protocol:1,version:'1.1.1',at:Date.now(),connected:true,inWorld:true,serverAddress:'mc.hypixel.net',ping:378,capabilities:{serverInfo:true,nametags:true,preview:true},errors:[]};
    const update=(ping:number)=>shared['opai.bridge.snapshot']=JSON.stringify({...state,at:Date.now(),ping});update(378);
    const api=await setup(page,false,shared);await page.goto('/#/hud?static&preview');await expect(page.locator('.island .network')).toHaveText('378 msto'+'mc.hypixel.net');
    expect(await page.locator('.island .ping').evaluate(el=>!!(el.compareDocumentPosition(document.querySelector('.island .connection')!)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    await expect(page.locator('.island .ping')).toHaveCSS('color','rgb(255, 154, 50)');await expect(page.locator('.island .latency')).toHaveCSS('gap','1px');await expect(page.locator('.island')).toHaveCSS('font-size','8px');await expect(page.locator('.island')).toHaveCSS('height','23px');await expect(page.locator('.island .opai-icon').first()).toHaveCSS('width','12px');
    update(20);await expect(page.locator('.island .ping')).toHaveText('20 ms');await expect(page.locator('.island .ping')).toHaveCSS('color','rgb(103, 241, 121)');
    update(900);await expect(page.locator('.island .ping')).toHaveCSS('color','rgb(255, 79, 89)');update(378);await expect(page.locator('.island .ping')).toHaveCSS('color','rgb(255, 154, 50)');
    await page.locator('.island-visibility').screenshot({path:'reports/island-network-order-1.12.2.png'});expect(api.errors).toEqual([]);
});

test('failed native menu handoff reverses the held flip and re-enables title buttons',async({page})=>{
    const api=await setup(page);await page.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{value:'Windows NT 10.0'}));
    await page.route('**/api/v1/client/screen',r=>r.fulfill({status:503,json:{error:'screen unavailable'}}));
    await page.goto('/#/none');await expect(page.locator('.title-screen')).toBeVisible();await page.getByRole('button',{name:'Single player',exact:true}).click();
    await expect(page.locator('.opai-menu')).toHaveAttribute('data-motion-active','false');await expect(page.getByRole('button',{name:'Single player',exact:true})).toBeEnabled();
    const matrix=await page.locator('.menu-buttons').evaluate(el=>{const m=new DOMMatrix(getComputedStyle(el).transform);return{a:m.a,d:m.d};});expect(matrix.a).toBeCloseTo(1);expect(matrix.d).toBeCloseTo(1);expect(await page.evaluate(()=>sessionStorage.getItem('opai.menu.handoff'))).toBeNull();expect(api.errors).toEqual([]);
});

test('native host reports Windows even with a stripped browser user agent',async({page})=>{
    const api=await setup(page);await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{value:'LiquidBounce Browser'}));
    await page.route('**/api/v1/client/info',r=>r.fulfill({json:{os:'windows',fps:144,gameVersion:'26.3',clientVersion:'0.41.0',inGame:false,clientDir:'/fixture/LiquidBounce',gameDir:'/fixture'}}));
    await page.goto('/#/title?static&preview');await expect(page.locator('.opai-menu')).toHaveAttribute('data-projection','software');
    await page.getByRole('button',{name:'Multi player',exact:true}).click();await expect(page.locator('.opai-list')).toBeVisible();await expect(page.locator('.opai-menu')).toHaveAttribute('data-motion-active','true');await expect(page.locator('.opai-menu')).toHaveAttribute('data-motion-active','false');
    expect(await page.locator('.rows').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).is2D)).toBe(true);expect(api.errors).toEqual([]);
});

test('diagnostics can isolate shadows and the script with an expiring lease and restores all probes on close',async({page})=>{
 const shared:Record<string,string>={};const api=await setup(page,false,shared);await page.goto('/#/hud?static&preview');await page.keyboard.press('Control+Shift+F8');const panel=page.getByLabel('Animation diagnostics',{exact:true});await expect(panel).toBeVisible();await page.getByLabel('网页绘制对照').selectOption('shadows');await expect(page.locator('.island')).toHaveCSS('box-shadow','none');await page.getByLabel('网页绘制对照').selectOption('hud');await expect(page.locator('.hud')).toHaveCSS('visibility','hidden');await page.getByLabel('暂停脚本绘制').check();await expect.poll(()=>JSON.parse(shared['opai.bridge.renderProbe']??'{}').paused).toBe(true);await page.getByRole('button',{name:'Close animation diagnostics',exact:true}).click();await expect(page.locator('.hud')).toHaveCSS('visibility','visible');await expect(page.locator('.island')).not.toHaveCSS('box-shadow','none');await expect.poll(()=>JSON.parse(shared['opai.bridge.renderProbe']??'{}').paused).toBe(false);expect(api.errors).toEqual([]);
});

test('paint diagnostics can be controlled by native keyboard events without an input-capable HUD screen',async({page})=>{
 const shared:Record<string,string>={};const api=await setup(page,false,shared);await page.goto('/#/hud?static&preview');api.emit('keyboardKey',{key:'key.keyboard.f8',keyCode:297,action:1,mods:3});await expect(page.getByLabel('Animation diagnostics',{exact:true})).toBeVisible();api.emit('keyboardKey',{key:'key.keyboard.f6',keyCode:295,action:1,mods:3});await expect(page.locator('.island')).toHaveCSS('box-shadow','none');api.emit('keyboardKey',{key:'key.keyboard.f7',keyCode:296,action:1,mods:3});await expect.poll(()=>JSON.parse(shared['opai.bridge.renderProbe']??'{}').paused).toBe(true);await page.waitForTimeout(200);api.emit('keyboardKey',{key:'key.keyboard.f8',keyCode:297,action:1,mods:3});await expect(page.getByLabel('Animation diagnostics',{exact:true})).toHaveCount(0);await expect(page.locator('.island')).not.toHaveCSS('box-shadow','none');expect(api.errors).toEqual([]);
});
