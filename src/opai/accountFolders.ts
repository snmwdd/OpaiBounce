import type {Account} from '../integration/types';
export const ACCOUNT_FOLDERS_KEY='opai.accounts.folders.v1';
export type AccountFolder={id:string;name:string;parent:string|null};
export type AccountFolderLayout={version:1;folders:AccountFolder[];assignments:Record<string,string>};
export function accountKey(account:Pick<Account,'type'|'uuid'|'username'>){return `${account.type.toLowerCase()}:${(account.uuid||account.username).toLowerCase()}`;}
export function defaultFolders(accounts:Account[]):AccountFolderLayout{return{version:1,folders:[{id:'my',name:'My',parent:null},{id:'nfa',name:'Nfa',parent:null},{id:'offline',name:'Offline',parent:null}],assignments:Object.fromEntries(accounts.map(a=>[accountKey(a),/cracked|offline/i.test(a.type)?'offline':'my']))};}
export function parseFolders(raw:string|null,accounts:Account[]):AccountFolderLayout{
    if(raw===null)return defaultFolders(accounts);
    const value=JSON.parse(raw);if(value?.version!==1||!Array.isArray(value.folders)||value.folders.length>200||!value.assignments||typeof value.assignments!=='object'||Array.isArray(value.assignments))throw new Error('Folder data is invalid. Accounts are still available in Root.');
    const ids=new Set<string>();const folders:AccountFolder[]=value.folders.map((f:any)=>{
        if(typeof f.id!=='string'||!f.id||f.id.length>80||ids.has(f.id)||typeof f.name!=='string'||!f.name.trim()||f.name.length>40||!(f.parent===null||typeof f.parent==='string'))throw new Error('Folder data is invalid. Accounts are still available in Root.');ids.add(f.id);return{id:f.id,name:f.name.trim(),parent:f.parent};
    });
    for(const folder of folders){const seen=new Set([folder.id]);let parent=folder.parent;while(parent!==null){if(!ids.has(parent)||seen.has(parent))throw new Error('Folder hierarchy is invalid. Accounts are still available in Root.');seen.add(parent);parent=folders.find(f=>f.id===parent)!.parent;}}
    const assignments:Record<string,string>=Object.create(null);for(const [key,id] of Object.entries(value.assignments)){if(key.length<=240&&typeof id==='string'&&ids.has(id))assignments[key]=id;}
    return{version:1,folders,assignments};
}
export function descendants(layout:AccountFolderLayout,id:string){const result=new Set([id]);for(let n=0;n<layout.folders.length;n++)for(const f of layout.folders)if(f.parent!==null&&result.has(f.parent))result.add(f.id);return result;}
export function folderPath(layout:AccountFolderLayout,id:string|null){const names:string[]=[];while(id!==null){const f=layout.folders.find(f=>f.id===id);if(!f)break;names.unshift(f.name);id=f.parent;}return['Root',...names].join(' / ');}
export function folderCount(layout:AccountFolderLayout,accounts:Account[],id:string){const contained=descendants(layout,id);return accounts.filter(a=>contained.has(layout.assignments[accountKey(a)])).length;}
export function checkFolderName(layout:AccountFolderLayout,name:string,parent:string|null,except?:string){name=name.trim();if(!name||name.length>40)throw new Error('Use a folder name with 1–40 characters.');if(layout.folders.some(f=>f.parent===parent&&f.id!==except&&f.name.toLocaleLowerCase()===name.toLocaleLowerCase()))throw new Error('A folder with this name already exists here.');return name;}
export function createFolder(layout:AccountFolderLayout,name:string,parent:string|null,id:string):AccountFolderLayout{
    if(!id||id.length>80||layout.folders.some(f=>f.id===id))throw new Error('Invalid folder ID.');if(parent!==null&&!layout.folders.some(f=>f.id===parent))throw new Error('Folder no longer exists.');if(layout.folders.length>=200)throw new Error('The folder limit is 200.');name=checkFolderName(layout,name,parent);return{...layout,folders:[...layout.folders,{id,name,parent}]};
}
export function renameFolder(layout:AccountFolderLayout,id:string,name:string):AccountFolderLayout{const folder=layout.folders.find(f=>f.id===id);if(!folder)throw new Error('Folder no longer exists.');name=checkFolderName(layout,name,folder.parent,id);return{...layout,folders:layout.folders.map(f=>f.id===id?{...f,name}:f)};}
export function moveFolder(layout:AccountFolderLayout,id:string,parent:string|null):AccountFolderLayout{
    const folder=layout.folders.find(f=>f.id===id);if(!folder)throw new Error('Folder no longer exists.');if(parent!==null&&(!layout.folders.some(f=>f.id===parent)||descendants(layout,id).has(parent)))throw new Error('A folder cannot be moved inside itself.');checkFolderName(layout,folder.name,parent,id);return{...layout,folders:layout.folders.map(f=>f.id===id?{...f,parent}:f)};
}
export function deleteFolder(layout:AccountFolderLayout,id:string):AccountFolderLayout{
    const folder=layout.folders.find(f=>f.id===id);if(!folder)throw new Error('Folder no longer exists.');const assignments={...layout.assignments};for(const [key,value] of Object.entries(assignments))if(value===id){if(folder.parent===null)delete assignments[key];else assignments[key]=folder.parent;}
    // Delete just the group: keep its accounts and subfolders in the parent.
    return{version:1,folders:layout.folders.filter(f=>f.id!==id).map(f=>f.parent===id?{...f,parent:folder.parent}:f),assignments};
}
export function assignAccount(layout:AccountFolderLayout,key:string,folder:string|null):AccountFolderLayout{if(folder!==null&&!layout.folders.some(f=>f.id===folder))throw new Error('Folder no longer exists.');const assignments={...layout.assignments};if(folder===null)delete assignments[key];else assignments[key]=folder;return{...layout,assignments};}
