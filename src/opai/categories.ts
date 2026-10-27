import type {GroupedModules, Module} from '../integration/types';
// Preserve every LiquidBounce module and backend name within Opai's five columns.
export function opaiCategories(modules: Module[]): GroupedModules {
    const groups: GroupedModules = {Combat:[],Movement:[],Player:[],Visual:[],Misc:[]};
    const mapping: Record<string,string> = {combat:'Combat',movement:'Movement',player:'Player',world:'Player',render:'Visual',visual:'Visual',client:'Visual',exploit:'Misc',fun:'Misc',misc:'Misc'};
    for(const module of modules) groups[mapping[module.category.toLowerCase()] ?? 'Misc'].push(module);
    for(const group of Object.values(groups)) group.sort((a,b) => a.name.localeCompare(b.name));
    return groups;
}
