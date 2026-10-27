export type HSV={h:number;s:number;v:number};
export function rgbToHsv(r:number,g:number,b:number):HSV {
    r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
    let h=d===0?0:max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;
    return {h:(h*60+360)%360,s:max===0?0:d/max,v:max};
}
export function hsvToRgb(h:number,s:number,v:number):number[] {
    h=((h%360)+360)%360;const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
    const rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
    return rgb.map(channel=>Math.round((channel+m)*255));
}
