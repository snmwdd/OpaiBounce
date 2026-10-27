import {test,expect} from '@playwright/test';
import {setup} from './fixtures';

async function windows(page:any,ua='Windows NT 10.0'){
    const api=await setup(page);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.addInitScript((ua:string)=>Object.defineProperty(navigator,'userAgent',{value:ua}),ua);
    await page.route('**/api/v1/client/info',r=>r.fulfill({json:{os:'WINDOWS',fps:144,inGame:true}}));
    return api;
}

test('Windows reduced-motion does not suppress repeated ClickGUI growth, editor rise or setting reveal',async({page})=>{
    const api=await windows(page,'LiquidBounce Browser');
    await page.goto('/#/clickgui?static&preview');
    await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');
    await page.evaluate(()=>{window.requestAnimationFrame=()=>123456;});
    for(let cycle=0;cycle<3;cycle++){
        api.emit('virtualScreen',{action:'open',screenName:'clickgui'});
        await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','true');
        const sample=await page.locator('.clickgui').evaluate(async el=>{
            const scales:number[]=[],ys:number[]=[];
            for(let i=0;i<8;i++){await new Promise(r=>setTimeout(r,25));scales.push(new DOMMatrix(getComputedStyle(el).transform).a);ys.push(new DOMMatrix(getComputedStyle(document.querySelector('.hud-edit-button')!).transform).f);}
            return{scales,ys};
        });
        expect(sample.scales.some(v=>v>.58&&v<.99)).toBe(true);
        expect(sample.scales.some(v=>v>1)).toBe(true);
        expect(sample.ys.some(v=>v>0)).toBe(true);
        await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');
    }
    await page.locator('.module .name').first().click({button:'right'});
    await expect(page.locator('.module > .reveal.visible').first()).toHaveAttribute('data-motion-active','true');
    await expect(page.locator('.module > .reveal.visible').first()).toHaveAttribute('data-motion-active','false');
    expect(api.errors).toEqual([]);
});

test('Windows reduced-motion retains island spring, scaffold and command morph with paused RAF',async({page})=>{
    const api=await windows(page);
    await page.goto('/#/hud?static&preview');await page.evaluate(()=>document.fonts.ready);
    const island=page.locator('.island');await expect(island).toHaveAttribute('data-motion-active','false');
    const idle=(await island.boundingBox())!.height;
    await page.evaluate(()=>{window.requestAnimationFrame=()=>123456;});
    api.emit('moduleToggle',{moduleName:'Flight',enabled:true});
    await expect(island).toHaveAttribute('data-motion-active','true');
    const heights=await island.evaluate(async el=>{const samples:number[]=[];for(let i=0;i<8;i++){await new Promise(r=>setTimeout(r,25));samples.push(el.getBoundingClientRect().height);}return samples;});
    expect(heights.some(h=>h>idle+1&&h<70)).toBe(true);
    await expect(page.locator('.notice-row')).toHaveCount(0);await expect(island).toHaveAttribute('data-motion-active','false');
    api.emit('moduleToggle',{moduleName:'Scaffold',enabled:true});
    await expect(island).toHaveAttribute('data-motion-active','true');await expect(page.locator('.scaffold-content')).not.toHaveClass(/content-hidden/);
    api.emit('moduleToggle',{moduleName:'Scaffold',enabled:false});await expect(island).toHaveAttribute('data-motion-active','false');
    await page.keyboard.press('Period');const palette=page.locator('.palette-island');
    await expect(palette).toHaveAttribute('data-motion-active','true');await expect(page.getByLabel('Search commands')).toBeFocused();
    const widths=await palette.evaluate(async el=>{const samples:number[]=[];for(let i=0;i<8;i++){await new Promise(r=>setTimeout(r,25));samples.push(el.getBoundingClientRect().width);}return samples;});
    expect(new Set(widths.map(Math.round)).size).toBeGreaterThan(2);
    await expect(palette).toHaveAttribute('data-motion-active','false');await page.keyboard.press('Escape');await expect(palette).toHaveCount(0);
    expect(api.errors).toEqual([]);
});

