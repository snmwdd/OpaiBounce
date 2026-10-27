import type {Page,WebSocketRoute} from '@playwright/test';
import fs from 'node:fs';
const floats = [{name:'Range',valueType:'FLOAT',value:6,range:{from:3,to:8},suffix:''},{name:'Speed',valueType:'FLOAT',value:5,range:{from:1,to:10},suffix:''}];
const names: Record<string,string[]> = {
    Combat:['AimAssist','AntiBot','AutoClicker','AutoRod','Criticals','KillAura','SprintReset','Targets','TriggerBot','Velocity'],
    Movement:['AntiSwim','AutoWalk','Blink','Flight','InvMove','KeepSprint','LongJump','MoveFix','NoSlow','Speed','Sprint','Stasis','Timer'],
    Player:['AutoHead','AutoTool','Backtrack','BedAura','ChestStealer','Eagle','FastMine','FastPlace','InvManager','LagRange','NoFall','NoJumpDelay','Scaffold'],
    Render:['Ambience','Animations','AntiFire','Appearance','BedPlates','Cape','ClickGUI','FullBright','HUD','NameTags','NoHurtCam','PlayerESP','Scoreboard','Theme'],
    Misc:['Disabler','Whitelist','WindCharge','TritiumMusic']
};
export async function setup(page: Page, intro = false, sharedStore?:Record<string,string>) {
    const modules = Object.entries(names).flatMap(([category,list]) => list.map(name => ({name,category,enabled:name==='AimAssist',hidden:false,description:`${name} description`,aliases:[],tag:null,keyBind:{boundKey:'key.keyboard.unknown',action:'Toggle',modifiers:[]}})));
    const requests: {path:string;method:string;body:any;name:string|null}[] = [];
    const errors: string[] = [];
    let socket: WebSocketRoute | undefined;
    let stored: Record<string,string> = sharedStore??{};
    let moduleSettings: Record<string,any> = {};
    let globalSettings:any={name:'Settings',valueType:'CONFIGURABLE',value:[{name:'Language',valueType:'CONFIGURABLE',value:[{name:'Language',valueType:'CHOOSE',value:'en_us',choices:['en_us','zh_cn']}]},{name:'Targets',valueType:'CONFIGURABLE',value:[{name:'Players',valueType:'BOOLEAN',value:true}]},{name:'AutoTranslate',valueType:'CONFIGURABLE',value:[{name:'Enabled',valueType:'BOOLEAN',value:false}]}]};
    let servers = [{id:0,name:'Loyisa',address:'mc.loyisa.cn',icon:'',online:false,players:{online:0,max:0},ping:-1,resourcePackPolicy:'Prompt'}];
    page.on('pageerror',e => errors.push(e.message));
    await page.addInitScript(({intro}) => { if(!intro) sessionStorage.setItem('opai.intro','1'); },{intro});
    await page.routeWebSocket('**/*',ws => { socket = ws; ws.onMessage(() => {}); });
    const emit = (name:string,event:any) => socket?.send(JSON.stringify({name,event}));
    await page.route('**/api/v1/**',async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname.replace('/api/v1','');
        const body = request.postDataJSON();
        requests.push({path,method:request.method(),body,name:url.searchParams.get('name')});
        let data: any = {};
        if(path==='/client/modules') data=modules;
        else if(path==='/client/modules/categories') data=Object.keys(names).map(name=>({name,icon:null}));
        else if(path==='/client/modules/settings') {
            const name = url.searchParams.get('name')!;
            const mod=modules.find(m=>m.name===name)!;
            if(request.method()==='PUT') {
                moduleSettings[name]=body;
                for(const setting of body.value){if(setting.name==='Enabled'&&typeof setting.value==='boolean')mod.enabled=setting.value;if(setting.name==='Hidden')mod.hidden=setting.value;if(setting.valueType==='BIND')mod.keyBind=setting.value;}
            }
            data=moduleSettings[name] ?? {name,valueType:'CONFIGURABLE',value:name==='ClickGUI' ? [{name:'Scale',valueType:'FLOAT',value:1}] : name==='HUD' ? [{name:'SpaceSeperatedNames',valueType:'BOOLEAN',value:true}] : name==='AimAssist' ? [...structuredClone(floats),{name:'ThroughWalls',valueType:'BOOLEAN',value:false},{name:'Mode',valueType:'CHOICE',active:'Smooth',value:[],choices:{Smooth:{name:'Smooth',valueType:'CONFIGURABLE',value:[{name:'Smoothness',valueType:'FLOAT',value:.5,range:{from:0,to:1}}]},Linear:{name:'Linear',valueType:'CONFIGURABLE',value:[{name:'Delay',valueType:'INT',value:2,range:{from:0,to:10}}]}}},{name:'Bind',valueType:'BIND',value:{boundKey:'key.keyboard.unknown',action:'Toggle',modifiers:[]}}] : []};
            // Match native value groups and methods. POST intentionally ignores body.enabled.
            data=structuredClone(data);
            data.value=data.value.filter((v:any)=>v.name!=='Enabled');
            data.value.unshift({name:'Enabled',valueType:'BOOLEAN',value:mod.enabled});
            if(!data.value.some((v:any)=>v.name==='Hidden'))data.value.push({name:'Hidden',valueType:'BOOLEAN',value:mod.hidden});
            if(!data.value.some((v:any)=>v.valueType==='BIND'))data.value.push({name:'Bind',valueType:'BIND',value:mod.keyBind});
        }
        else if(path==='/client/modules/toggle') {
            const mod=modules.find(m=>m.name===body.name)!;
            const enabled=request.method()==='PUT'||(request.method()==='POST'&&!mod.enabled);
            if(mod.enabled===enabled){await route.fulfill({status:403,json:{error:'Already in this state'}});return;}
            mod.enabled=enabled;emit('moduleToggle',{moduleName:mod.name,enabled:mod.enabled,hidden:mod.hidden});
        }
        else if(path==='/client/theme/opai') data={id:'opai',colors:{accent:-18774,tint:-15068141}};
        else if(path==='/client/localStorage/all') {if(request.method()==='PUT'){for(const key of Object.keys(stored))delete stored[key];Object.assign(stored,Object.fromEntries(body.items.map((x:any)=>[x.key,x.value])));} data={items:Object.entries(stored).map(([key,value])=>({key,value}))};}
        else if(path==='/client/localStorage'){const key=url.searchParams.get('key')??body?.key;if(request.method()==='PUT')stored[key]=body.value;else if(request.method()==='DELETE')delete stored[key];else if(!(key in stored)){await route.fulfill({status:403,json:{error:'No value for key'}});return;}data={value:stored[key]};}
        else if(path==='/client/window') data={width:2000,height:1100,scaledWidth:1000,scaledHeight:550,scaleFactor:2,guiScale:2};
        else if(path==='/client/info') data={os:'MACOS',fps:144,gameVersion:'1.21.11',clientVersion:'test',clientDir:'/fixture/LiquidBounce',gameDir:'/fixture',inGame:false};
        else if(path==='/client/virtualScreen') data={name:'title'};
        else if(path==='/client/screen') {emit('virtualScreen',request.method()==='DELETE'?{action:'close',screenName:'clickgui'}:{action:'open',screenName:body?.name});}
        else if(path==='/client/player') data={username:'Player',uuid:'test',actualHealth:20,maxHealth:20};
        else if(path==='/client/session') data={username:'滚木',uuid:'test',avatar:'',online:false,type:'Cracked'};
        else if(path==='/client/servers') data=servers;
        else if(path==='/client/servers/add') {servers.push({id:1,...body,icon:'',online:false,players:{online:0,max:0},ping:-1});}
        else if(path==='/client/proxy') data=null;
        else if(path.includes('/protocols')) data=path.endsWith('/protocol') ? {name:'1.21.11',version:774} : [{name:'1.8',version:47},{name:'1.21.11',version:774}];
        else if(path==='/client/accounts') data=[{id:0,username:'Player',avatar:'',type:'Cracked',favorite:false,uuid:'test'}];
        else if(path==='/client/proxies') data=[];
        else if(path==='/client/worlds') data=[];
        else if(path==='/client/global') {if(request.method()==='PUT')globalSettings=body;data=globalSettings;}
        else if(path==='/client/components/opai') data=['watermark','sessioninfo','inventory','effects','arraylist','targethud'].map(id=>{const c=JSON.parse(fs.readFileSync(`public/components/${id}.json`,'utf8'));return {id,name:c.name,settings:{enabled:true,zIndex:0,alignment:c.alignment,kills:0,wins:0,showTags:false,order:'Descending',itemAlignment:'Right'}};});
        else if(path==='/client/player/inventory') {const air={count:0,damage:0,maxDamage:0,identifier:'minecraft:air',enchantments:[]};data={main:Array.from({length:36},()=>({...air})),armor:[],crafting:[],enderChest:[]};}
        else if(path==='/client/resource/skin') {await route.fulfill({contentType:'image/png',body:fs.readFileSync('public/opai/minecraft/steve.png')});return;}
        else if(path.includes('/components/')) data=[];
        else if(path==='/client/typing' || path==='/client/hud-editor') data={};
        else if(path==='/client/registry/keys') data={};
        else if(path==='/client/keybinds') data=[['forward','w','W'],['back','s','S'],['left','a','A'],['right','d','D'],['jump','space','Space'],['playerlist','tab','Tab']].map(([name,key,localized])=>({bindName:`key.${name}`,key:{translationKey:`key.keyboard.${key}`,localized}}));
        await route.fulfill({json:data});
    });
    return {requests,errors,emit,modules};
}
