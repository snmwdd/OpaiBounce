import {writable} from 'svelte/store';
import {isPreview} from '../integration/host';
import {getPersistentStorageItem,putPersistentStorageItem} from '../integration/rest';
export type IslandAnchor={x:number;y:number;width:number;height:number};
export type PaletteSession={id:string;at:number;phase:'requested'|'opening'|'ready'|'closing'|'closed';anchor:IslandAnchor;owner?:string};
const KEY='opai.palette.session',owner=Date.now().toString(36)+Math.random().toString(36).slice(2);
let cached:PaletteSession|null=null,watch:ReturnType<typeof setTimeout>|undefined;
export const paletteSession=writable<PaletteSession|null>(null);
function parse(value:string|null):PaletteSession|null {
    try {const session=JSON.parse(value??'null');if(!session||typeof session.id!=='string'||!Number.isFinite(session.anchor?.width))return null;if(session.phase==='requested'&&Date.now()-session.at>10000)return null;return session;}catch{return null;}
}
function remember(value:PaletteSession|null){cached=value;paletteSession.set(value);return value;}
export function readPalette(){return cached;}
async function read(){return remember(parse(isPreview?localStorage.getItem(KEY):await getPersistentStorageItem(KEY)));}
async function write(value:PaletteSession){remember(value);if(isPreview)localStorage.setItem(KEY,JSON.stringify(value));else await putPersistentStorageItem(KEY,JSON.stringify(value));}
if(isPreview)window.addEventListener('storage',event=>{if(event.key===KEY)remember(parse(event.newValue));});
export function captureIsland():IslandAnchor {
    const box=document.querySelector('.island-visibility')?.getBoundingClientRect();
    return box&&box.width>0?{x:box.x,y:box.y,width:box.width,height:box.height}:{x:innerWidth/2-215,y:42,width:430,height:46};
}
// Only poll during the short HUD -> input-screen handoff. Native virtualScreen.close restores the HUD later.
function observeHandoff(id:string){
    clearTimeout(watch);const deadline=Date.now()+5000;
    const poll=async()=>{try{const state=await read();if(state?.id!==id||state.phase==='ready'||state.phase==='closed')return;
        if(Date.now()>=deadline){await cancelPalette(id);return;}watch=setTimeout(poll,32);
    }catch{void cancelPalette(id).catch(()=>{});}};
    watch=setTimeout(poll,16);
}
export async function requestPalette():Promise<PaletteSession|null> {
    const previous=await read();if(previous&&previous.phase!=='closed'&&Date.now()-previous.at<1000)return null;
    const request:PaletteSession={id:owner+':'+Date.now(),at:Date.now(),phase:'requested',anchor:captureIsland()};await write(request);if(!isPreview)observeHandoff(request.id);return request;
}
export async function consumePalette():Promise<PaletteSession|null> {
    const request=await read();if(!request||request.phase==='closed'||request.phase==='closing')return null;
    const claimed={...request,owner,phase:'opening' as const};await write(claimed);return claimed;
}
export async function markPalette(id:string,phase:PaletteSession['phase']) {const current=cached;if(current?.id===id)await write({...current,phase});}
export async function cancelPalette(id?:string){
    clearTimeout(watch);const current=cached??await read();
    if(!current||id&&current.id!==id)return;
    if(!id&&current.phase==='requested'&&Date.now()-current.at<2000)return;
    await write({...current,phase:'closed'});
}
