import {test,expect} from '@playwright/test';
import {setup} from './fixtures';

test('array list uses regular white text without changing font size, line height or stair alignment',async({page})=>{
    const api=await setup(page);
    for(const m of api.modules){m.enabled=['AutoClicker','Scaffold','KillAura','NameTags','PlayerESP','Animations','NoSlow','FullBright','Ambience'].includes(m.name);m.tag=({Scaffold:'Normal',KillAura:'Single',NoSlow:'Prediction'} as any)[m.name]??null;}
    await page.route('**/api/v1/client/components/opai',r=>r.fulfill({json:[{id:'arraylist',name:'ArrayList',settings:{enabled:true,showTags:true,order:'Descending',itemAlignment:'Right',alignment:{horizontalAlignment:'Right',horizontalOffset:4,verticalAlignment:'Top',verticalOffset:28}}}]}));
    await page.goto('/#/hud?static&preview');await expect(page.locator('.arraylist .module')).toHaveCount(9);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);
    const rows=page.locator('.arraylist .module'),first=rows.first();
    await expect(first).toHaveCSS('font-size','9px');await expect(first).toHaveCSS('line-height','12.5px');await expect(first).toHaveCSS('font-weight','400');
    await expect(first.locator('.module-name')).toHaveCSS('color','rgb(255, 255, 255)');await expect(page.locator('.arraylist .tag').first()).toHaveCSS('color','rgb(255, 182, 170)');
    const boxes=await rows.evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{x:r.x,y:r.y,w:r.width,h:r.height,font:s.fontFamily,image:s.backgroundImage};}));
    for(let i=1;i<boxes.length;i++){expect(boxes[i].y).toBeCloseTo(boxes[i-1].y+boxes[i-1].h);expect(boxes[i].x+boxes[i].w).toBeCloseTo(boxes[0].x+boxes[0].w);expect(boxes[i].w).toBeLessThanOrEqual(boxes[i-1].w);}
    expect(boxes[0].font).toContain('Opai List');expect(boxes[0].image).toContain('24px');
    await page.locator('.arraylist').screenshot({path:'reports/arraylist-1.9.2.png'});expect(api.errors).toEqual([]);
});

test('Via selection changes only version text to green and preserves the card geometry and artwork',async({page})=>{
    const api=await setup(page);await page.goto('/#/multiplayer?static&preview');await page.getByRole('button',{name:'Via Version',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Protocol Selector'});await expect(dialog).toHaveAttribute('data-motion-active','false');
    const card=dialog.getByRole('button',{name:'1.8',exact:true}),other=dialog.getByRole('button',{name:'1.21.11',exact:true});
    await card.click();await expect(card).toHaveAttribute('aria-pressed','true');await expect(other).toHaveAttribute('aria-pressed','false');
    await expect(card).toHaveCSS('color','rgb(0, 255, 0)');await expect(other).toHaveCSS('color','rgb(255, 255, 255)');
    await expect(card).toHaveCSS('box-shadow','none');await expect(card).toHaveCSS('border-width','0px');await expect(card).toHaveCSS('width','88px');await expect(card).toHaveCSS('height','44px');await expect(card.locator('img')).toHaveCSS('opacity','1');
    expect(await card.evaluate(el=>getComputedStyle(el,'::before').content)).toBe('none');
    await expect(card.locator('.opai-ripple')).toHaveCount(0);await card.screenshot({path:'reports/via-selected-1.9.2.png'});
    await dialog.getByRole('button',{name:'Confirm',exact:true}).click();await expect.poll(()=>api.requests.filter(r=>r.path==='/client/protocols/protocol'&&r.method==='PUT').length).toBe(1);expect(api.errors).toEqual([]);
});

test('module toggle ripples are clipped, animate without RAF on Windows and do not intercept settings or binds',async({page})=>{
    const api=await setup(page);await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{value:'Windows NT 10.0'}));
    await page.goto('/#/clickgui?static&preview');await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');
    const name=page.locator('.panel').first().locator('.module .name').first();const box=(await name.boundingBox())!;
    await page.evaluate(()=>{window.requestAnimationFrame=()=>123456;});
    await page.mouse.move(box.x+20,box.y+18);await page.mouse.down();const wave=name.locator('.opai-ripple');await expect(wave).toHaveCount(1);
    await expect(name).toHaveCSS('overflow','hidden');await expect(name.locator('.module-label')).toHaveCSS('font-size','16.6px');
    const scales=await wave.evaluate(async el=>{const samples:string[]=[];for(let i=0;i<5;i++){await new Promise(r=>setTimeout(r,35));samples.push((el as HTMLElement).style.transform);}return samples;});expect(new Set(scales).size).toBeGreaterThan(2);
    // Move the pointer away while holding so the description cannot cover the wave.
    await page.mouse.move(1950,1000);await name.screenshot({path:'reports/module-ripple-1.9.2.png',style:'.description-wrapper{visibility:hidden!important}'});await page.mouse.move(box.x+20,box.y+18);await page.mouse.up();
    await expect.poll(()=>api.requests.filter(r=>r.path==='/client/modules/toggle').length).toBe(1);await expect(name).not.toHaveClass(/enabled/);await expect(wave).toHaveCount(0);
    await name.click();await expect.poll(()=>api.requests.filter(r=>r.path==='/client/modules/toggle').length).toBe(2);await expect(name).toHaveClass(/enabled/);await expect(wave).toHaveCount(0);
    await name.click({button:'right'});await expect(name.locator('..').locator('.settings')).toBeVisible();await expect(wave).toHaveCount(0);
    await name.click({button:'middle'});await expect(name).toHaveText('Press a key');await expect(wave).toHaveCount(0);
    expect(api.requests.filter(r=>r.path==='/client/modules/toggle')).toHaveLength(2);expect(api.errors).toEqual([]);
});
