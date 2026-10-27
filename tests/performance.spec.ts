import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {setup} from './fixtures';

test('animation pipeline measurements',async({page})=>{
    test.setTimeout(60000);
    const api=await setup(page);await page.addInitScript(()=>Math.random=()=>1);
    const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
    const results:Record<string,unknown>={};
    async function sample(name:string,run:()=>Promise<void>){
        const before=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
        await page.evaluate(()=>{const w=window as any;w.__samples=[];w.__collect=true;let last=0;function draw(t:number){if(last)w.__samples.push(t-last);last=t;if(w.__collect)requestAnimationFrame(draw);}requestAnimationFrame(draw);});
        await run();
        const after=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
        const frames=await page.evaluate(()=>{const w=window as any;w.__collect=false;return w.__samples as number[];});
        const metrics:Record<string,number>={};
        for(const key of ['LayoutCount','RecalcStyleCount','LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration'])metrics[key]=Number((after[key]-before[key]).toFixed(6));
        frames.sort((a,b)=>a-b);results[name]={...metrics,rafSamples:frames.length,rafMedianMs:frames[Math.floor(frames.length*.5)],rafP95Ms:frames[Math.floor(frames.length*.95)],gapsOver25ms:frames.filter(x=>x>25).length};
    }
    await page.goto('/#/title?static&preview');await page.evaluate(()=>document.fonts.ready);await expect(page.locator('.logo-static')).toHaveAttribute('data-collided','true');
    await sample('menuRoundTrips',async()=>{for(let i=0;i<2;i++){await page.getByRole('button',{name:'Multi player',exact:true}).click();await expect(page.locator('.opai-list')).toBeVisible();await page.waitForTimeout(850);await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.locator('.title-screen')).toBeVisible();await page.waitForTimeout(900);}});
    await page.goto('/#/clickgui?static&preview');await expect(page.locator('.panel')).toHaveCount(5);await page.waitForTimeout(500);
    await sample('clickGuiReopen',async()=>{for(let i=0;i<4;i++){api.emit('virtualScreen',{action:'open',screenName:'clickgui'});await page.waitForTimeout(360);}});
    const name=page.locator('.panel').first().locator('.module .name').first();
    await sample('moduleExpandCollapse',async()=>{for(let i=0;i<3;i++){await name.click({button:'right'});await page.waitForTimeout(320);await name.click({button:'right'});await page.waitForTimeout(320);}});
    await page.goto('/#/hud?static&preview');await expect(page.locator('.island')).toHaveAttribute('data-motion-active','false');
    await sample('islandToggleBurst',async()=>{for(let i=0;i<6;i++){api.emit('moduleToggle',{moduleName:'Flight',enabled:i%2===0});await page.waitForTimeout(120);}await page.waitForTimeout(2000);});
    const label=process.env.OPAI_PROFILE_LABEL??'current';
    fs.writeFileSync(`reports/performance-${label}.json`,JSON.stringify({label,environment:'Headless Chrome + isolated API fixture, 2000x1100; not native game CEF or a 120 FPS certification',results},null,2)+'\n');
    console.log(JSON.stringify(results));expect(api.errors).toEqual([]);await cdp.detach();
});
