import { getPersistentStorageItems, putPersistentStorageItem, deletePersistentStorageItem } from "./rest";
import type { PersistentStorageItem } from "./types";

let loadedOnce = false;
const baseline=new Map<string,string>();
const transient=(key:string)=>key.startsWith('opai.palette.')||key.startsWith('opai.bridge.');
let persistentDataUpdateTimeout: null | ReturnType<typeof setTimeout> = null;

let markLoaded: () => void;
export const persistentDataLoaded = new Promise<void>(resolve => markLoaded = resolve);

export async function insertPersistentData() {
    try {
        const items = await getPersistentStorageItems();
        for (const { key, value } of items) {
            if(transient(key))continue;
            baseline.set(key,value);
            localStorage.setItem(key, value);
        }
        loadedOnce = true;
    } catch {
        // The API already reports the failure. Allow the UI to open with local
        // state, but do not overwrite native storage after a failed read.
    } finally {
        markLoaded();
    }
}

export async function updatePersistentData() {
    if (persistentDataUpdateTimeout !== null) {
        clearTimeout(persistentDataUpdateTimeout);
    }

    persistentDataUpdateTimeout = setTimeout(async () => {
        if (!loadedOnce) {
            return;
        }

        try { await flushPersistentData(); } catch { /* reported by REST */ }
    }, 200);
}

export async function setItem(name: string, value: string) {
    localStorage.setItem(name ,value);
    await updatePersistentData();
}

// Await this before a native renderer change, which may recreate the WebView.
export async function flushPersistentData():Promise<boolean> {
    if(!loadedOnce)return false;
    const writes:Promise<void>[]=[];
    for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i)!;if(transient(key))continue;
        const value=localStorage.getItem(key)!;
        if(baseline.get(key)!==value)writes.push(putPersistentStorageItem(key,value).then(()=>{baseline.set(key,value);}));
    }
    for(const key of baseline.keys())if(localStorage.getItem(key)===null)writes.push(deletePersistentStorageItem(key).then(()=>{baseline.delete(key);}));
    // Do not replace /all: another native WebView may have newer preferences or an active input handoff.
    await Promise.all(writes);
    return true;
}

// Persist a single user action before reporting success; keep the shared flush
// baseline in sync so later preference writes cannot replay an older value.
export async function savePersistentItem(key:string,value:string):Promise<void>{
    await putPersistentStorageItem(key,value);
    localStorage.setItem(key,value);baseline.set(key,value);
}
