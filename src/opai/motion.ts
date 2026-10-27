import {requestMotionFrame,cancelMotionFrame} from './animation';
// Geometry and timing ported from the supplied Opai UI Shell (Ek, oK, oQ/oR).
export const quintOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 5);
export const cubicOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
// oE: retarget from the sampled value, rather than restarting from zero.
export class Tween {
    current = 0; target = 0; from = 0; started = 0; done = true;
    constructor(public duration: number, public easing = cubicOut, initial = 0) { this.current = this.target = this.from = initial; }
    reset(value: number, now: number) { this.current = this.target = this.from = value; this.started = now; this.done = true; }
    to(value: number, now: number) { if(value !== this.target) { this.from = this.current; this.target = value; this.started = now; this.done = false; } }
    progress(now: number) { return Math.min(1,Math.max(0,(now-this.started)/this.duration)); }
    tick(now: number) { this.done = now-this.started >= this.duration; this.current = this.done ? this.target : this.from+(this.target-this.from)*this.easing(this.progress(now)); return this.current; }
}
// DynamicIslandState.Morph: exact damped oscillator, including reversal velocity.
export class Morph {
    current = 0; target = 0; velocity = 0; sampled = -1;
    value(destination: number, now: number, reducedMotion = false, impulse = 0) {
        if (this.sampled < 0 || reducedMotion) {
            this.current = this.target = destination; this.velocity = 0;
        } else {
            const seconds = Math.max(0, now - this.sampled) / 1000;
            const displacement = this.current - this.target;
            const coefficient = (this.velocity + 8.7 * displacement) / 8;
            const cosine = Math.cos(8 * seconds), sine = Math.sin(8 * seconds), decay = Math.exp(-8.7 * seconds);
            const offset = displacement * cosine + coefficient * sine;
            this.current = this.target + decay * offset;
            this.velocity = decay * (-8.7 * offset + 8 * (-displacement * sine + coefficient * cosine));
            if (destination !== this.target) {
                this.target = destination;
                if (Math.abs(this.velocity) < Math.max(.1, Math.abs(destination - this.current) * .1)) this.velocity = (destination - this.current) * impulse;
            }
            if (Math.abs(this.current - this.target) < .01 && Math.abs(this.velocity) < .1) { this.current = this.target; this.velocity = 0; }
        }
        this.sampled = now;
        return this.current;
    }
    get settled() { return this.current === this.target && this.velocity === 0; }
}
// analysis/menu-original/oG.java: one step per timer sample, never catch up skipped frames.
export class SpriteClock {
    frame = -1;
    private sampled = 0;
    start(now: number) { this.frame = 0; this.sampled = now; }
    tick(now: number) {
        if (this.frame >= 0 && now - this.sampled >= 60) {
            this.sampled = now;
            if (++this.frame > 16) this.frame = -1;
        }
        return this.frame;
    }
}
export function ripple(node: HTMLElement) {
    const active = new Set<() => void>();
    function press(e: PointerEvent) {
        if (e.button !== 0 || (node as HTMLButtonElement).disabled) return;
        const rect = node.getBoundingClientRect();
        const x = (e.clientX - rect.left) * node.offsetWidth / rect.width;
        const y = (e.clientY - rect.top) * node.offsetHeight / rect.height;
        const maximum = 2 * Math.hypot(Math.max(x, node.offsetWidth-x), Math.max(y, node.offsetHeight-y));
        const wave = document.createElement('span');
        wave.className = 'opai-ripple';
        wave.style.left = `${x}px`; wave.style.top = `${y}px`;
        wave.style.width = wave.style.height = `${maximum}px`;
        node.appendChild(wave);
        const start = performance.now();
        let releaseAt = -1, frame = 0;
        const release = () => { if (releaseAt < 0) { releaseAt = performance.now(); if (!frame) frame = requestMotionFrame(draw); } };
        function clean() { cancelMotionFrame(frame); wave.remove(); window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); active.delete(clean); }
        active.add(clean);
        window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
        function draw(now: number) {
            frame = 0;
            const t = cubicOut((now - start) / 800);
            wave.style.transform = `translate(-50%,-50%) scale(${t})`;
            const fade = releaseAt < 0 ? 0 : Math.min(1, (now-releaseAt)/240);
            wave.style.opacity = String(.3 * (1-fade));
            if (fade >= 1) clean(); else if (t < 1 || releaseAt >= 0) frame = requestMotionFrame(draw);
        }
        frame = requestMotionFrame(draw);
    }
    node.addEventListener('pointerdown', press);
    return {destroy() { node.removeEventListener('pointerdown', press); active.forEach(clean => clean()); }};
}

// Damped growth from a compact panel, preserving the requested spring overshoot.
export function openingScale(milliseconds:number){const seconds=Math.max(0,milliseconds)/1000;return seconds>=.32?1:1-.42*Math.exp(-17*seconds)*Math.cos(23*seconds);}
// OpaiMotion.approach, used for clipped sections instead of scaling their controls.
export class Approach {
    target:number;
    sampled=-1;
    constructor(public current:number,public rate=40){this.target=current;}
    value(destination:number,now:number){
        if(this.sampled>=0)this.current=this.target+(this.current-this.target)*Math.exp(-this.rate*Math.max(0,now-this.sampled)/1000);
        this.sampled=now;this.target=destination;
        if(Math.abs(this.current-destination)<.0005)this.current=destination;
        return this.current;
    }
    get settled(){return this.current===this.target;}
}

// Sample the original spring for WAAPI; the compositor interpolates between samples.
export function openingKeyframes():Keyframe[]{
    const times=Array.from({length:39},(_,i)=>Math.min(320,i*1000/120));
    times.push(320);
    return times.map(time=>({offset:time/320,transform:`scale(${openingScale(time)})`,opacity:time===320?1:1-Math.exp(-30*time/1000)}));
}

// Pre-sample island geometry once, then let CEF's compositor advance the spring.
export function islandKeyframes(from:{x:number;y:number;width:number;height:number},to:{x:number;y:number;width:number;height:number},layout:{width:number;height:number},duration=560){
    const springs=['x','y','width','height'].map(key=>{const motion=new Morph();motion.value(from[key as keyof typeof from],0);motion.value(to[key as keyof typeof to],0,false,7.25);return motion;});
    const box:Keyframe[]=[],ink:Keyframe[]=[];const count=Math.ceil(duration/(1000/120));
    for(let i=0;i<=count;i++){
        const offset=i/count,time=offset*duration*1.65;
        const values=springs.map((spring,index)=>i===count?to[['x','y','width','height'][index] as keyof typeof to]:spring.value(spring.target,time));
        const [x,y,width,height]=values,sx=Math.max(.001,width/layout.width),sy=Math.max(.001,height/layout.height);
        box.push({offset,transform:`translate3d(${x}px,${y}px,0) scale(${sx},${sy})`});
        ink.push({offset,transform:`scale(${1/sx},${1/sy})`});
    }
    return {box,ink,duration};
}
