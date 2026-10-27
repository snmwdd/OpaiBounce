import {writable} from 'svelte/store';
import {isStatic,isPreview,REST_BASE} from '../integration/host';
import {listenAlways} from '../integration/ws';
export const clickGuiVisible=writable(true);
export function installClickGuiLifecycle(){
    clickGuiVisible.set(true);
    let alive=true,busy=false,visible:boolean|undefined,epoch=0;
    function update(open:boolean,replay=false){
        if(!alive)return;
        const changed=visible!==open;visible=open;clickGuiVisible.set(open);
        if(open&&(changed||replay))window.dispatchEvent(new CustomEvent('opai-clickgui-open',{detail:++epoch}));
    }
    const off=listenAlways('virtualScreen',event=>{
        if(event.action==='close')update(false);
        else if((event as any).screenName==='clickgui'||event.type==='CLICK_GUI'||event.type==='clickgui')update(true,true);
    });
    // Cache=true uses CustomStandaloneMinecraftScreen. It only changes browser.visible,
    // and does not emit VirtualScreenEvent on each open. Observe the real native screen.
    async function poll(){
        if(!alive||busy||!isStatic||isPreview)return;
        busy=true;
        try{
            const response=await fetch(`${REST_BASE}/api/v1/client/screen`);
            if(response.status===403){update(false);return;}
            if(!response.ok)return;
            const screen=await response.json();
            if(typeof screen.name==='string')update(screen.name==='clickgui'||screen.name.endsWith('.CustomStandaloneMinecraftScreen'));
        }catch{}finally{busy=false;}
    }
    function visibility(){if(!document.hidden){if(isStatic&&!isPreview)void poll();else update(true,true);}}
    document.addEventListener('visibilitychange',visibility);
    void poll();const timer=setInterval(poll,125);
    return()=>{alive=false;clearInterval(timer);off();document.removeEventListener('visibilitychange',visibility);clickGuiVisible.set(false);};
}
