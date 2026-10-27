export interface DragOptions {
    scale:()=>number;
    get:()=>{x:number;y:number};
    move:(x:number,y:number)=>void;
    end:()=>void;
    start?:()=>void;
}
// Keep the gesture even when the cursor leaves the header or crosses another panel.
export function drag(node:HTMLElement,options:DragOptions){
    let pointer=-1,startX=0,startY=0,origin={x:0,y:0};
    function press(e:PointerEvent){
        if((e.button!==0&&e.button!==1)||(e.target as HTMLElement).closest('button,input,a'))return;
        e.preventDefault();pointer=e.pointerId;startX=e.clientX;startY=e.clientY;origin=options.get();
        node.setPointerCapture(pointer);options.start?.();
    }
    function move(e:PointerEvent){if(e.pointerId!==pointer)return;e.preventDefault();const scale=options.scale();options.move(origin.x+(e.clientX-startX)/scale,origin.y+(e.clientY-startY)/scale);}
    function end(e:PointerEvent){if(e.pointerId!==pointer)return;pointer=-1;if(node.hasPointerCapture(e.pointerId))node.releasePointerCapture(e.pointerId);options.end();}
    node.addEventListener('pointerdown',press);node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
    return{update(next:DragOptions){options=next;},destroy(){node.removeEventListener('pointerdown',press);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);}};
}
