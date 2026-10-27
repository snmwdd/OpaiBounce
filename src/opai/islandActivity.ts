import {writable} from 'svelte/store';
import {getPersistentStorageItem,putPersistentStorageItem} from '../integration/rest';
export {parseActivity,type BreakingActivity,type ContainerActivity,type IslandActivity} from './activityModel';
import {parseActivity,type ContainerActivity,type IslandActivity} from './activityModel';
export const islandActivity=writable<IslandActivity|null>(null);
let revision=0;
export function installActivityMonitor(active:()=>boolean){
    let alive=true,busy=false,timer:ReturnType<typeof setTimeout>;
    async function poll(){if(!alive)return;let hasActivity=false;
        if(active()&&!document.hidden&&!busy){busy=true;const ticket=++revision;try{const next=parseActivity(await getPersistentStorageItem('opai.bridge.activity'));if(alive&&ticket===revision){islandActivity.set(next);hasActivity=!!(next?.breaking||next?.container);}}catch{if(alive)islandActivity.set(null);}finally{busy=false;}}
        else if(!active()||document.hidden)islandActivity.set(null);
        if(alive)timer=setTimeout(poll,hasActivity?100:250);
    }
    void poll();const visible=()=>{if(!document.hidden&&!busy){clearTimeout(timer);void poll();}};document.addEventListener('visibilitychange',visible);
    return()=>{alive=false;revision++;clearTimeout(timer);document.removeEventListener('visibilitychange',visible);islandActivity.set(null);};
}
const owner=Date.now().toString(36)+Math.random().toString(36).slice(2);
export async function sendContainerView(container:ContainerActivity,rect:{x:number;y:number;width:number;height:number}){
    await putPersistentStorageItem('opai.bridge.containerView',JSON.stringify({protocol:1,owner,at:Date.now(),session:container.session,rect,viewport:{width:innerWidth,height:innerHeight}}));
}
export async function clickContainer(container:ContainerActivity,slot:number){
    if(!container.open||!container.interactive||slot<0||slot>=container.rows*9)return;
    await putPersistentStorageItem('opai.bridge.containerClick',JSON.stringify({protocol:1,id:Date.now()+Math.random(),owner,at:Date.now(),session:container.session,slot}));
}
