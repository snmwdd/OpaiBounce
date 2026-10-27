import {usesSoftwareMotion} from './motionPlatform';
// One RAF and one watchdog per page, shared by all active animations. The
// watchdog preserves Windows windowless CEF motion when RAF is suspended.
let serial=0,raf=0,timer:ReturnType<typeof setTimeout>|undefined,flushing=false;
const pending=new Map<number,FrameRequestCallback>();
function disarm(){cancelAnimationFrame(raf);clearTimeout(timer);raf=0;timer=undefined;}
function arm(){
    if(flushing||timer!==undefined||!pending.size)return;
    raf=requestAnimationFrame(flush);
    timer=setTimeout(()=>flush(performance.now()),document.hidden?120:32);
}
function flush(now:number){
    disarm();flushing=true;
    // Requests made by a callback belong to the next frame. A callback may
    // cancel another pending callback before its turn in this batch.
    for(const [id,callback] of [...pending]){
        if(!pending.delete(id))continue;
        try{callback(now);}catch(error){queueMicrotask(()=>{throw error;});}
    }
    flushing=false;arm();
}
export function requestMotionFrame(callback:FrameRequestCallback):number{
    const id=++serial;pending.set(id,callback);arm();return id;
}
export function cancelMotionFrame(id:number){pending.delete(id);if(!pending.size)disarm();}
export type MotionHandle={cancel:()=>void;finished:Promise<unknown>};
const numbers=/-?\d*\.?\d+(?:e[+-]?\d+)?/gi;
function interpolate(a:unknown,b:unknown,t:number):string{
    const start=String(a),end=String(b),values=start.match(numbers)?.map(Number)??[];let index=0;
    return end.replace(numbers,value=>{const from=values[index++]??Number(value);return String(from+(Number(value)-from)*t);});
}
export function playMotion(node:HTMLElement,frames:Keyframe[],duration:number,easing='linear'):MotionHandle{
    // Main-thread style invalidation also works with Windows software rendering.
    if(!usesSoftwareMotion()&&typeof node.animate==='function')return node.animate(frames,{duration,easing});
    const cssName=(key:string)=>key==='borderRadius'?'border-radius':key;
    const keys=['transform','opacity','borderRadius'].filter(key=>frames.some(frame=>frame[key as keyof Keyframe]!=null));
    const previous=new Map(keys.map(key=>[key,node.style.getPropertyValue(cssName(key))]));
    let frame=0,done=false,resolve:()=>void;
    const finished=new Promise<void>(r=>resolve=r),start=performance.now();
    const clean=()=>{if(done)return;done=true;cancelMotionFrame(frame);for(const [key,value] of previous)node.style.setProperty(cssName(key),value);resolve();};
    function draw(now:number){
        let progress=Math.max(0,Math.min(1,(now-start)/duration));
        if(easing!=='linear')progress=1-Math.pow(1-progress,3);
        let right=frames.findIndex((key,i)=>Number(key.offset??i/(frames.length-1))>=progress);if(right<1)right=1;
        const a=frames[right-1],b=frames[right],lo=Number(a.offset??(right-1)/(frames.length-1)),hi=Number(b.offset??right/(frames.length-1));
        const mix=Math.max(0,Math.min(1,(progress-lo)/(hi-lo||1)));
        for(const key of keys)node.style.setProperty(cssName(key),interpolate(a[key as keyof Keyframe],b[key as keyof Keyframe],mix));
        if(now-start>=duration)clean();else frame=requestMotionFrame(draw);
    }
    draw(start);return{cancel:clean,finished};
}