test('Windows reduced-motion retains WASD, space and both mouse ripples and CSS durations',async({page})=>{
    const api=await windows(page);
    await page.route('**/api/v1/client/components/opai',r=>r.fulfill({json:[{id:'keystrokes',name:'Keystrokes',settings:{enabled:true,zIndex:0,alignment:{horizontalAlignment:'Left',horizontalOffset:15,verticalAlignment:'Bottom',verticalOffset:15}}}]}));
    await page.goto('/#/hud?static&preview');await expect(page.locator('.key-wave')).toHaveCount(7);
    await page.evaluate(()=>{window.requestAnimationFrame=()=>123456;});
    for(const key of ['w','a','s','d','space'])api.emit('key',{key:`key.keyboard.${key}`,action:1});
    for(const button of [0,1])api.emit('mouseButton',{button,action:1,screen:null});
    await page.waitForTimeout(80);
    expect(await page.locator('.key-wave').evaluateAll(nodes=>nodes.filter(n=>parseFloat(getComputedStyle(n).opacity)>0).length)).toBe(7);
    for(const key of ['w','a','s','d','space'])api.emit('key',{key:`key.keyboard.${key}`,action:0});
    for(const button of [0,1])api.emit('mouseButton',{button,action:0,screen:null});
    await expect.poll(()=>page.locator('.key-wave').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).opacity==='0'))).toBe(true);
    expect(api.errors).toEqual([]);
});

test('Windows menu never mirrors either visible face during repeated forward and back flips',async({page})=>{
    const api=await windows(page);
    await page.addInitScript(()=>{
        (window as any).__negative=[];
        new MutationObserver(records=>{for(const record of records){const el=record.target;if(el instanceof HTMLElement&&el.matches('.rows,.menu-buttons')&&new DOMMatrix(getComputedStyle(el).transform).a<-.001)(window as any).__negative.push(el.style.transform);}}).observe(document,{subtree:true,attributes:true,attributeFilter:['style']});
    });
    await page.goto('/#/title?static&preview');
    for(const name of ['Single player','Multi player']){
        await page.getByRole('button',{name,exact:true}).click();await expect(page.locator('.opai-list')).toBeVisible();await expect(page.locator('.opai-menu')).toHaveAttribute('data-motion-active','false');
        await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.locator('.title-screen')).toBeVisible();await expect(page.locator('.opai-menu')).toHaveAttribute('data-motion-active','false');
    }
    expect(await page.evaluate(()=>(window as any).__negative)).toEqual([]);expect(api.errors).toEqual([]);
});

test('a late native Windows OS response replays the first ClickGUI entrance with a shortened UA',async({page})=>{
    const api=await windows(page,'LiquidBounce Browser');
    await page.addInitScript(()=>Object.defineProperty(navigator,'platform',{value:'Unknown'}));
    let release!:()=>void;const gate=new Promise<void>(r=>release=r);
    await page.route('**/api/v1/client/info',async r=>{await gate;await r.fulfill({json:{os:'WINDOWS',fps:144,inGame:true}});});
    await page.goto('/#/clickgui?static&preview');await expect(page.locator('.panel')).toHaveCount(5);
    await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');
    release();await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','true');
    await expect(page.locator('html')).toHaveAttribute('data-opai-motion','full');
    // Host detection must choose the same software driver as UA detection.
    expect(await page.locator('.clickgui').evaluate(el=>el.getAnimations().map(a=>({kind:a.constructor.name,frames:(a.effect as KeyframeEffect)?.getKeyframes(),timing:a.effect?.getTiming()})))).toEqual([]);
    await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');expect(api.errors).toEqual([]);
});

