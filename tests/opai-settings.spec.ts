import {expect, test, type Page} from '@playwright/test';
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
    await page.getByRole('checkbox', {name: 'Enable Shadows'}).uncheck();
    await expect(page.locator('html')).toHaveAttribute('data-opai-shadows', 'off');
    await page.getByRole('checkbox', {name: 'Enable Blur'}).uncheck();
    await expect(page.locator('html')).toHaveAttribute('data-opai-blur', 'off');
    const writes = api.requests.filter(request => request.name === 'HUD' && request.method === 'PUT');
    expect(writes.at(-1)?.body.value[0].value[0].value).toBe(false);
    await page.getByRole('button', {name: 'Dynamic Island Style', exact: true}).click();
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
    await page.getByRole('checkbox', {name:'Enable Shadows'}).uncheck();
    await expect.poll(() => JSON.parse(shared['opai.preferences'])).toMatchObject({shadows:false,islandStyle:'old'});
    expect(JSON.parse(shared['opai.preferences'])).not.toHaveProperty('transparentHud');
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
    await page.getByRole('checkbox', {name: 'Load Key Binds with Configurations'}).check();
    await expect(page.getByRole('checkbox', {name: 'Load Key Binds with Configurations'})).toBeEnabled();
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
    await page.getByRole('checkbox', {name: 'Show Click GUI Search'}).uncheck();
    await expect(trigger).toHaveCount(0);
    await expect.poll(() => JSON.parse(shared['opai.preferences']).search).toBe(false);
    await page.reload();
    await expect(page.locator('.panel')).toHaveCount(5);
    await expect(trigger).toHaveCount(0);
    expect(api.errors).toEqual([]);
});
