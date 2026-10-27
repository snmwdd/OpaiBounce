import {test,expect,type Page} from '@playwright/test';
import {setup} from './fixtures';
async function music(page:Page,base='/',windowDelay=0){
    const shared={'opai.bridge.music':JSON.stringify({protocol:1,version:'1.2.0',url:'http://127.0.0.1:61939',token:'fixture-token-for-music-tests'})};
    const api=await setup(page,false,shared);let state:any={provider:'',source:'netease',volume:.25,repeatOne:false,loggedIn:false,profile:'',loading:false,playing:false,position:2000,error:'',index:0,queueLength:0,track:null,widgets:{island:true,islandLyrics:true,info:true,lyrics:true,spectrum:true,translation:true},favoriteKeys:[]};
    if(windowDelay)await page.route('**/api/v1/client/window',async r=>{api.requests.push({path:'/client/window',method:'GET',body:null,name:null});await new Promise(done=>setTimeout(done,windowDelay));await r.fulfill({json:{width:2000,height:1100,scaledWidth:1000,scaledHeight:550,scaleFactor:2,guiScale:2}});});
    let nativeSettings:any={name:'TritiumMusic',valueType:'CONFIGURABLE',value:[{name:'Enabled',valueType:'BOOLEAN',value:false},...Object.entries({IslandMusic:'island',IslandLyrics:'islandLyrics',MusicInfo:'info',MusicLyrics:'lyrics',MusicSpectrum:'spectrum',Translation:'translation'}).map(([name,key])=>({name,valueType:'BOOLEAN',value:true,key})),{name:'LyricsMode',valueType:'CHOOSE',value:'HUD',choices:['HUD','Dango3D']}]};
    await page.route('**/api/v1/client/modules/settings?name=TritiumMusic',async r=>{if(r.request().method()==='PUT'){nativeSettings=r.request().postDataJSON();for(const v of nativeSettings.value){if(v.key)state.widgets[v.key]=v.value;if(v.name==='LyricsMode')state.lyricsMode=v.value;}}api.requests.push({path:'/client/modules/settings',method:r.request().method(),body:r.request().postDataJSON(),name:'TritiumMusic'});await r.fulfill({json:nativeSettings});});
    await page.route('**/api/v1/client/modules/toggle',async r=>{const b=r.request().postDataJSON();if(b.name!=='TritiumMusic'){await r.fallback();return;}api.emit('moduleToggle',{moduleName:'TritiumMusic',enabled:true});api.emit('moduleToggle',{moduleName:'TritiumMusic',enabled:false});await r.fulfill({json:{}});});
    const tracks=[1,2].map(id=>({id:String(id),name:'Fixture Song '+id,artists:['Fixture Artist'],album:'Fixture Album',provider:'gd',source:'netease',duration:180000,cover:''}));
    const requests:{path:string;body:any}[]=[];let quota=false,qrChecks=0;let spectrum=Array.from({length:32},(_,i)=>i/32);let favorites:any[]=[];
    await page.route('http://127.0.0.1:61939/**',async route=>{
        const req=route.request(),path=new URL(req.url()).pathname,headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'X-Opai-Music, Content-Type'};
        if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
        expect(req.headers()['x-opai-music']).toBe('fixture-token-for-music-tests');const body=req.postDataJSON();requests.push({path,body});let data:any=state;
        if(path==='/settings'){if(body.provider&&body.provider!==state.provider)state={...state,track:null,playing:false};state={...state,...body,widgets:{...state.widgets,...body.widgets}};data=state;}
        if(path==='/search'){if(quota){await route.fulfill({status:429,headers,json:{error:'GD音乐台暂时限流，请稍后重试。'}});return;}data=tracks.map(t=>({...t,provider:state.provider}));}
        if(path==='/play'){state={...state,track:body.tracks[body.index],playing:true,index:body.index,queueLength:body.tracks.length};data=state;}
        if(path==='/transport'){state={...state,playing:body.action==='pause'?false:body.action==='resume'?true:state.playing,position:body.position??state.position};if(body.action==='next')state.track=tracks[1];data=state;}
        if(path==='/favorites')data=favorites.filter(t=>t.provider===state.provider);
        if(path==='/favorite'){const key=(t:any)=>`${t.provider}:${t.source}:${t.id}`;favorites=favorites.filter(t=>key(t)!==key(body.track));if(body.liked)favorites.push(body.track);state={...state,favoriteKeys:favorites.map(key)};data=state;}
        if(path==='/spectrum')data={bands:spectrum,playing:state.playing};
        if(path==='/lyrics')data={lyric:'[00:00.00]Intro\n[00:01.00]Fixture lyric\n[00:03.00]Next lyric',tlyric:'[00:00.00]前奏\n[00:01.00]测试歌词'};
        if(path==='/qr/new')data={key:'fixture-key',url:'https://music.163.com/login?codekey=fixture-key'};
        if(path==='/qr/check'){qrChecks++;state={...state,loggedIn:true,profile:'Fixture User'};data={code:803};}
        if(path==='/playlists')data=[{id:7,name:'Fixture Playlist',trackCount:2}];
        if(path==='/playlist')data=tracks.map(t=>({...t,provider:'netease'}));
        if(path==='/logout'){state={...state,loggedIn:false,profile:'',track:null,playing:false};data=state;}
        await route.fulfill({headers,json:data});
    });
    await page.goto(`${base}#/clickgui?static&preview`);await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');await page.locator('.module .name').filter({hasText:'Tritium Music'}).click();
    return{...api,musicRequests:requests,get state(){return state;},setSpectrum:(v:number[])=>spectrum=v,get qrChecks(){return qrChecks;},quota:()=>quota=true,tracks};
}

