import {readable} from 'svelte/store';
import {getGameWindow} from '../integration/rest';
import {listenAlways} from '../integration/ws';

// One native snapshot and one coordinate plane per WebView. A slow HTTP reply
// must never overwrite a newer scale event; renderer quality affects CSS pixels.
export const hudGeometry=readable({ready:false,gameScale:2,density:1,scale:1,width:innerWidth,height:innerHeight},set=>{
    let alive=true,request=0,gameScale=2,density=1,ready=false,eventScale:number|undefined;
    let timer:ReturnType<typeof setTimeout>;
    function publish(){set({ready,gameScale,density,scale:gameScale/2*density,width:innerWidth,height:innerHeight});}
    async function refresh(){
        const ticket=++request;
        try{const info=await getGameWindow();if(!alive||ticket!==request)return;
            if(Number.isFinite(info.scaleFactor)&&info.scaleFactor>0&&(eventScale===undefined||info.scaleFactor===eventScale)){gameScale=info.scaleFactor;eventScale=undefined;}
            if(info.width>0&&info.height>0){const ratio=Math.min(1,innerWidth/info.width,innerHeight/info.height);if(Number.isFinite(ratio)&&ratio>0)density=ratio;}
        }catch{if(!alive||ticket!==request)return;}
        ready=true;publish();
    }
    const off=listenAlways('scaleFactorChange',event=>{if(Number.isFinite(event.scaleFactor)&&event.scaleFactor>0){gameScale=event.scaleFactor;eventScale=gameScale;publish();void refresh();}});
    function resize(){request++;publish();clearTimeout(timer);timer=setTimeout(refresh,60);}
    function visible(){if(!document.hidden)void refresh();}
    window.addEventListener('resize',resize);document.addEventListener('visibilitychange',visible);publish();void refresh();
    return()=>{alive=false;request++;off();clearTimeout(timer);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visible);};
});
