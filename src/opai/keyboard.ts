export type VirtualKey={label:string;key:string;units:number};
const key=(label:string,name:string,units=1):VirtualKey=>({label,key:`key.keyboard.${name}`,units});
const letters=(text:string)=>[...text].map(c=>key(c,c.toLowerCase()));
export const keyboard:VirtualKey[][]=[
    [key('~','grave.accent'),...letters('1234567890'),key('-','minus'),key('=','equal'),key('BackSpace','backspace',2.2)],
    [key('Tab','tab',1.4),...letters('QWERTYUIOP'),key('[','left.bracket'),key(']','right.bracket'),key('\\','backslash',1.8)],
    [key('Caps','caps.lock',1.7),...letters('ASDFGHJKL'),key(';','semicolon'),key("'",'apostrophe'),key('Enter','enter',2.5)],
    [key('Shift','left.shift',2),...letters('ZXCVBNM'),key(',','comma'),key('.','period'),key('/','slash'),key('Right Shift','right.shift',3.2)],
    [key('Ctrl','left.control',1.3),key('Win','left.win'),key('Alt','left.alt',1.3),key('Space','space',8),key('R Alt','right.alt',1.3),key('Right Ctrl','right.control',2.3)]
];
const codes:Record<string,string>={Escape:'escape',Backquote:'grave.accent',Minus:'minus',Equal:'equal',Backspace:'backspace',Tab:'tab',BracketLeft:'left.bracket',BracketRight:'right.bracket',Backslash:'backslash',CapsLock:'caps.lock',Semicolon:'semicolon',Quote:'apostrophe',Enter:'enter',ShiftLeft:'left.shift',ShiftRight:'right.shift',Comma:'comma',Period:'period',Slash:'slash',ControlLeft:'left.control',ControlRight:'right.control',MetaLeft:'left.win',MetaRight:'right.win',AltLeft:'left.alt',AltRight:'right.alt',Space:'space',Delete:'delete',Insert:'insert',Home:'home',End:'end',PageUp:'page.up',PageDown:'page.down',ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
export function keyboardCode(code:string):string|undefined {
    const name=codes[code]??(/^Key[A-Z]$/.test(code)?code.slice(3).toLowerCase():/^Digit[0-9]$/.test(code)?code.slice(5):/^F\d{1,2}$/.test(code)?code.toLowerCase():undefined);
    return name?`key.keyboard.${name}`:undefined;
}
