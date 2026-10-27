import type {ItemStack} from '../integration/types';
export type BreakingActivity={id:string;position:number[];name:string;progress:number};
export type ContainerActivity={session:string;containerId:number;rows:number;stacks:ItemStack[];feedback:{id:string;slot:number;at:number;x?:number;y?:number}[];open:boolean;interactive:boolean};
export type IslandActivity={protocol:1;at:number;breaking:BreakingActivity|null;container:ContainerActivity|null};
const identifier=(s:unknown)=>typeof s==='string'&&/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(s);
export function parseActivity(raw:string|null,now=Date.now()):IslandActivity|null{
    try{const value=JSON.parse(raw??'null');if(value?.protocol!==1||!Number.isFinite(value.at)||now-value.at>1200||value.at-now>1000)return null;
        let breaking:BreakingActivity|null=null,container:ContainerActivity|null=null;const b=value.breaking,c=value.container;
        if(b&&identifier(b.id)&&typeof b.name==='string'&&b.name.length<=100&&Array.isArray(b.position)&&b.position.length===3&&b.position.every(Number.isFinite)&&Number.isFinite(b.progress))breaking={...b,progress:Math.max(0,Math.min(1,b.progress))};
        if(c&&typeof c.session==='string'&&c.session.length<=100&&Number.isInteger(c.containerId)&&Number.isInteger(c.rows)&&c.rows>=1&&c.rows<=6&&Array.isArray(c.stacks)&&c.stacks.length===c.rows*9&&c.stacks.every((s:any)=>identifier(s.identifier)&&Number.isInteger(s.count)&&s.count>=0&&s.count<=9999&&Number.isFinite(s.damage)&&Number.isFinite(s.maxDamage))){
            const feedback=Array.isArray(c.feedback)?c.feedback.filter((f:any)=>typeof f.id==='string'&&f.id.length<=150&&Number.isInteger(f.slot)&&f.slot>=0&&f.slot<c.stacks.length&&Number.isFinite(f.at)&&now-f.at<1400&&f.at-now<1000).slice(-54):[];
            container={session:c.session,containerId:c.containerId,rows:c.rows,stacks:c.stacks,feedback,open:c.open===true,interactive:c.interactive===true&&c.open===true};
        }
        return{protocol:1,at:value.at,breaking,container};
    }catch{return null;}
}
