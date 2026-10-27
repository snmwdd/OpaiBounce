import {derived,get,writable,readable} from 'svelte/store';
import {listenAlways} from '../integration/ws';
import {getPersistentStorageItem} from '../integration/rest';
export type MusicTrack={id:string;name:string;artists:string[];album:string;provider:'gd'|'netease';source:string;cover:string;duration:number;picId?:string;lyricId?:string};
export type MusicWidgets={island:boolean;islandLyrics:boolean;info:boolean;lyrics:boolean;spectrum:boolean;translation:boolean};
export type MusicState={provider:''|'gd'|'netease';source:string;volume:number;repeatOne:boolean;loggedIn:boolean;profile:string;loading:boolean;playing:boolean;position:number;error:string;index:number;queueLength:number;track:MusicTrack|null;widgets?:Partial<MusicWidgets>;favoriteKeys?:string[];moduleEnabled?:boolean;lyricsMode?:string;openedAt?:number;openSequence?:number};
type Endpoint={url:string;token:string};
export const musicBridgeError=writable('');
export const musicState=writable<MusicState|null>(null),musicOpen=writable(false),musicConnection=writable<'connecting'|'missing'|'ready'>('connecting');
export const musicLyrics=writable<{time:number;text:string}[]>([]);
export const musicTranslations=writable<{time:number;text:string}[]>([]);
// Native snapshots carry a changing position even when no metadata changed.
// Keep that clock update out of the song list, cover and module widgets.
export const musicViewState=readable<Omit<MusicState,'position'>|null>(null,set=>{
    let previous='';return musicState.subscribe(state=>{
        const view=state?(({position,...rest})=>rest)(state):null,signature=JSON.stringify(view);
        if(signature!==previous){previous=signature;set(view);}
    });
});
export const musicActive=derived(musicViewState,s=>!!s?.playing&&s?.moduleEnabled!==false);
export const musicPosition=readable(0,set=>{
    let timer:ReturnType<typeof setTimeout>,state:MusicState|null=null,at=0;
    function draw(){clearTimeout(timer);const p=(state?.position??0)+(state?.playing?Math.min(1800,performance.now()-at):0);set(state?.track?.duration?Math.min(state.track.duration,p):p);if(state?.playing&&!document.hidden)timer=setTimeout(draw,50);}
    const off=musicState.subscribe(value=>{state=value;at=performance.now();draw();});
    document.addEventListener('visibilitychange',draw);
    return()=>{off();clearTimeout(timer);document.removeEventListener('visibilitychange',draw);};
});
export const musicWidgets=derived(musicViewState,state=>({island:true,islandLyrics:true,info:true,lyrics:true,spectrum:true,translation:true,...state?.widgets}));
export const musicLibrary=writable<{keyword:string;page:number;results:MusicTrack[]}>({keyword:'',page:1,results:[]});
let endpoint:Endpoint|null=null,lyricKey='',fetching=false;
async function discover(){
    try{const value=JSON.parse(await getPersistentStorageItem('opai.bridge.music')??'null');
        if(value?.protocol!==1||!/^http:\/\/127\.0\.0\.1:\d+$/.test(value.url)||typeof value.token!=='string'||value.token.length<24)throw new Error('missing');
        if(typeof value.version==='string'&&/^1\.[01]\./.test(value.version))throw new Error('音乐服务仍为旧版。请完整替换主题的 music 文件夹，然后完全退出并重新启动游戏；只重载主题无法更新 Java 音乐服务。');
        musicBridgeError.set('');endpoint={url:value.url,token:value.token};return endpoint;
    }catch(error){endpoint=null;musicConnection.set('missing');throw new Error(error instanceof Error&&error.message.startsWith('音乐服务仍')?error.message:'音乐桥接尚未启动。请确认 OpaiBounceScript.js 1.4.2 和完整主题已安装，然后完全退出并重新启动游戏。');}
}
export async function musicRequest<T=MusicState>(path:string,body?:unknown):Promise<T>{
    const host=endpoint??await discover();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),path==='/state'||path==='/spectrum'?3000:35000);
    try{const response=await fetch(host.url+path,{method:body===undefined?'GET':'POST',headers:{'X-Opai-Music':host.token,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal,credentials:'omit'});
        const result=await response.json();if(!response.ok)throw new Error(result.error??'音乐请求失败');musicConnection.set('ready');return result as T;
    }finally{clearTimeout(timer);}
}
export async function refreshMusic(){
    if(fetching)return;fetching=true;
    try{const state=await musicRequest<MusicState>('/state');musicState.set(state);const key=state.track?`${state.track.provider}:${state.track.source}:${state.track.id}`:'';
        if(key!==lyricKey){lyricKey=key;musicLyrics.set([]);musicTranslations.set([]);if(key)void musicRequest<{lyric:string;tlyric?:string}>('/lyrics').then(data=>{if(lyricKey===key){musicLyrics.set(parseLrc(data.lyric??''));musicTranslations.set(parseLrc(data.tlyric??''));}}).catch(()=>{});}
    }catch(error){endpoint=null;musicBridgeError.set(error instanceof Error&&error.message.startsWith('音乐')?error.message:'原生音乐服务没有响应，请完全退出并重新启动游戏。');musicConnection.set('missing');musicState.set(null);}finally{fetching=false;}
}
export function installMusicMonitor(){
    let alive=true,polling=false,lastOpen:number|undefined,openedFromToggle=false,timer:ReturnType<typeof setTimeout>;
    async function poll(){if(polling||!alive)return;polling=true;await refreshMusic();const state=get(musicState);if(state?.openSequence!==undefined&&state.openSequence>(lastOpen??0)&&(lastOpen!==undefined||Date.now()-(state.openedAt??0)<3000)){if(!openedFromToggle&&location.hash.includes('/clickgui'))musicOpen.set(true);openedFromToggle=false;}lastOpen=state?.openSequence;polling=false;if(alive)timer=setTimeout(poll,document.hidden?5000:get(musicOpen)||location.hash.includes('/clickgui')?500:get(musicState)?.playing?900:1500);}
    const offToggle=listenAlways('moduleToggle',event=>{if(event.moduleName==='TritiumMusic'&&event.enabled&&location.hash.includes('/clickgui')){openedFromToggle=true;musicOpen.set(true);}});
    void poll();const off=musicOpen.subscribe(open=>{if(open&&!polling){clearTimeout(timer);void poll();}});
    const wake=()=>{if(!document.hidden&&!polling){clearTimeout(timer);void poll();}};document.addEventListener('visibilitychange',wake);
    return()=>{alive=false;clearTimeout(timer);off();offToggle();document.removeEventListener('visibilitychange',wake);};
}
export async function musicSettings(settings:Partial<Pick<MusicState,'provider'|'source'|'volume'|'repeatOne'|'widgets'>>){const value=await musicRequest('/settings',settings);musicState.set(value);}
export function musicKey(track:MusicTrack){return`${track.provider}:${track.source}:${track.id}`;}
export async function favoriteMusic(track:MusicTrack,liked:boolean){musicState.set(await musicRequest('/favorite',{track,liked}));}
export async function musicTransport(action:string,position?:number){musicState.set(await musicRequest('/transport',{action,position}));}
export async function playMusic(tracks:MusicTrack[],index:number){musicState.set(await musicRequest('/play',{tracks,index}));}
export function parseLrc(value:string){
    const lines:{time:number;text:string}[]=[];
    for(const row of value.split(/\r?\n/).slice(0,3000)){const text=row.replace(/\[[^\]]+\]/g,'').trim();for(const stamp of row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g))lines.push({time:(Number(stamp[1])*60+Number(stamp[2]))*1000,text});}
    return lines.sort((a,b)=>a.time-b.time);
}
export function currentLyric(lines:{time:number;text:string}[],at:number){let result='';for(const line of lines){if(line.time>at)break;result=line.text;}return result;}
// Primitive derived values prevent the 20Hz playback clock from invalidating
// the full player, island, or lyric row list between actual cue changes.
export const musicLyricIndex=derived([musicLyrics,musicPosition],([lines,at])=>{
    let lo=0,hi=lines.length;while(lo<hi){const mid=(lo+hi)>>>1;if(lines[mid].time<=at)lo=mid+1;else hi=mid;}return lo-1;
});
export const musicCurrentLyric=derived([musicLyrics,musicLyricIndex],([lines,index])=>lines[index]?.text??'');
export const musicTrackTitle=derived(musicState,state=>state?.track?.name??'歌词预览');
export function musicTime(ms:number){if(!Number.isFinite(ms)||ms<0)return'0:00';const s=Math.floor(ms/1000);return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
