// OriginalLogo.y_(): 20 Hz physics, OriginalLogo.I(): interpolate each render frame.
export class MascotPhysics {
    x:number; y:number; vx=50; vy=0; angle=0;
    private previous:{x:number;y:number;angle:number};
    private sampled:number;
    constructor(x:number,y:number,now:number){this.x=x;this.y=y;this.previous={x,y,angle:0};this.sampled=now;}
    impulse(dx:number,dy:number){this.vx+=dx;this.vy+=dy;}
    teleport(x:number,y:number){this.x=x;this.y=y;this.previous={x,y,angle:this.angle};}
    sample(now:number,width:number,height:number){
        if(now-this.sampled>=50){
            this.previous={x:this.x,y:this.y,angle:this.angle};
            // Match one native tick. Do not replay an unbounded backlog after hiding the window.
            this.sampled=now-this.sampled<100?this.sampled+50:now;
            this.x+=this.vx;this.y+=this.vy;this.angle+=Math.sign(this.vx)*Math.hypot(this.vx,this.vy);
            this.vx*=.99;this.vy*=.99;
            if(Math.abs(this.vx)>2&&(this.x+48>width||this.x<0)){this.vx*= -.8;this.x=Math.max(0,Math.min(width-48,this.x));}
            if(this.y+48>height||this.y<0){this.vy*= -.8;this.y=Math.max(0,Math.min(height-48,this.y));}
            else if(this.y+48<height)this.vy+=Math.min((height-48-this.y)/4,1);
            if(Math.abs(this.vx)<1)this.vx+=Math.sign(this.vx);
        }
        const alpha=Math.max(0,Math.min(1,(now-this.sampled)/50));
        return {x:this.previous.x+(this.x-this.previous.x)*alpha,y:this.previous.y+(this.y-this.previous.y)*alpha,angle:this.previous.angle+(this.angle-this.previous.angle)*alpha};
    }
    resume(now:number){this.sampled=now;this.previous={x:this.x,y:this.y,angle:this.angle};}
}
