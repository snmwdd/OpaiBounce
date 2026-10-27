import type {ConfigurableSetting} from '../integration/types';
import {setModuleSettings} from '../integration/rest';
import {isPreview} from '../integration/host';
import {persistentDataLoaded,flushPersistentData} from '../integration/persistent_storage';

// CEF paints/uploads independently of Minecraft. Do not drive a full-window
// offscreen browser at the game's 500+ FPS or silently raise it to 120 FPS.
// One migration per renderer; subsequent explicit user settings always win.
export async function tuneFrameRate(moduleName:'HUD'|'ClickGUI',settings:ConfigurableSetting){
    if(isPreview)return;
    await persistentDataLoaded;
    const key=`opai.renderer.balanced60.v1.${moduleName}`;
    if(localStorage.getItem(key))return;
    const next=structuredClone(settings);
    const renderer=next.value.find(v=>v.name==='Renderer'&&v.valueType==='CONFIGURABLE') as ConfigurableSetting|undefined;
    const fps=renderer?.value.find(v=>v.name==='Fps'&&v.valueType==='INT');
    if(!fps||typeof fps.value!=='number')return;
    const sync=renderer?.value.find(v=>v.name==='SyncGameFps'&&v.valueType==='BOOLEAN');
    const upper=Number((fps as any).range?.to??(fps as any).range?.max??60);
    const target=Math.max(1,Math.min(60,Number.isFinite(upper)&&upper>0?upper:60));
    const original={fps:fps.value,sync:sync?.value};
    let changed=false;
    if(fps.value<=0||fps.value>target){fps.value=target;changed=true;}
    if(sync?.value===true){sync.value=false;changed=true;}
    localStorage.setItem(key,JSON.stringify({original,applied:{fps:fps.value,sync:sync?.value}}));
    try{
        // The write may recreate this browser. Commit the marker first.
        if(!await flushPersistentData()){localStorage.removeItem(key);return;}
    }catch(error){localStorage.removeItem(key);try{await flushPersistentData();}catch{}throw error;}
    // A successful renderer update can destroy its own fetch context. Keep
    // the committed guard even if that connection ends, avoiding reload loops.
    if(changed)await setModuleSettings(moduleName,next);
}
