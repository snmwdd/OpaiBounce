import {test, expect, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {setup} from './fixtures';

async function antiCheat(page: Page) {
    const api = await setup(page);
    api.modules.push({
        ...api.modules[0], name:'Anti-cheat', category:'Misc', enabled:false,
        description:'Checks nearby players.', aliases:[],
    });
    // Captured from the real native groups with LiquidBounce's interop Gson.
    let saved = JSON.parse(readFileSync('tests/fixtures/anti-cheat-native.json','utf8'));
    const writes: typeof saved[] = [];
    await page.route('**/api/v1/client/modules/settings?name=Anti-cheat', async route => {
        if (route.request().method() === 'PUT') {
            saved = route.request().postDataJSON();
            writes.push(saved);
        }
        await route.fulfill({json:saved});
    });
    await page.goto('/#/clickgui?static&preview');
    const module = page.locator('.module').filter({has:page.locator('.module-label').filter({hasText:/^Anti-cheat$/})});
    await module.locator('.name').first().click({button:'right'});
    await expect(module.locator('.settings')).toBeVisible();
    return {...api,module,writes,get saved(){return saved;}};
}

test('all Anti-cheat checks have an expandable switch and readable parameter labels', async ({page}) => {
    const api = await antiCheat(page);
    await expect(api.module.locator('.group-head')).toHaveCount(19);
    await expect(api.module.getByRole('checkbox',{name:'Auto Throw',exact:true})).toBeChecked();
    await expect(api.module.getByRole('checkbox',{name:'Auto Bow',exact:true})).toBeChecked();
    await expect(api.module.locator('input[type="range"]:visible')).toHaveCount(2);
    await expect(api.module.getByRole('spinbutton',{name:'Lock Time (s) value',exact:true})).not.toBeVisible();
    await api.module.getByRole('button',{name:'Expand Auto Throw',exact:true}).click();
    const lock = api.module.getByRole('spinbutton',{name:'Lock Time (s) value',exact:true});
    await expect(lock).toBeVisible();
    await expect(lock).toHaveValue('0.6');
    await expect(api.module.getByRole('spinbutton',{name:'Aim Angle value',exact:true}).last()).toBeVisible();
    expect(api.errors).toEqual([]);
});

test('native check groups animate their parameter section in both directions', async ({page}) => {
    const api = await antiCheat(page);
    const group = api.module.locator('[data-setting="Auto Block"]').first();
    const button = group.getByRole('button',{name:'Expand Auto Block',exact:true});
    const reveal = group.locator(':scope > .reveal');
    await expect(reveal).toHaveCSS('height','0px');
    await button.click();
    await expect(reveal).toHaveAttribute('data-motion-active','true');
    await expect(reveal).toHaveAttribute('data-motion-active','false');
    expect((await reveal.boundingBox())!.height).toBeGreaterThan(100);
    await button.click();
    await expect(reveal).toHaveAttribute('data-motion-active','true');
    await expect(reveal).toHaveCSS('height','0px');
    expect(api.errors).toEqual([]);
});

test('nested Anti-cheat edits persist native groups and keep every other check unchanged', async ({page}) => {
    const api = await antiCheat(page);
    const before = structuredClone(api.saved);
    await api.module.getByRole('button',{name:'Expand Auto Throw',exact:true}).click();
    const group = api.module.locator('[data-setting="Auto Throw"]').first();
    const window = group.getByRole('spinbutton',{name:'Time Window (s) value',exact:true});
    await window.fill('3.5');
    await window.press('Tab');
    await expect.poll(() => api.saved.value.find((setting:any)=>setting.name==='Auto Throw')?.value.find((setting:any)=>setting.name==='Time Window (s)')?.value).toBe(3.5);
    await api.module.getByRole('checkbox',{name:'Auto Throw',exact:true}).uncheck();
    await expect.poll(() => api.saved.value.find((setting:any)=>setting.name==='Auto Throw')?.value.find((setting:any)=>setting.name==='Enabled')?.value).toBe(false);
    expect(api.saved.value.filter((setting:any)=>setting.name!=='Auto Throw'))
        .toEqual(before.value.filter((setting:any)=>setting.name!=='Auto Throw'));
    expect(api.saved.value.filter((setting:any)=>setting.valueType==='TOGGLEABLE')).toHaveLength(19);
    expect(api.saved.value.some((setting:any)=>setting.name.includes('Settings'))).toBe(false);
    await page.reload();
    await api.module.getByRole('button',{name:'Expand Auto Throw',exact:true}).click();
    await expect(window).toHaveValue('3.5');
    await expect(api.module.getByRole('checkbox',{name:'Auto Throw',exact:true})).not.toBeChecked();
    expect(api.errors).toEqual([]);
});

test('Cheater VL saves the direct threshold and per-check VL stays independently editable', async ({page}) => {
    const api = await antiCheat(page);
    const threshold = api.module.getByRole('spinbutton',{name:'Cheater VL value',exact:true});
    await threshold.fill('20');
    await threshold.press('Tab');
    await expect.poll(() => api.saved.value.find((setting:any)=>setting.name==='AlertVL')?.value).toBe(20);
    await api.module.getByRole('button',{name:'Expand Telly Scaffold',exact:true}).click();
    const group = api.module.locator('[data-setting="Telly Scaffold"]').first();
    const vl = group.getByRole('spinbutton',{name:'VL per Flag value',exact:true});
    await vl.fill('2');
    await vl.press('Tab');
    await expect.poll(() => api.saved.value.find((setting:any)=>setting.name==='Telly Scaffold')?.value.find((setting:any)=>setting.name==='VL per Flag')?.value).toBe(2);
    expect(api.errors).toEqual([]);
});

test('Reset VL reveals its interval only while enabled and both settings persist', async ({page}) => {
    const api = await antiCheat(page);
    const toggle = api.module.getByRole('checkbox',{name:'Reset VL',exact:true});
    const interval = api.module.getByRole('spinbutton',{name:'Reset Interval (s) value',exact:true});
    await expect(toggle).not.toBeChecked();
    await expect(interval).not.toBeVisible();
    await toggle.check();
    await expect(interval).toHaveValue('30');
    await interval.fill('60');
    await interval.press('Tab');
    await expect.poll(() => api.saved.value.find((setting:any)=>setting.name==='Reset VL')?.value.find((setting:any)=>setting.name==='Reset Interval (s)')?.value).toBe(60);
    await page.reload();
    await expect(toggle).toBeChecked();
    await expect(interval).toHaveValue('60');
    await toggle.uncheck();
    await expect(interval).not.toBeVisible();
    expect(api.saved.value.find((setting:any)=>setting.name==='Reset VL')?.value.find((setting:any)=>setting.name==='Reset Interval (s)')?.value).toBe(60);
    expect(api.errors).toEqual([]);
});