test('first music opening chooses provider; GD search, playback, volume and repeat survive reopening',async({page})=>{
    const api=await music(page);await expect(page.getByText('选择音乐接入方式',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:/免 VIP 接入/}).click();await page.getByLabel('搜索歌曲').fill('test song');await page.getByRole('button',{name:'搜索',exact:true}).click();
    await expect(page.locator('.song')).toHaveCount(2);await page.getByRole('button',{name:'播放 Fixture Song 1',exact:true}).click();await expect(page.getByRole('button',{name:'暂停',exact:true})).toBeEnabled();await expect(page.locator('.lyric')).toContainText('Fixture lyric');
    await page.getByLabel('音乐音量').fill('65');await expect.poll(()=>api.state.volume).toBe(.65);await page.getByRole('button',{name:'单曲循环',exact:true}).click();await expect(page.getByRole('button',{name:'单曲循环',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect.poll(()=>api.requests.filter(r=>r.path==='/client/typing').at(-1)?.body.typing).toBe(true);
    await page.getByRole('button',{name:'关闭音乐面板',exact:true}).click();await expect(page.getByRole('dialog',{name:'Tritium Music player'})).toHaveCount(0);expect(api.state.playing).toBe(true);
    await page.locator('.module .name').filter({hasText:'Tritium Music'}).click();await expect(page.getByLabel('搜索歌曲')).toHaveValue('test song');await expect(page.locator('.song')).toHaveCount(2);await expect(page.getByLabel('音乐音量')).toHaveValue('65');await expect(page.getByRole('button',{name:'单曲循环',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.getByRole('button',{name:'暂停',exact:true}).click();await expect.poll(()=>api.state.playing).toBe(false);await page.getByRole('button',{name:'播放',exact:true}).click();await expect.poll(()=>api.state.playing).toBe(true);
    await expect(page.getByRole('button',{name:'搜索',exact:true})).toBeEnabled();await page.screenshot({path:'reports/music-player-1.12.2.png'});expect(api.errors).toEqual([]);
});

test('official QR login creates its QR locally, loads account playlists and can switch backends in settings',async({page})=>{
    const api=await music(page);await page.getByRole('button',{name:/官方网易云登录/}).click();const qr=page.getByAltText('网易云音乐登录二维码');await expect(qr).toHaveAttribute('src',/^data:image\/png;base64,/);await qr.screenshot({path:'reports/music-qr-fixture-1.12.2.png'});
    await expect(page.getByLabel('搜索歌曲')).toBeVisible();await expect.poll(()=>api.qrChecks).toBe(1);await page.getByRole('button',{name:'我的歌单',exact:true}).click();await page.locator('.results').getByRole('button',{name:/Fixture Playlist/}).click();await expect(page.locator('.song')).toHaveCount(2);
    await page.getByRole('button',{name:'音乐设置',exact:true}).click();await expect(page.getByText('网易云：Fixture User',{exact:true})).toBeVisible();await page.getByRole('button',{name:/免 VIP 接入/}).click();await expect(page.locator('.credits')).toContainText('GD音乐台 (music.gdstudio.xyz)');expect(api.state.provider).toBe('gd');expect(api.errors).toEqual([]);
});

test('music rate-limit errors remain recoverable and closed QR panels stop login polling',async({page})=>{
    const api=await music(page);await page.getByRole('button',{name:/官方网易云登录/}).click();await expect(page.getByAltText('网易云音乐登录二维码')).toBeVisible();await page.getByRole('button',{name:'关闭音乐面板',exact:true}).click();await page.waitForTimeout(2100);expect(api.qrChecks).toBe(0);
    await page.locator('.module .name').filter({hasText:'Tritium Music'}).click();await page.getByRole('button',{name:'音乐设置',exact:true}).click();await page.getByRole('button',{name:/免 VIP 接入/}).click();api.quota();await page.getByLabel('搜索歌曲').fill('demo');await page.getByRole('button',{name:'搜索',exact:true}).click();await expect(page.getByRole('status')).toContainText('限流');await expect(page.getByRole('button',{name:'搜索',exact:true})).toBeEnabled();expect(api.errors).toEqual([]);
});

test('music island yields to module and scaffold notices and returns to now-playing afterwards',async({page})=>{
    const api=await music(page);await page.getByRole('button',{name:/免 VIP 接入/}).click();await page.getByLabel('搜索歌曲').fill('demo');await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByRole('button',{name:'播放 Fixture Song 1',exact:true}).click();
    await page.getByRole('button',{name:'关闭音乐面板',exact:true}).click();await page.goto('/#/hud?static&preview');await expect(page.locator('.music-island')).toBeVisible();await expect(page.locator('.music-island')).toContainText('Fixture lyric');await expect(page.locator('.island')).toHaveCSS('height','23px');await expect(page.locator('.music-island img')).toHaveCount(0);await expect(page.locator('.island')).toHaveAttribute('data-motion-active','false');await page.locator('.island').screenshot({path:'reports/music-island-1.12.2.png'});
    api.emit('moduleToggle',{moduleName:'Flight',enabled:true});await expect(page.locator('.notice-row')).toContainText('Flight');await expect(page.locator('.idle-content')).toHaveClass(/hidden/);await expect(page.locator('.notice-row')).toHaveCount(0);await expect(page.locator('.idle-content')).not.toHaveClass(/hidden/);
    api.emit('moduleToggle',{moduleName:'Scaffold',enabled:true});await expect(page.locator('.scaffold-content')).not.toHaveClass(/content-hidden/);await expect(page.locator('.idle-content')).toHaveClass(/hidden/);api.emit('moduleToggle',{moduleName:'Scaffold',enabled:false});await expect(page.locator('.idle-content')).not.toHaveClass(/hidden/);expect(api.errors).toEqual([]);
});

test('missing companion leaves all modules usable and explains how to install music support',async({page})=>{
    const api=await setup(page);await page.goto('/#/clickgui?static&preview');await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');await page.locator('.module .name').filter({hasText:'Tritium Music'}).click();await expect(page.getByText('音乐桥接尚未连接',{exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.music-panel')).toHaveCount(0);await page.locator('.module .name').first().click();await expect.poll(()=>api.requests.filter(r=>r.path==='/client/modules/toggle').length).toBe(2);expect(api.errors).toEqual([]);
});

test('installed theme loads the deferred QR encoder under the native /local/opai asset prefix',async({page})=>{
    const failures:string[]=[];page.on('response',r=>{if(r.status()>=400&&r.request().resourceType()==='script')failures.push(r.url());});
    await page.route('**/local/opai/**',async route=>{const u=new URL(route.request().url());u.pathname=u.pathname.replace('/local/opai','')||'/';await route.fulfill({response:await route.fetch({url:u.toString()})});});
    const api=await music(page,'/local/opai/');await page.getByRole('button',{name:/官方网易云登录/}).click();await expect(page.getByAltText('网易云音乐登录二维码')).toHaveAttribute('src',/^data:image\/png/);expect(failures).toEqual([]);expect(api.errors).toEqual([]);
});

test('late ClickGUI initialization cannot release music keyboard input protection',async({page})=>{
    const api=await music(page,'/',1800);await page.getByRole('button',{name:/免 VIP 接入/}).click();await page.getByLabel('搜索歌曲').fill('keep input protected');await page.getByRole('button',{name:'单曲循环',exact:true}).click();
    await page.waitForTimeout(2100);expect(api.requests.filter(r=>r.path==='/client/window').length).toBeGreaterThan(0);expect(api.requests.filter(r=>r.path==='/client/typing').at(-1)?.body.typing).toBe(true);expect(api.errors).toEqual([]);
});

test('large window player fills the viewport, uses SVG controls and persists local favorites',async({page})=>{
    await page.setViewportSize({width:3456,height:1900});const api=await music(page);await page.getByRole('button',{name:/免 VIP 接入/}).click();await page.getByLabel('搜索歌曲').fill('Fixture');await page.getByRole('button',{name:'搜索',exact:true}).click();
    const panel=(await page.locator('.music-panel').boundingBox())!;expect(panel.width).toBeGreaterThan(3300);expect(panel.height).toBeGreaterThan(1650);expect(panel.x).toBeGreaterThanOrEqual(0);expect(panel.x+panel.width).toBeLessThanOrEqual(3456);expect(panel.y+panel.height).toBeLessThanOrEqual(1900);
    const searchHeight=(await page.getByLabel('搜索歌曲').boundingBox())!.height;expect(searchHeight).toBeGreaterThan(36);
    for(const name of ['上一首','播放','下一首','单曲循环','音乐设置','关闭音乐面板'])await expect(page.getByRole('button',{name,exact:true}).locator('svg')).toHaveCount(1);
    await page.getByRole('button',{name:'收藏 Fixture Song 1',exact:true}).click();await expect(page.getByRole('button',{name:'取消收藏 Fixture Song 1',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'本地收藏',exact:true}).click();await expect(page.locator('.song')).toHaveCount(1);
    await page.getByRole('button',{name:'关闭音乐面板',exact:true}).click();await page.locator('.module .name').filter({hasText:'Tritium Music'}).click();await page.getByRole('button',{name:'本地收藏',exact:true}).click();await expect(page.locator('.song')).toHaveCount(1);await page.getByRole('button',{name:'取消收藏 Fixture Song 1',exact:true}).click();await expect(page.locator('.song')).toHaveCount(0);
    await page.getByRole('button',{name:'主页',exact:true}).click();await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByRole('button',{name:'播放 Fixture Song 1',exact:true}).click();await expect(page.locator('.now-playing')).toContainText('Fixture Song 1');await expect(page.locator('.song-row.active')).toHaveCSS('background-color','rgb(120, 73, 63)');await expect(page.getByRole('button',{name:'暂停',exact:true})).toBeEnabled();await expect(page.locator('.music-panel .opai-ripple')).toHaveCount(0);await page.screenshot({path:'reports/music-player-large-1.12.2.png'});expect(api.errors).toEqual([]);
});

test('module HUD settings independently control the island, card, lyrics and real spectrum polling',async({page})=>{
    const api=await music(page);await page.getByRole('button',{name:/免 VIP 接入/}).click();await page.getByLabel('搜索歌曲').fill('demo');await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByRole('button',{name:'播放 Fixture Song 1',exact:true}).click();await page.getByRole('button',{name:'关闭音乐面板',exact:true}).click();
    await page.locator('.module .name').filter({hasText:'Tritium Music'}).click({button:'right'});await page.getByLabel('Island Music',{exact:true}).uncheck();await expect.poll(()=>api.state.widgets.island).toBe(false);
    const fs=await import('node:fs');await page.route('**/api/v1/client/components/opai',r=>r.fulfill({json:['Watermark','MusicInfo','MusicLyrics','MusicSpectrum'].map((name,i)=>{const d=JSON.parse(fs.readFileSync(`public/components/${name.toLowerCase()}.json`,'utf8'));return{id:name,name,settings:{enabled:true,alignment:{horizontalAlignment:'Left',horizontalOffset:20,verticalAlignment:'Top',verticalOffset:20+i*180}}};})}));
    await page.goto('/#/hud?static&preview');await expect(page.locator('.music-island')).toHaveCount(0);await expect(page.locator('.network')).toBeVisible();await expect(page.getByLabel('Music Info',{exact:true})).toContainText('Fixture Song 1');await expect(page.getByLabel('Music Lyrics',{exact:true})).toContainText('测试歌词');await expect(page.locator('.music-info')).toHaveCSS('width','230px');await expect(page.locator('.music-info')).toHaveCSS('height','56px');
    await expect.poll(()=>api.musicRequests.filter(r=>r.path==='/spectrum').length).toBeGreaterThan(0);await expect.poll(async()=>await page.locator('.music-spectrum path').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).d*70)).toBeGreaterThan(60);await page.screenshot({path:'reports/music-huds-1.12.2.png'});
    api.state.playing=false;await expect(page.locator('.music-spectrum')).toHaveCount(0);await page.waitForTimeout(150);const count=api.musicRequests.filter(r=>r.path==='/spectrum').length;await page.waitForTimeout(700);expect(api.musicRequests.filter(r=>r.path==='/spectrum').length).toBe(count);
    await page.goto('/#/clickgui?static&preview');const moduleName=page.locator('.module .name').filter({hasText:'Tritium Music'});if(!await moduleName.locator('..').evaluate(el=>el.classList.contains('expanded')))await moduleName.click({button:'right'});await page.getByLabel('Music Info',{exact:true}).uncheck();await expect.poll(()=>api.state.widgets.info).toBe(false);await page.getByRole('button',{name:'HUD Editor',exact:true}).click();const handle=page.locator('.draggable-element[data-component=MusicInfo]');await expect(handle).toBeVisible();const box=(await handle.boundingBox())!;await page.mouse.move(box.x+60,box.y+40);await page.mouse.down();await page.mouse.move(box.x+120,box.y+75);await page.mouse.up();await expect.poll(()=>api.requests.filter(r=>r.path.includes('/MusicInfo/alignment')).length).toBeGreaterThan(0);expect(api.errors).toEqual([]);
});

test('HUD editor button restores the original size and original pencil at native GUI scales',async({page})=>{
    const api=await setup(page);await page.goto('/#/clickgui?static&preview');await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');const button=page.getByRole('button',{name:'HUD Editor',exact:true});await expect(button.locator('.vector-icon svg')).toHaveCount(1);expect((await button.boundingBox())!.width).toBeCloseTo(53.4,1);api.emit('scaleFactorChange',{scaleFactor:3});await expect.poll(async()=>(await button.boundingBox())!.width).toBeCloseTo(80.1,1);expect(api.errors).toEqual([]);
});

 test('old Java service is rejected with a restart instruction before using new music interfaces',async({page})=>{
    const shared={'opai.bridge.music':JSON.stringify({protocol:1,version:'1.0.0',url:'http://127.0.0.1:61939',token:'fixture-token-for-music-tests'})};const api=await setup(page,false,shared);let hits=0;await page.route('http://127.0.0.1:61939/**',async r=>{hits++;await r.fulfill({json:{}});});await page.goto('/#/clickgui?static&preview');await expect(page.locator('.clickgui')).toHaveAttribute('data-motion-active','false');await page.locator('.module .name').filter({hasText:'Tritium Music'}).click();await expect(page.getByText(/音乐服务仍为旧版/)).toBeVisible();expect(hits).toBe(0);expect(api.errors).toEqual([]);
});

test('unknown duration keeps the seek bar empty and disabled without inventing a total time',async({page})=>{
    const api=await music(page);api.tracks[0].duration=0;await page.getByRole('button',{name:/免 VIP 接入/}).click();await page.getByLabel('搜索歌曲').fill('demo');await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByRole('button',{name:'播放 Fixture Song 1',exact:true}).click();await expect(page.getByRole('button',{name:'暂停',exact:true})).toBeEnabled();await expect(page.getByLabel('播放进度')).toBeDisabled();await expect(page.getByLabel('播放进度')).toHaveValue('0');await expect(page.locator('.progress')).toContainText('—:—');expect(api.errors).toEqual([]);
});

async function musicHuds(page:Page){const fs=await import('node:fs');await page.route('**/api/v1/client/components/opai',r=>r.fulfill({json:['Watermark','MusicInfo','MusicLyrics','MusicSpectrum'].map((name,i)=>{const d=JSON.parse(fs.readFileSync(`public/components/${name.toLowerCase()}.json`,'utf8'));return{id:name,name,settings:{enabled:true,alignment:{horizontalAlignment:'Left',horizontalOffset:20,verticalAlignment:'Top',verticalOffset:20+i*180}}};})}));}
async function playFixture(page:Page){await page.getByRole('button',{name:/免 VIP 接入/}).click();await page.getByLabel('搜索歌曲').fill('demo');await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByRole('button',{name:'播放 Fixture Song 1',exact:true}).click();await page.getByRole('button',{name:'关闭音乐面板',exact:true}).click();}

test('paused or ended playback restores the normal island and hides music HUDs even with a retained track',async({page})=>{
 const api=await music(page);await playFixture(page);await musicHuds(page);await page.goto('/#/hud?static&preview');await expect(page.locator('.music-info')).toBeVisible();await expect(page.locator('.music-island')).toBeVisible();api.state.playing=false;await expect(page.locator('.network')).toBeVisible();await expect(page.locator('.music-info,.music-lyrics,.music-spectrum,.music-island')).toHaveCount(0);expect(api.state.track).not.toBeNull();api.state.playing=true;await expect(page.locator('.music-info')).toBeVisible();await expect(page.locator('.music-island')).toBeVisible();expect(api.errors).toEqual([]);
});

test('spectrum and lyric scrolling interpolate on Windows with suspended RAF; the album fills the blurred card',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{value:'Windows NT 10.0'}));const api=await music(page);api.tracks[0].cover='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g"><stop stop-color="#eec8db"/><stop offset="1" stop-color="#3146ac"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/></svg>');api.setSpectrum(Array(32).fill(.05));await playFixture(page);await musicHuds(page);api.state.position=0;await page.goto('/#/hud?static&preview');await expect(page.locator('.music-info .album-back')).toHaveCSS('opacity','1');await expect(page.locator('.album-back')).toHaveCSS('filter','blur(10px)');await expect(page.locator('.album-back')).toHaveCSS('object-fit','cover');await expect(page.locator('.music-lyrics .current')).toContainText('Intro');
 await page.evaluate(()=>{window.requestAnimationFrame=()=>123456;});api.setSpectrum(Array(32).fill(.95));const values=await page.locator('.music-spectrum path').evaluate(async el=>{const samples:number[]=[];for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,20));samples.push(1-Number(el.getAttribute('d')?.match(/^M[\d.]+ ([\d.]+)/)?.[1]??70)/70);}return samples;});expect(values.some(v=>v>.1&&v<.9)).toBe(true);
 const intro=page.locator('.lyric-row').filter({hasText:'Intro'});api.state.position=1500;const ys=await intro.evaluate(async el=>{const samples:number[]=[];for(let i=0;i<70;i++){samples.push(new DOMMatrix(getComputedStyle(el).transform).f);await new Promise(r=>setTimeout(r,20));}return samples;});expect(ys.some(y=>y>10&&y<48)).toBe(true);await expect.poll(async()=>intro.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).f)).toBeCloseTo(10,1);await page.locator('.music-info').screenshot({path:'reports/music-cover-card-1.12.2.png'});expect(api.errors).toEqual([]);
});

