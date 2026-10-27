import {getModules,getModuleSettings,setModuleSettings,setModuleEnabled} from '../integration/rest';
import {setItem} from '../integration/persistent_storage';
import type {ConfigurableSetting} from '../integration/types';
export type Profile = {name:string;created:string;modules:{name:string;enabled:boolean;settings:ConfigurableSetting}[]};
export function readProfiles():Profile[] {
    try {const entries=JSON.parse(localStorage.getItem('opai.profiles')??'[]');return Array.isArray(entries)?entries:[];}catch{return [];}
}
export async function writeProfiles(profiles:Profile[]) {await setItem('opai.profiles',JSON.stringify(profiles));}
async function each<T>(items:T[], action:(item:T)=>Promise<void>) {
    let index=0;
    await Promise.all(Array.from({length:Math.min(4,items.length)},async()=>{while(index<items.length)await action(items[index++]);}));
}
export async function captureProfile(name:string):Promise<Profile> {
    const modules=await getModules(),snapshot:Profile={name,created:new Date().toISOString(),modules:[]};
    await each(modules,async m=>{snapshot.modules.push({name:m.name,enabled:m.enabled,settings:await getModuleSettings(m.name)});});
    return snapshot;
}
export async function loadProfile(snapshot:Profile) {
    // Validate the complete snapshot before the first write. Do not coerce strings such as "false" to true.
    if(!Array.isArray(snapshot?.modules)||snapshot.modules.some(m=>typeof m.name!=='string'||typeof m.enabled!=='boolean'||!Array.isArray(m.settings?.value)))throw new Error('Invalid configuration');
    const existing=new Set((await getModules()).map(m=>m.name));
    const modules=snapshot.modules.filter(m=>existing.has(m.name));
    await each(modules,async m=>{
        // Enabled is a separate operation. Only strip the root value; nested toggle groups need their own Enabled.
        const settings=structuredClone(m.settings);
        settings.value=settings.value.filter(s=>s.name!=='Enabled');
        await setModuleSettings(m.name,settings);
    });
    const actual=new Map((await getModules()).map(m=>[m.name,m.enabled]));
    await each(modules.filter(m=>m.name!=='ClickGUI'&&actual.get(m.name)!==m.enabled),m=>setModuleEnabled(m.name,m.enabled));
    window.dispatchEvent(new Event('opai-profile-loaded'));
}
