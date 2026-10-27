import type {ItemStack} from '../integration/types';
export function occupied(stack:ItemStack|undefined){return !!stack&&stack.count>0&&stack.identifier!=='minecraft:air';}
export function inventoryCounts(stacks:ItemStack[],items:string[],showEmpty:boolean){
    const counts=new Map(items.map(id=>[id.toLowerCase(),0]));
    for(const stack of stacks)if(occupied(stack)){const id=stack.identifier.toLowerCase();if(counts.has(id))counts.set(id,counts.get(id)!+stack.count);}
    return [...counts].filter(([,count])=>showEmpty||count>0).map(([identifier,count])=>({identifier,count,damage:0,maxDamage:0,displayName:identifier,enchantments:{}} as ItemStack));
}