test('registered music uses the same setting controls without a custom expand button and persists a separate Dango3D mode',async({page})=>{
 const api=await music(page);await page.getByRole('button',{name:'关闭音乐面板',exact:true}).click();const name=page.locator('.module .name').filter({hasText:'Tritium Music'});await name.click({button:'right'});const module=name.locator('..');await expect(page.locator('.music-entry,.music-module-settings')).toHaveCount(0);await expect(module.locator('.expand')).toHaveCount(0);await expect(module.locator('.opai-setting[data-setting=MusicInfo] .box')).toHaveCSS('width','52px');await expect(module.locator('.opai-setting[data-setting=MusicInfo] .box')).toHaveCSS('height','32px');await module.locator('[data-setting=LyricsMode] .choice-field').click();await module.getByRole('button',{name:'Dango3 D',exact:true}).click();await expect.poll(()=>api.state.lyricsMode).toBe('Dango3D');expect(api.requests.some(r=>r.path==='/client/modules/settings'&&r.method==='PUT'&&r.body.value.some((v:any)=>v.name==='LyricsMode'&&v.value==='Dango3D'))).toBe(true);expect(api.errors).toEqual([]);
});

test('smooth playback clock does not overwrite the seek thumb while dragging',async({page})=>{
 const api=await music(page);await page.getByRole('button',{name:/免 VIP 接入/}).click();await page.getByLabel('搜索歌曲').fill('demo');await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByRole('button',{name:'播放 Fixture Song 1',exact:true}).click();await expect(page.getByRole('button',{name:'暂停',exact:true})).toBeEnabled();const progress=page.getByLabel('播放进度');await progress.evaluate(el=>{const input=el as HTMLInputElement;input.value='90000';input.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForTimeout(200);await expect(progress).toHaveValue('90000');await progress.dispatchEvent('change');await expect.poll(()=>api.state.position).toBe(90000);expect(api.errors).toEqual([]);
});

for(const platform of ['Windows NT 10.0','Macintosh'])test(`music performance sample ${platform}`,async({page})=>{
 const fs=await import('node:fs');await page.addInitScript(ua=>{Object.defineProperty(navigator,'userAgent',{value:ua});Object.defineProperty(navigator,'platform',{value:ua.includes('Windows')?'Win32':'MacIntel'});},platform);
 const api=await music(page);await playFixture(page);await musicHuds(page);api.state.position=5000;await page.goto('/#/hud?static&preview');await expect(page.locator('.music-spectrum')).toBeVisible();await page.waitForTimeout(700);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');const before=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 await page.evaluate(()=>{const w=window as any;w.__musicMutations=0;w.__musicObserver=new MutationObserver(rs=>w.__musicMutations+=rs.length);w.__musicObserver.observe(document.querySelector('.music-spectrum')!,{subtree:true,attributes:true});});
 let high=false;const timer=setInterval(()=>api.setSpectrum(Array(32).fill((high=!high)?.85:.15)),100);try{await page.waitForTimeout(2400);}finally{clearInterval(timer);}
 const after=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));const mutations=await page.evaluate(()=>{const w=window as any;w.__musicObserver.disconnect();return w.__musicMutations;});
 const metrics:any={spectrumAttributeWrites:mutations};for(const key of ['LayoutCount','RecalcStyleCount','ScriptDuration','TaskDuration'])metrics[key]=Number((after[key]-before[key]).toFixed(6));
 const label=process.env.OPAI_MUSIC_PROFILE??'current';if(label!=='1.12.0')expect(mutations).toBeLessThan(300);fs.writeFileSync(`reports/music-performance-${label}-${platform.includes('Windows')?'windows':'macos'}.json`,JSON.stringify({label,platform,environment:'Headless Chrome with emulated platform and isolated APIs; 2400ms. Not native Windows/macOS CEF.',metrics},null,2)+'\n');console.log(JSON.stringify({platform,...metrics}));await cdp.detach();expect(api.errors).toEqual([]);
});

