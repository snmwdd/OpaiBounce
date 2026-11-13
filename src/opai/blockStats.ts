/** The backend supplies remaining blocks, not inventory capacity. Track the maximum seen this session. */
export class BlockStats {
    count:number|null=null;
    maximum=0;
    reset(){this.count=null;this.maximum=0;}
    update(count:number) {
        if(!Number.isFinite(count)||count<0)return;
        count=Math.floor(count);
        this.count=count;this.maximum=Math.max(this.maximum,count);
    }
    get progress(){return this.maximum?Math.max(0,Math.min(1,(this.count??0)/this.maximum)):0;}
}
