/** The backend supplies remaining blocks, not inventory capacity. Track the maximum seen this session. */
export class BlockStats {
    count:number|null=null;
    maximum=0;
    private samples:{at:number;used:number}[]=[];
    private since=0;
    reset(){this.count=null;this.maximum=0;this.samples=[];this.since=0;}
    update(count:number,now=performance.now()) {
        if(!Number.isFinite(count)||count<0)return;
        count=Math.floor(count);
        if(this.count===null)this.since=now;
        else if(count<this.count)this.samples.push({at:now,used:this.count-count});
        this.count=count;this.maximum=Math.max(this.maximum,count);
    }
    rate(now=performance.now()) {
        this.samples=this.samples.filter(s=>now-s.at<2000);
        return this.samples.reduce((total,s)=>total+s.used,0)/Math.max(1,Math.min(2,(now-this.since)/1000));
    }
    get progress(){return this.maximum?Math.max(0,Math.min(1,(this.count??0)/this.maximum)):0;}
}
