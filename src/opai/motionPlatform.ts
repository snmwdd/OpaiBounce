import {writable} from 'svelte/store';

// Windows CEF inherits the OS animation flag. The requested Opai motion still
// needs to run there, using main-thread frames instead of compositor layers.
let windows=typeof navigator!=='undefined'&&/Windows|Win32|Win64/i.test(`${navigator.userAgent} ${navigator.platform}`);
export const softwareMotion=writable(windows);
function publish(){
    if(typeof document!=='undefined')document.documentElement.dataset.opaiMotion=windows?'full':'system';
}
publish();
export function setMotionPlatform(os:string){
    // Accept either positive Windows signal. A shortened UA needs the host OS;
    // compatibility UAs also need the software path even if the host says Mac.
    if(!os)return;
    const next=windows||/^win/i.test(os);
    const changed=next!==windows;windows=next;
    // Lift the CSS duration override before subscribers start their entrance.
    publish();if(changed)softwareMotion.set(windows);
}
export function usesSoftwareMotion(){return windows;}
export function prefersReducedMotion(){return !windows&&typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;}
