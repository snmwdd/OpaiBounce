import {expect, test, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {setup} from './fixtures';

async function openOpai(page: Page) {
    await page.getByRole('button', {name: 'Configurations', exact: true}).click();
    await page.getByRole('button', {name: 'Configuration settings', exact: true}).click();
    await page.getByRole('button', {name: 'Opai', exact: true}).click();
}

test('a native theme without the script requires the Releases prompt until the heartbeat returns', async ({page}) => {
    const shared: Record<string,string> = {};
    await setup(page,false,shared);
    await page.goto('/#/title?static');
    const prompt = page.getByRole('dialog',{name:'缺少 OpaiBounce 脚本'});
    await expect(prompt).toBeVisible({timeout:6500});
    await expect(prompt.getByRole('link')).toHaveAttribute('href','https://github.com/snmwdd/OpaiBounce/releases');
    await page.keyboard.press('Escape');
    await expect(prompt).toBeVisible();
    shared['opai.bridge.snapshot']=JSON.stringify({protocol:1,version:'1.9.0',at:Date.now(),connected:true,capabilities:{preview:true}});
    await expect(prompt).toHaveCount(0);
});

test('the missing-script prompt copies the address and opens Releases without a popup', async ({page,context}) => {
    const releases = 'https://github.com/snmwdd/OpaiBounce/releases';
    await context.grantPermissions(['clipboard-read','clipboard-write']);
    await page.route(releases,route=>route.fulfill({contentType:'text/plain',body:'Releases'}));
    await setup(page);
    await page.goto('/#/title?static');
    const prompt = page.getByRole('dialog',{name:'缺少 OpaiBounce 脚本'});
    await expect(prompt).toBeVisible({timeout:6500});
    await prompt.getByRole('button',{name:'复制链接'}).click();
    await expect(prompt.getByRole('status')).toHaveText('已复制下载链接');
    expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(releases);

    await page.evaluate(() => {
        Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true});
        document.execCommand=()=>false;
    });
    await prompt.getByRole('button',{name:'复制链接'}).click();
    await expect(prompt.getByRole('status')).toContainText('链接已选中');
    const address = prompt.getByRole('textbox',{name:'脚本下载链接'});
    expect(await address.evaluate((input:HTMLInputElement)=>input.value.slice(input.selectionStart ?? 0,input.selectionEnd ?? 0))).toBe(releases);

    await prompt.getByRole('link').click();
    await expect(page).toHaveURL(releases);
    expect(context.pages()).toHaveLength(1);
});

