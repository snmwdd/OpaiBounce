import {requestMotionFrame,cancelMotionFrame,playMotion,type MotionHandle} from './animation';
import {prefersReducedMotion} from './motionPlatform';
/** A single SVG path for all 32 PCM bands: one attribute write per frame,
 * rather than 32 transform/style invalidations and 32 animated SVG layers. */
export function smoothBands(node:SVGSVGElement,values:number[]){
    let current=Array(32).fill(0),from=[...current],target=Array(32).fill(0),frame=0,start=0,last='';
    const path=node.querySelector('path')!;
    function sample(now:number){const t=prefersReducedMotion()?1:Math.min(1,(now-start)/115),ease=1-(1-t)**2;
        for(let i=0;i<32;i++)current[i]=from[i]+(target[i]-from[i])*ease;return t;
    }
    function paint(now:number){frame=0;const t=sample(now);let d='';
        for(let i=0;i<32;i++){const h=Math.round(current[i]*7000)/100;if(h<.01)continue;const x=i*15+2,y=70-h,r=Math.min(1,h/2);d+=`M${x+r} ${y}h${11-2*r}q${r} 0 ${r} ${r}v${h-2*r}q0 ${r} ${-r} ${r}h${2*r-11}q${-r} 0 ${-r} ${-r}v${2*r-h}q0 ${-r} ${r} ${-r}Z`;}
        if(d!==last){path.setAttribute('d',d);last=d;}if(t<1)frame=requestMotionFrame(paint);
    }
    function update(values:number[]){
        const next=Array.from({length:32},(_,i)=>Math.max(0,Math.min(1,Number(values[i])||0)));
        if(next.every((v,i)=>v===target[i]))return;
        const now=performance.now();if(frame)sample(now);from=[...current];target=next;start=now;
        if(!frame)frame=requestMotionFrame(paint);
    }
    update(values);
    return{update,destroy(){cancelMotionFrame(frame);}};
}
export function lyricSlide(node:HTMLElement,value:{y:number;opacity:number}){
    let running:MotionHandle|undefined,old=value;
    node.style.transform=`translateY(${value.y}px)`;node.style.opacity=String(value.opacity);
    return{update(next:typeof value){if(next.y===old.y&&next.opacity===old.opacity)return;const style=getComputedStyle(node),from={transform:`translateY(${new DOMMatrix(style.transform).f}px)`,opacity:style.opacity};running?.cancel();old=next;node.style.transform=`translateY(${next.y}px)`;node.style.opacity=String(next.opacity);if(!prefersReducedMotion())running=playMotion(node,[from,{transform:node.style.transform,opacity:node.style.opacity}],330,'ease-out');},destroy(){running?.cancel();}};
}