test('Windows loader retains CSS animation timing and the mascot moves when RAF stops',async({page})=>{
    const api=await setup(page,true);await page.emulateMedia({reducedMotion:'reduce'});
    await page.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{value:'Windows NT 10.0'}));
    await page.goto('/#/title?static&preview');
    await expect(page.locator('.intro .spin')).toHaveCSS('animation-duration','1.4s');
    await expect(page.locator('.intro.finishing .core')).toBeVisible();await expect(page.locator('.intro')).toHaveCount(0);
    await page.evaluate(()=>{window.requestAnimationFrame=()=>123456;});
    const positions=await page.locator('.flying').evaluate(async el=>{const samples:string[]=[];for(let i=0;i<8;i++){await new Promise(r=>setTimeout(r,40));samples.push((el as HTMLElement).style.transform);}return samples;});
    expect(new Set(positions).size).toBeGreaterThan(2);expect(api.errors).toEqual([]);
});

test('non-Windows reduced-motion still suppresses theme motion',async({page})=>{
    const api=await setup(page);await page.emulateMedia({reducedMotion:'reduce'});
    await page.addInitScript(()=>{Object.defineProperty(navigator,'userAgent',{value:'Macintosh'});Object.defineProperty(navigator,'platform',{value:'MacIntel'});});
    await page.goto('/#/clickgui?static&preview');await expect(page.locator('.panel')).toHaveCount(5);
    api.emit('virtualScreen',{action:'open',screenName:'clickgui'});await page.waitForTimeout(75);
    await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');
    expect(await page.locator('.clickgui').evaluate(el=>el.getAnimations().length)).toBe(0);
    await expect(page.locator('html')).toHaveAttribute('data-opai-motion','system');expect(api.errors).toEqual([]);
});

test('simultaneous Windows key and island animations share a frame driver and stop scheduling when settled',async({page})=>{
 const api=await windows(page);await page.route('**/api/v1/client/components/opai',r=>r.fulfill({json:[{id:'watermark',name:'Watermark',settings:{enabled:true,zIndex:0,alignment:{horizontalAlignment:'Center',horizontalOffset:0,verticalAlignment:'Top',verticalOffset:15}}},{id:'keystrokes',name:'Keystrokes',settings:{enabled:true,zIndex:0,alignment:{horizontalAlignment:'Left',horizontalOffset:15,verticalAlignment:'Bottom',verticalOffset:15}}}]}));await page.goto('/#/hud?static&preview');await page.evaluate(()=>document.fonts.ready);await expect(page.locator('.island')).toHaveAttribute('data-motion-active','false');
 await page.evaluate(()=>{(window as any).__frameRequests=0;window.requestAnimationFrame=()=>{(window as any).__frameRequests++;return 123456;};});
 for(const key of ['w','a','s','d','space'])api.emit('key',{key:`key.keyboard.${key}`,action:1});for(const button of [0,1])api.emit('mouseButton',{button,action:1,screen:null});api.emit('moduleToggle',{moduleName:'Flight',enabled:true});await page.waitForTimeout(150);
 const frames=await page.evaluate(()=>(window as any).__frameRequests);expect(frames).toBeGreaterThan(1);expect(frames).toBeLessThan(12);expect(await page.locator('.key-wave').evaluateAll(ns=>ns.filter(n=>parseFloat(getComputedStyle(n).opacity)>0).length)).toBe(7);
 for(const key of ['w','a','s','d','space'])api.emit('key',{key:`key.keyboard.${key}`,action:0});for(const button of [0,1])api.emit('mouseButton',{button,action:0,screen:null});await expect(page.locator('.notice-row')).toHaveCount(0);await expect(page.locator('.island')).toHaveAttribute('data-motion-active','false');await expect.poll(()=>page.locator('.key-wave').evaluateAll(ns=>ns.every(n=>parseFloat(getComputedStyle(n).opacity)===0))).toBe(true);await page.waitForTimeout(500);const settled=await page.evaluate(()=>(window as any).__frameRequests);await page.waitForTimeout(150);expect(await page.evaluate(()=>(window as any).__frameRequests)).toBe(settled);expect(api.errors).toEqual([]);
});
