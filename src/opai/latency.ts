// Saturated green -> yellow -> orange -> red; interpolate without hard jumps.
const stops=[{ms:0,rgb:[74,242,135]},{ms:100,rgb:[218,238,65]},{ms:250,rgb:[255,183,55]},{ms:400,rgb:[255,149,49]},{ms:800,rgb:[255,79,89]}];
export function latencyColor(milliseconds:number){
    const ms=Math.max(0,Number.isFinite(milliseconds)?milliseconds:0);
    const right=stops.findIndex(stop=>stop.ms>=ms);
    if(right===0)return `rgb(${stops[0].rgb.join(',')})`;
    if(right<0)return `rgb(${stops.at(-1)!.rgb.join(',')})`;
    const a=stops[right-1],b=stops[right],mix=(ms-a.ms)/(b.ms-a.ms);
    return `rgb(${a.rgb.map((value,i)=>Math.round(value+(b.rgb[i]-value)*mix)).join(',')})`;
}
