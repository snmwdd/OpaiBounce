export function summarizeFrames(samples:number[]){
    const values=samples.filter(n=>Number.isFinite(n)&&n>0).sort((a,b)=>a-b);
    const total=values.reduce((a,b)=>a+b,0);
    return{samples:values.length,rafHz:total?values.length*1000/total:0,p95Ms:values[Math.max(0,Math.ceil(values.length*.95)-1)]??0,maxMs:values.at(-1)??0,gapsOver25Ms:values.filter(n=>n>25).length};
}