for(const platform of ['Windows NT 10.0','Macintosh'])test(`steady music spectrum and lyrics remain idle between new data on ${platform}`,async({page})=>{
 await page.addInitScript(ua=>Object.defineProperty(navigator,'userAgent',{value:ua}),platform);const api=await music(page);await playFixture(page);await musicHuds(page);api.state.position=5000;api.setSpectrum(Array(32).fill(.6));await page.goto('/#/hud?static&preview');await expect(page.locator('.music-spectrum path')).toHaveAttribute('d',/^M/);await page.waitForTimeout(1200);
 const changes=await page.evaluate(async()=>{let writes=0;const observer=new MutationObserver(rs=>writes+=rs.length);observer.observe(document.querySelector('.music-spectrum')!,{subtree:true,attributes:true});observer.observe(document.querySelector('.music-lyrics')!,{subtree:true,attributes:true,childList:true});await new Promise(r=>setTimeout(r,1200));observer.disconnect();return writes;});expect(changes).toBe(0);
 const originalRequests=api.musicRequests.filter(r=>r.path==='/spectrum').length;await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(1200);expect(api.musicRequests.filter(r=>r.path==='/spectrum').length-originalRequests).toBeLessThanOrEqual(1);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});api.setSpectrum(Array(32).fill(.9));await expect.poll(()=>api.musicRequests.filter(r=>r.path==='/spectrum').length).toBeGreaterThan(originalRequests+1);expect(api.errors).toEqual([]);
});

test('long music lists remain scrollable and update selection and favorites after metadata isolation',async({page})=>{
 const api=await music(page);for(let i=3;i<=500;i++)api.tracks.push({...api.tracks[0],id:String(i),name:'Fixture Song '+i});await page.getByRole('button',{name:/免 VIP 接入/}).click();await page.getByLabel('搜索歌曲').fill('Fixture');await page.getByRole('button',{name:'搜索',exact:true}).click();await expect(page.locator('.song-row')).toHaveCount(500);
 await page.getByRole('button',{name:'播放 Fixture Song 500',exact:true}).click();await expect(page.locator('.now-playing')).toContainText('Fixture Song 500');await expect(page.locator('.song-row.active')).toContainText('Fixture Song 500');await expect(page.getByRole('button',{name:'暂停',exact:true})).toBeEnabled();await page.getByRole('button',{name:'收藏当前歌曲',exact:true}).click();await expect(page.getByRole('button',{name:'收藏当前歌曲',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'本地收藏',exact:true}).click();await expect(page.locator('.song-row')).toHaveCount(1);await expect(page.locator('.song-row')).toContainText('Fixture Song 500');expect(api.errors).toEqual([]);
});
