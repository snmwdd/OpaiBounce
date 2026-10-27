// CEF hosts may suppress contextmenu. Activate on right-button down, with a
// contextmenu fallback and gesture de-duplication across Windows/macOS ordering.
export function secondaryClick(node:HTMLElement,handler:(event:MouseEvent)=>unknown){
    let pressed=false,lastRelease=-Infinity,lastActivation=-Infinity;
    const activate=(event:MouseEvent)=>{event.preventDefault();event.stopPropagation();lastActivation=performance.now();void handler(event);};
    function down(event:MouseEvent){if(event.button!==2)return;pressed=true;window.addEventListener('mouseup',up);window.addEventListener('blur',blur);activate(event);}
    function up(event:MouseEvent){if(event.button===2){pressed=false;lastRelease=performance.now();window.removeEventListener('mouseup',up);window.removeEventListener('blur',blur);}}
    function context(event:MouseEvent){
        event.preventDefault();event.stopPropagation();
        const now=performance.now();
        if(!pressed&&now-lastRelease>300&&now-lastActivation>300)activate(event);
    }
    function blur(){pressed=false;lastRelease=performance.now();window.removeEventListener('mouseup',up);window.removeEventListener('blur',blur);}
    node.addEventListener('mousedown',down);node.addEventListener('contextmenu',context);
    return{update(next:typeof handler){handler=next;},destroy(){node.removeEventListener('mousedown',down);node.removeEventListener('contextmenu',context);window.removeEventListener('mouseup',up);window.removeEventListener('blur',blur);}};
}
