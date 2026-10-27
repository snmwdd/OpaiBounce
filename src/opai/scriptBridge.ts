import {get,writable} from 'svelte/store';
import {getPersistentStorageItem,putPersistentStorageItem} from '../integration/rest';
export const BRIDGE={snapshot:'opai.bridge.snapshot',request:'opai.bridge.preview',features:'opai.bridge.features',protocol:1} as const;
export type BridgeState={protocol:1;version:string;at:number;connected:boolean;serverAddress:string|null;serverIP?:string|null;ping:number|null;inWorld:boolean;singleplayer?:boolean;worldInfo?:{biome:string|null;dimension:string|null}|null;previewError?:string|null;capabilities:{serverInfo:boolean;nametags:boolean;preview:boolean;activity?:boolean};errors:string[]};
export type PreviewRequest={protocol:1;owner:string;at:number;module:string;rect:{x:number;y:number;width:number;height:number};viewport:{width:number;height:number};options:Record<string,unknown>};
export const bridgeState=writable<BridgeState|null>(null);
export const previewModule=writable<{name:string;anchor:HTMLElement;settings:unknown}|null>(null);
const owner=Date.now().toString(36)+Math.random().toString(36).slice(2);
export function parseBridge(value:string|null,now=Date.now()):BridgeState|null{
    try{const state=JSON.parse(value??'null');if(state?.protocol!==1||state.connected!==true||!Number.isFinite(state.at)||now-state.at>4000||state.at-now>1000||typeof state.capabilities?.preview!=='boolean')return null;
        return {...state,serverIP:typeof state.serverIP==='string'?state.serverIP:null,serverAddress:state.inWorld&&state.capabilities.serverInfo?(typeof state.serverAddress==='string'&&state.serverAddress.trim()?state.serverAddress:typeof state.serverIP==='string'?state.serverIP:null):null,ping:state.inWorld&&state.capabilities.serverInfo&&Number.isFinite(state.ping)&&state.ping>=0?Math.round(state.ping):null};}catch{return null;}
}
let busy=false,lease=false;
export async function refreshBridge(){if(busy)return;busy=true;try{bridgeState.set(parseBridge(await getPersistentStorageItem(BRIDGE.snapshot)));}catch{bridgeState.set(null);}finally{busy=false;}}
export async function sendPreview(module:string,rect:PreviewRequest['rect'],options:Record<string,unknown>={}){
    if(!Number.isFinite(rect.x+rect.y+rect.width+rect.height)||rect.width<1||rect.height<1)throw new Error('Invalid preview rectangle');
    const request:PreviewRequest={protocol:1,owner,at:Date.now(),module,rect,viewport:{width:innerWidth,height:innerHeight},options};
    await putPersistentStorageItem(BRIDGE.request,JSON.stringify(request));lease=true;
}
export async function clearPreview(){if(!lease)return;lease=false;const current=JSON.parse(await getPersistentStorageItem(BRIDGE.request)??'null');if(current?.owner===owner)await putPersistentStorageItem(BRIDGE.request,JSON.stringify({protocol:1,owner,at:0}));}
export function installBridgeAPI(){
    const api=Object.freeze({version:'1.0.0',protocol:1,getState:()=>get(bridgeState),subscribe:bridgeState.subscribe,
        requestPreview:sendPreview,clearPreview,
        setFeatures:async(features:{nametags?:boolean;preview?:boolean;serverInfo?:boolean})=>{
            for(const key of Object.keys(features))if(!['nametags','preview','serverInfo'].includes(key)||typeof features[key as keyof typeof features]!=='boolean')throw new Error('Invalid bridge feature');
            let previous={};try{previous=JSON.parse(await getPersistentStorageItem(BRIDGE.features)??'{}');}catch{}
            await putPersistentStorageItem(BRIDGE.features,JSON.stringify({...previous,...features,protocol:1}));
        }});
    (window as any).OpaiTheme=api;
    return()=>{if((window as any).OpaiTheme===api)delete (window as any).OpaiTheme;};
}
