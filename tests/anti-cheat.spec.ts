import {test, expect, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {setup} from './fixtures';

async function antiCheat(page: Page) {
    const api = await setup(page);
    api.modules.push({
        ...api.modules[0], name:'Anti-cheat', category:'Misc', enabled:false,
        description:'Checks nearby players.', aliases:[],
    });
    const script = readFileSync('script/OpaiBounceScript.js', 'utf8');
    const readObject = (name: string) => runInNewContext('(' + script.match(new RegExp('const ' + name + ' = (\\{[\\s\\S]*?\\n    \\});'))![1] + ')');
    const defaults = readObject('CHECK_DEFAULTS');
    const rules = readObject('CHECK_RULES');
    const value: any[] = [
        {name:'AlertVL',valueType:'INT',value:11,range:{from:1,to:1000}},
        {name:'FlagIntervalSeconds',valueType:'FLOAT',value:.75,range:{from:0,to:30}},
        {name:'VLReset',valueType:'BOOLEAN',value:false},
        {name:'VLResetSettingsIntervalSeconds',valueType:'INT',value:30,range:{from:5,to:600}},
    ];
    for (const [name, enabled] of Object.entries(defaults)) {
        value.push({name:['AimAssist','AutoClicker'].includes(name) ? name+'Detection' : name, valueType:'BOOLEAN', value:enabled});
    }
    for (const [check, fields] of Object.entries(rules)) {
        for (const [field, range] of Object.entries({...fields as object,FlagIntervalSeconds:[.75,0,30],VL:[1,1,10]})) {
            const [initial, min, max] = range as number[];
            value.push({name:check+'Settings'+field,valueType:'FLOAT',value:initial,range:{from:min,to:max}});
        }
    }
    let saved = {name:'Anti-cheat',valueType:'CONFIGURABLE',value};
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
    await expect(api.module.locator('.group-head')).toHaveCount(18);
    await expect(api.module.getByRole('checkbox',{name:'Auto Throw',exact:true})).toBeChecked();
    await expect(api.module.getByRole('checkbox',{name:'Auto Bow',exact:true})).toBeChecked();
    await expect(api.module.getByRole('spinbutton',{name:'Lock Time (s) value',exact:true})).not.toBeVisible();
    await api.module.getByRole('button',{name:'Expand Auto Throw',exact:true}).click();
    const lock = api.module.getByRole('spinbutton',{name:'Lock Time (s) value',exact:true});
    await expect(lock).toBeVisible();
    await expect(lock).toHaveValue('0.6');
    await expect(api.module.getByRole('spinbutton',{name:'Aim Angle value',exact:true}).last()).toBeVisible();
    expect(api.errors).toEqual([]);
});

test('nested Anti-cheat edits persist flat native keys and keep every other check unchanged', async ({page}) => {
    const api = await antiCheat(page);
    const before = structuredClone(api.saved);
    await api.module.getByRole('button',{name:'Expand Auto Throw',exact:true}).click();
    const group = api.module.locator('[data-setting="AutoThrow"]').first();
    const window = group.getByRole('spinbutton',{name:'Time Window (s) value',exact:true});
    await window.fill('3.5');
    await window.press('Tab');
    await expect.poll(() => api.saved.value.find(setting=>setting.name==='AutoThrowSettingsWindowSeconds')?.value).toBe(3.5);
    await api.module.getByRole('checkbox',{name:'Auto Throw',exact:true}).uncheck();
    await expect.poll(() => api.saved.value.find(setting=>setting.name==='AutoThrow')?.value).toBe(false);
    expect(api.saved.value.filter(setting=>!['AutoThrow','AutoThrowSettingsWindowSeconds'].includes(setting.name)))
        .toEqual(before.value.filter(setting=>!['AutoThrow','AutoThrowSettingsWindowSeconds'].includes(setting.name)));
    expect(api.saved.value.some(setting=>setting.valueType==='TOGGLEABLE')).toBe(false);
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
    await expect.poll(() => api.saved.value.find(setting=>setting.name==='AlertVL')?.value).toBe(20);
    await api.module.getByRole('button',{name:'Expand Telly Scaffold',exact:true}).click();
    const group = api.module.locator('[data-setting="TellyScaffold"]').first();
    const vl = group.getByRole('spinbutton',{name:'VL per Flag value',exact:true});
    await vl.fill('2');
    await vl.press('Tab');
    await expect.poll(() => api.saved.value.find(setting=>setting.name==='TellyScaffoldSettingsVL')?.value).toBe(2);
    expect(api.errors).toEqual([]);
});

test('Reset VL reveals its interval only while enabled and both settings persist', async ({page}) => {
    const api = await antiCheat(page);
    const toggle = api.module.getByRole('checkbox',{name:'Reset VL',exact:true});
    const interval = api.module.getByRole('spinbutton',{name:'Reset Interval (s) value',exact:true});
    await expect(toggle).not.toBeChecked();
    await expect(interval).toHaveCount(0);
    await toggle.check();
    await expect(interval).toHaveValue('30');
    await interval.fill('60');
    await interval.press('Tab');
    await expect.poll(() => api.saved.value.find(setting=>setting.name==='VLResetSettingsIntervalSeconds')?.value).toBe(60);
    await page.reload();
    await expect(toggle).toBeChecked();
    await expect(interval).toHaveValue('60');
    await toggle.uncheck();
    await expect(interval).toHaveCount(0);
    expect(api.saved.value.find(setting=>setting.name==='VLResetSettingsIntervalSeconds')?.value).toBe(60);
    expect(api.errors).toEqual([]);
});