test('Opai settings persist and Old island shows the current username and independent Ping', async ({page}) => {
    const shared: Record<string, string> = {};
    const api = await setup(page, false, shared);
    await page.goto('/#/clickgui?static&preview');
    await openOpai(page);
    await page.getByRole('checkbox', {name: 'Shadows'}).uncheck();
    await expect(page.locator('html')).toHaveAttribute('data-opai-shadows', 'off');
    await page.getByRole('checkbox', {name: 'Blur'}).uncheck();
    await expect(page.locator('html')).toHaveAttribute('data-opai-blur', 'off');
    const writes = api.requests.filter(request => request.name === 'HUD' && request.method === 'PUT');
    expect(writes.at(-1)?.body.value[0].value[0].value).toBe(false);
    await page.getByRole('button', {name: 'Dynamic Island', exact: true}).click();
    await page.getByRole('button', {name: 'Old', exact: true}).click();
    await expect.poll(() => JSON.parse(shared['opai.preferences']).islandStyle).toBe('old');

    const snapshot = {
        protocol: 1, version: '1.6.0', at: Date.now(), connected: true, inWorld: true,
        serverAddress: 'play.example.org', ping: 1,
        capabilities: {serverInfo: true, preview: true, nametags: true}, errors: [],
    };
    shared['opai.bridge.snapshot'] = JSON.stringify(snapshot);
    await page.goto('/#/hud?static&preview');
    await page.reload();
    const username = page.locator('.idle-content .username');
    await expect(username).toHaveText('滚木');
    api.emit('session', {session:{username:'CurrentPlayer'}});
    await expect(username).toHaveText('CurrentPlayer');
    await expect(page.locator('.island .ping')).toHaveText('—');
    await expect(page.locator('.island')).toHaveCSS('box-shadow', 'none');
    shared['opai.bridge.snapshot'] = JSON.stringify({...snapshot, at: Date.now(), ping: 32.7, pingSource: 'icmp'});
    await expect(page.locator('.island .ping')).toHaveText('33ms');
    await expect(page.locator('.island .ping')).toHaveCSS('font-variant-numeric','proportional-nums');
    const island = page.locator('.hud .island');
    const logo = island.locator('.idle-content .brand .opai-icon');
    await expect(logo).toHaveCSS('width', '18px');
    await expect(island).toHaveAttribute('data-motion-active', 'false');
    const insets = await island.evaluate(shell => {
        const bounds = shell.getBoundingClientRect();
        const logo = shell.querySelector('.brand .opai-icon')!.getBoundingClientRect();
        const content = shell.querySelector('.idle-content')!.getBoundingClientRect();
        const scale = bounds.width / parseFloat(getComputedStyle(shell).width);
        return {
            left: (logo.left - bounds.left) / scale,
            top: (logo.top - bounds.top) / scale,
            bottom: (bounds.bottom - logo.bottom) / scale,
            right: (bounds.right - content.right) / scale,
        };
    });
    expect(insets.top).toBeCloseTo(2.5, 1);
    expect(insets.left).toBeCloseTo(insets.top, 1);
    expect(insets.bottom).toBeCloseTo(insets.top, 1);
    expect(insets.right).toBeCloseTo(7.5, 0);
    await page.goto('/#/clickgui?static&preview');
    await openOpai(page);
    await page.getByRole('button', {name: 'Dynamic Island', exact: true}).click();
    await page.getByRole('button', {name: 'New', exact: true}).click();
    await expect.poll(() => JSON.parse(shared['opai.preferences']).islandStyle).toBe('new');
    await page.goto('/#/hud?static&preview');
    await expect(page.locator('.idle-content .brand .opai-icon')).toHaveCSS('width', '12px');
});

test('old HUD background preferences are ignored and removed on the next Opai settings save', async ({page}) => {
    const shared: Record<string, string> = {'opai.preferences': JSON.stringify({transparentHud:true,islandStyle:'old'})};
    await setup(page, false, shared);
    await page.goto('/#/hud?static&preview');
    const island = page.locator('.hud .island');
    await expect(island.locator('.idle-content')).toHaveClass(/legacy/);
    await expect(island).toHaveCSS('background-color','rgba(8, 8, 8, 0.69)');
    await page.goto('/#/clickgui?static&preview');
    await openOpai(page);
    await expect(page.getByRole('checkbox', {name:'是否开启hud透明'})).toHaveCount(0);
    await page.getByRole('checkbox', {name:'Shadows'}).uncheck();
    await expect.poll(() => JSON.parse(shared['opai.preferences'])).toMatchObject({shadows:false,islandStyle:'old'});
    expect(JSON.parse(shared['opai.preferences'])).not.toHaveProperty('transparentHud');
});

test('Target HUD style and dark gray backgrounds persist and apply to HUD panels', async ({page}) => {
    const shared: Record<string, string> = {};
    const api = await setup(page, false, shared);
    await page.goto('/#/clickgui?static&preview');
    await openOpai(page);
    await page.getByRole('button', {name: 'Target HUD', exact: true}).click();
    await page.getByRole('button', {name: 'Old', exact: true}).click();
    await expect.poll(() => JSON.parse(shared['opai.preferences'] ?? '{}').targetHudStyle).toBe('old');
    await page.getByRole('button', {name: 'HUD Background', exact: true}).click();
    await page.getByRole('button', {name: 'Dark Gray', exact: true}).click();
    await expect.poll(() => JSON.parse(shared['opai.preferences'] ?? '{}').hudBackground).toBe('solid');

    await page.goto('/#/hud?static&preview');
    await page.reload();
    await expect(page.locator('.hud .island')).toHaveCSS('background-color', 'rgb(36, 36, 36)');
    await expect(page.locator('.hud .session')).toHaveCSS('background-color', 'rgb(36, 36, 36)');
    api.emit('targetChange', {target:{username:'Target', uuid:'target', actualHealth:20, maxHealth:20}});
    const target = page.locator('.targethud');
    await expect(target.getByLabel('Target status')).toBeVisible();
    await expect(target).toHaveCSS('width', '130px');
    await expect(target).toHaveCSS('border-radius', '4px');
    shared['opai.bridge.snapshot'] = JSON.stringify({
        protocol:1, connected:true, inWorld:true, at:Date.now(), capabilities:{preview:true},
        combatTarget:{uuid:'target', health:20, grounded:true, visible:false, age:418, hurtTime:0, lastHitAt:0},
    });
    await expect(target.getByLabel('Target status')).toContainText('G: true | CV: false');
    await expect(target.getByLabel('Target status')).toContainText('TE: 418 | HURT: 0');
    await expect(target).toHaveCSS('background-color', 'rgb(36, 36, 36)');
    await expect(target).toHaveCSS('backdrop-filter', 'none');
    await expect(target.getByLabel('Target armor')).toHaveCount(0);
    expect(api.errors).toEqual([]);
});

