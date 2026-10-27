import {requestMotionFrame,cancelMotionFrame} from './animation';
import {writable} from 'svelte/store';
import {softwareMotion,setMotionPlatform,prefersReducedMotion,usesSoftwareMotion} from './motionPlatform';
import {Tween,quintOut} from './motion';

const rotation=new Tween(700,quintOut),phase=new Tween(630,quintOut),zoom=new Tween(700,quintOut);
export const menuMotion=writable({rotation:0,phase:0,zoom:0});
export const menuAnimating=writable(false);
const KEY='opai.menu.handoff';
export const softwareMenu=softwareMotion;
export const setMenuPlatform=setMotionPlatform;
type SavedTween={current:number;from:number;target:number;elapsed:number;duration:number};
type Handoff={at:number;toList:boolean;tweens:SavedTween[]};
let frame=0,destination=false,pending:Handoff|null=null;
const tweens=[rotation,phase,zoom];
function clearHandoff(){pending=null;try{sessionStorage.removeItem(KEY);}catch{}}
export function stopMenuMotion(){cancelMotionFrame(frame);frame=0;menuAnimating.set(false);}
function publish(){menuMotion.set({rotation:rotation.current,phase:phase.current,zoom:zoom.current});}
function hold(toList:boolean,now:number){
    pending={at:Date.now(),toList,tweens:tweens.map(t=>({current:t.current,from:t.from,target:t.target,elapsed:Math.max(0,Math.min(t.duration,now-t.started)),duration:t.duration}))};
    try{sessionStorage.setItem(KEY,JSON.stringify(pending));}catch{}
    menuAnimating.set(false);
}
function animate(cross?:()=>void){
    const now=performance.now();
    // Keep the explicitly requested menu flip on Windows, even when the OS
    // advertises reduced motion. Its software projection needs no 3D compositor.
    menuAnimating.set(true);
    function draw(time:number){
        frame=0;let at=prefersReducedMotion()?now+1000:time;
        // A slow native frame can pass the edge by many degrees. Hand off at
        // the edge's exact tween time so the outgoing face cannot open again.
        if(cross){
            const edge=Math.max(0,Math.min(1,(-90-rotation.from)/(rotation.target-rotation.from||1)));
            const edgeTime=rotation.started+rotation.duration*(1-Math.pow(1-edge,1/5));
            at=Math.min(at,edgeTime);
        }
        tweens.forEach(t=>t.tick(at));publish();
        if(cross&&Math.abs(rotation.current+90)<.001){
            hold(destination,at);const next=cross;cross=undefined;next();return;
        }
        const active=tweens.some(t=>!t.done);menuAnimating.set(active);
        if(active)frame=requestMotionFrame(draw);
    }
    frame=requestMotionFrame(draw);
}
function resume(toList:boolean){
    let saved=pending;
    if(!saved)try{saved=JSON.parse(sessionStorage.getItem(KEY)??'null');}catch{}
    clearHandoff();
    if(!saved||saved.toList!==toList||!Number.isFinite(saved.at)||Math.abs(Date.now()-saved.at)>5000||!Array.isArray(saved.tweens)||saved.tweens.length!==3)return false;
    if(!saved.tweens.every(t=>[t.current,t.from,t.target,t.elapsed,t.duration].every(Number.isFinite)&&t.duration>0&&t.duration<=1000&&t.elapsed>=0&&t.elapsed<=t.duration))return false;
    stopMenuMotion();destination=toList;const now=performance.now();
    saved.tweens.forEach((saved,i)=>{const t=tweens[i];t.current=saved.current;t.from=saved.from;t.target=saved.target;t.duration=saved.duration;t.started=now-saved.elapsed;t.done=saved.elapsed>=saved.duration;});
    publish();animate();return true;
}
export function enterTitle(){if(!resume(false))transitionMenu(false);}
export function enterList(){
    if(resume(true))return;
    if(destination){if(!frame&&rotation.current!==-180)transitionMenu(true);return;}
    // A new native WebView has no previous in-memory clock. Start from the
    // exposed back face instead of replacing the incoming page with its end pose.
    stopMenuMotion();const now=performance.now();rotation.reset(-88,now);phase.reset(.8,now);zoom.reset(.8,now);publish();transitionMenu(true);
}
export function transitionMenu(toList:boolean,cross?:()=>void){
    const wasRunning=frame!==0;stopMenuMotion();clearHandoff();destination=toList;
    const now=performance.now();
    if(wasRunning)tweens.forEach(t=>t.tick(now));
    phase.duration=toList?630:840;
    rotation.to(toList?-180:0,now);phase.to(toList?1:0,now);zoom.to(toList?1:0,now);
    animate(cross);
}
// Project the rotating plane onto a 2D matrix in Windows CEF software mode.
// The cosine narrows it to an edge; the sine supplies the perspective slant.
export function menuTransform(angle:number,sx:number,sy?:number){
    const vertical=sy??sx;
    if(!usesSoftwareMotion())return `translateX(-50%) perspective(600px) rotateY(${angle}deg) scale(${sy==null?sx:`${sx},${sy}`})`;
    const radians=angle*Math.PI/180;
    // Each route paints its own front face; a negative X scale mirrors its text.
    const cosine=Math.abs(Math.cos(radians))<1e-6?0:Math.abs(Math.cos(radians));
    const sine=Math.abs(Math.sin(radians))<1e-6?0:Math.sin(radians);
    return `translateX(-50%) matrix(${cosine*sx},0,${sine*.08*vertical},${vertical},0,0)`;
}
