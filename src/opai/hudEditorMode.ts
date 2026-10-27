import {setHudEditorSelected} from '../integration/rest';
// Serialise the global native flag. Destroying an old editor must not complete
// its delayed false write after the next editor's true write.
let desired=false,applied:boolean|undefined,queue=Promise.resolve(),revision=0;
export function setEditorMode(selected:boolean){
    desired=selected;const ticket=++revision;
    const next=queue.catch(()=>{}).then(async()=>{
        if(ticket!==revision||applied===desired)return;
        const value=desired;await setHudEditorSelected(value);applied=value;
    });
    queue=next;return next;
}