test('the new Target HUD shows armor and only a matching hit flashes the portrait', async ({page}) => {
    const shared: Record<string, string> = {};
    const snapshot = (combatTarget: object | null) => {
        shared['opai.bridge.snapshot'] = JSON.stringify({
            protocol:1, connected:true, inWorld:true, at:Date.now(), capabilities:{preview:true}, combatTarget,
        });
    };
    snapshot(null);
    const api = await setup(page, false, shared);
    await page.route('**/api/v1/client/resource/itemTexture?*', route =>
        route.fulfill({contentType:'image/png', body:readFileSync('tests/fixtures/items/diamond_helmet.png')}));
    await page.addInitScript(() => {
        const animate = Element.prototype.animate;
        const hits: number[] = [];
        Object.assign(window, {targetHudHits:hits});
        Element.prototype.animate = function (...args) {
            if (this.classList.contains('hit-tint')) hits.push(Date.now());
            return animate.apply(this, args);
        };
    });
    await page.goto('/#/hud?static&preview');
    await expect(page.locator('.island')).toBeVisible();
    const item = (id: string, count = 1) => ({identifier:'minecraft:' + id, count});
    const target = {
        username:'Target', uuid:'target', actualHealth:20, maxHealth:20,
        armorItems:[item('diamond_boots'), item('air', 0), item('diamond_chestplate'), item('diamond_helmet')],
    };
    const hud = page.locator('.targethud');
    api.emit('targetChange', {target});
    await expect(hud).toHaveCSS('width', '122px');
    await expect(hud).toHaveCSS('border-radius', '6px');
    const armor = hud.getByLabel('Target armor').locator('img');
    await expect(armor).toHaveCount(3);
    await expect(armor.first()).toHaveAttribute('alt', 'diamond helmet');
    await expect(armor.last()).toHaveAttribute('alt', 'diamond boots');
    expect(await armor.first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    const sample = {uuid:'other',health:12,grounded:true,visible:true,age:418,hurtTime:10,lastHitAt:Date.now()};
    snapshot(sample);
    await expect.poll(() => page.evaluate(() => (window as any).OpaiTheme.getState()?.combatTarget?.uuid)).toBe('other');
    const hits = () => page.evaluate(() => (window as any).targetHudHits.length);
    expect(await hits()).toBe(0);
    api.emit('targetChange', {target});
    snapshot({...sample, uuid:'target', lastHitAt:Date.now()});
    await expect.poll(hits).toBe(1);
    await expect(hud.locator('.name')).toHaveText('Target 12');
    await expect(hud.locator('.hit-tint')).toHaveCSS('opacity', '0', {timeout:900});
    expect(await hits()).toBe(1);
    expect(api.errors).toEqual([]);
});

test('profiles preserve the current key until restoring saved key binds is enabled', async ({page}) => {
    const bind = (letter: string) => ({boundKey: 'key.keyboard.' + letter, action: 'Toggle', modifiers: []});
    const saved = {
        name: 'Saved key', created: 'now', modules: [{
            name: 'AimAssist', enabled: true,
            settings: {name: 'AimAssist', valueType: 'CONFIGURABLE', value: [
                {name: 'Range', valueType: 'FLOAT', value: 4},
                {name: 'Bind', valueType: 'BIND', value: bind('r')},
            ]},
        }],
    };
    const api = await setup(page, false, {'opai.profiles': JSON.stringify([saved])});
    const aim = api.modules.find(module => module.name === 'AimAssist')!;
    aim.keyBind = {...aim.keyBind, boundKey: 'key.keyboard.k'};
    await page.goto('/#/clickgui?static&preview');
    await page.getByRole('button', {name: 'Configurations', exact: true}).click();
    await page.getByRole('button', {name: 'Saved key.json'}).click();
    await page.getByRole('button', {name: 'Load', exact: true}).click();
    await expect(page.getByRole('status')).toHaveText('Loaded');
    expect(aim.keyBind.boundKey).toBe('key.keyboard.k');
    expect(api.requests.find(request => request.name === 'AimAssist' && request.method === 'PUT')?.body.value)
        .toEqual([{name: 'Range', valueType: 'FLOAT', value: 4}]);

    await page.getByRole('button', {name: 'Configuration settings', exact: true}).click();
    await page.getByRole('button', {name: 'Opai', exact: true}).click();
    await page.getByRole('checkbox', {name: 'Restore Keybinds'}).check();
    await expect(page.getByRole('checkbox', {name: 'Restore Keybinds'})).toBeEnabled();
    await page.getByRole('button', {name: 'Back to configurations', exact: true}).click();
    await page.getByRole('button', {name: 'Back to configurations', exact: true}).click();
    await page.getByRole('button', {name: 'Load', exact: true}).click();
    await expect(page.getByRole('status')).toHaveText('Loaded');
    expect(aim.keyBind.boundKey).toBe('key.keyboard.r');
});

test('a failed profile save is not added to the list and can be retried', async ({page}) => {
    await setup(page);
    let rejectWrite = true;
    await page.route('**/api/v1/client/localStorage', route => {
        if (rejectWrite && route.request().method() === 'PUT' && route.request().postDataJSON()?.key === 'opai.profiles') {
            return route.fulfill({status: 503, json: {error: 'Storage unavailable'}});
        }
        return route.fallback();
    });
    await page.goto('/#/clickgui?static&preview');
    await page.getByRole('button', {name: 'Configurations', exact: true}).click();
    await page.getByRole('button', {name: 'Add configuration', exact: true}).click();
    await page.getByPlaceholder('Configuration name').fill('Retryable');
    await page.getByRole('button', {name: 'Create', exact: true}).click();
    const panel = page.getByLabel('Configurations panel');
    await expect(panel.getByRole('status')).toContainText('503');
    await expect(panel.getByRole('button', {name: 'Retryable.json'})).toHaveCount(0);
    rejectWrite = false;
    await panel.getByRole('button', {name: 'Create', exact: true}).click();
    await expect(panel.getByRole('button', {name: 'Retryable.json'})).toBeVisible();
    await page.reload();
    await page.getByRole('button', {name: 'Configurations', exact: true}).click();
    await expect(page.getByRole('button', {name: 'Retryable.json'})).toBeVisible();
});

test('a live accent update reaches enabled module rows and the title menu', async ({page}) => {
    const api = await setup(page);
    await page.goto('/#/clickgui?static&preview');
    const enabled = page.locator('.module .name.enabled').first();
    await expect(enabled).toBeVisible();
    api.emit('themeColorChange', {themeId: 'opai', name: 'Accent', value: 0xff19a3ff | 0});
    await expect(enabled).toHaveCSS('background-color', 'color(srgb 0.0857843 0.559314 0.875)');
    await page.evaluate(() => {location.hash = '#/title?static&preview';});
    await expect(page.getByRole('button', {name: 'Single player', exact: true})).toHaveCSS('color', 'rgb(25, 163, 255)');
});

test('the HUD notification icon is centered beside wrapped text', async ({page}) => {
    const api = await setup(page);
    await page.route('**/api/v1/client/components/opai', route => route.fulfill({json: [{
        id: 'notifications', name: 'Notifications',
        settings: {enabled: true, severities: ['INFO'], alignment: {
            horizontalAlignment: 'Left', horizontalOffset: 40,
            verticalAlignment: 'Top', verticalOffset: 40,
        }},
    }]}));
    await page.goto('/#/hud?static&preview');
    await expect(page.locator('.notifications')).toBeAttached();
    const card = page.locator('.notification');
    for (const message of ['Short message', 'This notification wraps across multiple lines so the icon stays vertically centered beside the entire text block.']) {
        api.emit('notification', {title: 'Notifier', message, severity: 'INFO'});
        const active = card.filter({hasText: message});
        await expect(active).toBeVisible();
        const offset = await active.evaluate(element => {
            const card = element.getBoundingClientRect();
            const icon = element.querySelector('.icon')!.getBoundingClientRect();
            return Math.abs(card.top + card.height / 2 - icon.top - icon.height / 2);
        });
        expect(offset).toBeLessThan(1);
    }
});

test('range endpoint typing commits ordered float and integer values to the host', async ({page}) => {
    const api = await setup(page);
    let rangeSettings = [
        {name: 'FloatWindow', valueType: 'FLOAT_RANGE', value: {from: .4, to: .6}, range: {from: 0, to: 2}},
        {name: 'IntWindow', valueType: 'INT_RANGE', value: {from: 3, to: 5}, range: {from: 0, to: 20}},
    ];
    await page.route('**/api/v1/client/modules/settings?name=AimAssist', async route => {
        if (route.request().method() === 'PUT') {
            rangeSettings = route.request().postDataJSON().value;
            await route.fulfill({status: 204});
        } else {
            await route.fulfill({json: {name: 'AimAssist', valueType: 'CONFIGURABLE', value: rangeSettings}});
        }
    });
    await page.goto('/#/clickgui?static&preview');
    await page.locator('.module .name').filter({hasText: 'Aim Assist'}).click({button: 'right'});
    const floatMinimum = page.getByRole('spinbutton', {name: 'Float Window minimum value'});
    const floatMaximum = page.getByRole('spinbutton', {name: 'Float Window maximum value'});
    await floatMinimum.fill('0.53');
    await floatMinimum.press('Enter');
    await expect.poll(() => rangeSettings[0].value).toEqual({from: .53, to: .6});
    await floatMaximum.fill('0.2');
    await floatMaximum.press('Tab');
    await expect.poll(() => rangeSettings[0].value).toEqual({from: .2, to: .2});
    await expect(floatMinimum).toHaveValue('0.2');
    await expect(page.getByRole('slider', {name: 'Float Window to'})).toHaveValue('0.2');

    const intMaximum = page.getByRole('spinbutton', {name: 'Int Window maximum value'});
    await intMaximum.fill('12');
    await intMaximum.press('Enter');
    await expect.poll(() => rangeSettings[1].value).toEqual({from: 3, to: 12});
    await intMaximum.fill('');
    await intMaximum.press('Enter');
    await expect(intMaximum).toHaveValue('12');
    expect(rangeSettings[1].value).toEqual({from: 3, to: 12});
    expect(api.errors).toEqual([]);
});

test('the ClickGUI search capsule expands upward, locates a module and can be hidden', async ({page}) => {
    const shared: Record<string, string> = {};
    const api = await setup(page, false, shared);
    api.modules.find(module => module.name === 'AimAssist')!.aliases = ['aim helper'];
    await page.goto('/#/clickgui?static&preview');
    const trigger = page.getByRole('button', {name: 'Open module search'});
    const idle = await trigger.boundingBox();
    expect(idle!.x).toBeLessThan(40);
    await trigger.click();
    const input = page.getByRole('combobox', {name: 'Search modules'});
    await expect(input).toBeFocused();
    await input.fill(' AIM  HELPER ');
    const results = page.getByRole('listbox', {name: 'Matching modules'});
    await expect(results.getByRole('option')).toHaveCount(1);
    await expect.poll(async () => (await results.boundingBox())!.y).toBeLessThan(idle!.y);
    await expect(results.locator('..').locator('..')).toHaveAttribute('data-motion-active', 'false');
    await page.screenshot({path: 'reports/opai-module-search.png'});
    await input.press('Enter');
    await expect(input).toHaveCount(0);
    await expect(page.locator('.module .name.highlight')).toContainText('Aim Assist');
    expect(api.requests.filter(request => request.path === '/client/modules/toggle')).toHaveLength(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await input.fill('module that does not exist');
    await expect(page.getByRole('search', {name: 'ClickGUI module search'}).getByRole('status')).toHaveText('No matching modules');
    await input.press('Escape');
    await expect(input).toHaveCount(0);

    await openOpai(page);
    await page.getByLabel('Opai settings').screenshot({path: 'reports/opai-native-settings.png'});
    await page.getByRole('checkbox', {name: 'ClickGUI Search'}).uncheck();
    await expect(trigger).toHaveCount(0);
    await expect.poll(() => JSON.parse(shared['opai.preferences']).search).toBe(false);
    await page.reload();
    await expect(page.locator('.panel')).toHaveCount(5);
    await expect(trigger).toHaveCount(0);
    expect(api.errors).toEqual([]);
});

test('IDK Target HUD persists, uses a square portrait and a centered percentage bar without armor text', async ({page}) => {
    const shared: Record<string,string> = {};
    const api = await setup(page,false,shared);
    await page.goto('/#/clickgui?static&preview');await openOpai(page);
    await page.getByRole('button',{name:'Target HUD',exact:true}).click();
    await page.getByRole('button',{name:'IDK',exact:true}).click();
    await expect.poll(()=>JSON.parse(shared['opai.preferences'] ?? '{}').targetHudStyle).toBe('idk');
    await page.goto('/#/hud?static&preview');await page.reload();
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('.hud .island')).toBeVisible();
    const target={username:'071106153769',uuid:'idk-target',actualHealth:16.12,maxHealth:20,armorItems:[{identifier:'minecraft:diamond_helmet',count:1}]};
    api.emit('targetChange',{target});
    const hud=page.locator('.targethud');
    await expect(hud).toHaveAttribute('data-style','idk');
    await expect(hud).toHaveCSS('width','136px');await expect(hud).toHaveCSS('height','40px');
    await expect(hud.locator('.head')).toHaveCSS('width','34px');await expect(hud.locator('.head')).toHaveCSS('border-radius','0px');
    await expect(hud.locator('.name').getByRole('img',{name:target.username,exact:true})).toBeVisible();
    await expect(hud.getByRole('progressbar',{name:'Target health'})).toHaveAttribute('aria-valuenow','80.6');
    await expect(hud.locator('.percentage').getByRole('img',{name:'80.6%',exact:true})).toBeVisible();
    await expect(hud.getByLabel('Target armor')).toHaveCount(0);await expect(hud.getByLabel('Target status')).toHaveCount(0);
    const bar=await hud.locator('.track').boundingBox(), portrait=await hud.locator('.portrait').boundingBox();
    expect(bar!.x).toBeGreaterThan(portrait!.x+portrait!.width);
    await hud.screenshot({path:'reports/idk-targethud.png'});
    api.emit('targetChange',{target:{...target,username:'ABCDEFGHIJKLMNOP'}});
    const longName=hud.locator('.name');
    await expect(longName.getByRole('img',{name:'ABCDEFGHIJKLMNOP',exact:true})).toBeVisible();
    expect((await longName.locator('svg').boundingBox())!.width).toBeLessThanOrEqual((await longName.boundingBox())!.width);
    api.emit('targetChange',{target:{...target,actualHealth:-5}});
    await expect(hud.getByRole('progressbar')).toHaveAttribute('aria-valuenow','0');
    api.emit('targetChange',{target:{...target,actualHealth:100}});
    await expect(hud.getByRole('progressbar')).toHaveAttribute('aria-valuenow','100');
    expect(api.errors).toEqual([]);
});

test('Nametag and Bed distance sliders save independently and survive reload', async ({page}) => {
    const shared: Record<string,string> = {};
    const api = await setup(page,false,shared);
    await page.goto('/#/clickgui?static&preview');await openOpai(page);
    const names=page.getByRole('spinbutton',{name:'Nametag Distance value',exact:true});
    const beds=page.getByRole('spinbutton',{name:'Bed Distance value',exact:true});
    await expect(names).toHaveValue('128');await expect(beds).toHaveValue('128');
    await names.fill('48');await names.press('Tab');
    await expect.poll(()=>JSON.parse(shared['opai.preferences'] ?? '{}').nametagDistance).toBe(48);
    const slider=page.getByRole('slider',{name:'Bed Distance',exact:true});
    await slider.fill('72');await slider.dispatchEvent('change');
    await expect.poll(()=>JSON.parse(shared['opai.preferences'] ?? '{}').bedDistance).toBe(72);
    await page.reload();await openOpai(page);
    await expect(names).toHaveValue('48');await expect(beds).toHaveValue('72');
    await names.fill('999');await names.press('Tab');
    await expect.poll(()=>JSON.parse(shared['opai.preferences'] ?? '{}').nametagDistance).toBe(256);
    expect(JSON.parse(shared['opai.preferences'] ?? '{}').bedDistance).toBe(72);
    expect(api.errors).toEqual([]);
});
