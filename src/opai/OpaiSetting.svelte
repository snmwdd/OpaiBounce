<script lang="ts">
    import {createEventDispatcher,onDestroy} from 'svelte';
    import {openFileDialog,getRegistryItems,setTyping} from '../integration/rest';
    import {listen} from '../integration/ws';
    import {spaceSeperatedNames} from '../theme/theme_config';
    import ColorPicker from './ColorPicker.svelte';
    import VectorIcon from './VectorIcon.svelte';
    import Reveal from './Reveal.svelte';
    export let setting: any;
    export let path = '';
    const dispatch = createEventDispatcher();
    let expanded=false, binding=false, draft='', entries:{name:string;value:string;icon?:string}[]=[], registryLoaded=false;
    let curve:SVGSVGElement, draggingPoint=-1;
    $: type=setting.valueType;
    $: numeric=type==='FLOAT'||type==='INT';
    $: range=type==='FLOAT_RANGE'||type==='INT_RANGE';
    $: group=type==='CONFIGURABLE'||type==='TOGGLEABLE';
    $: enabledSetting=type==='TOGGLEABLE' ? setting.value.find((v:any)=>v.name==='Enabled') : undefined;
    $: children=group ? setting.value.filter((v:any)=>v!==enabledSetting) : type==='CHOICE' ? setting.choices?.[setting.active]?.value ?? [] : [];
    $: choices=type==='CHOICE' ? Object.keys(setting.choices??{}) : setting.choices ?? [];
    $: low=Number(setting.range?.from ?? setting.range?.min ?? 0);
    $: high=Number(setting.range?.to ?? setting.range?.max ?? 1);
    $: step=type.startsWith('INT') ? 1 : (high-low>100 ? .1 : high-low<=1 ? .001 : .01);
    function label(value:unknown){const s=String(value ?? '');return $spaceSeperatedNames?s.replace(/([a-z0-9])([A-Z])/g,'$1 $2'):s;}
    function changed(){setting={...setting};dispatch('change');}
    function set(value:any){setting={...setting,value};dispatch('change');}
    function scalar(event:Event,commit:boolean){setting={...setting,value:Number((event.target as HTMLInputElement).value)};if(commit)dispatch('change');}
    function rangeValue(event:Event,key:'from'|'to',commit:boolean){
        const value=Number((event.target as HTMLInputElement).value);
        const current={...setting.value,[key]:value};
        if(current.from>current.to)current[key==='from'?'to':'from']=value;
        setting={...setting,value:current};if(commit)dispatch('change');
    }
    async function toggle(){
        expanded=!expanded;
        if(expanded && setting.registry && !registryLoaded){
            try{const items=await getRegistryItems(setting.registry);entries=Object.entries(items).map(([value,item]:[string,any])=>({value,name:item.name??value,icon:item.icon}));registryLoaded=true;}catch{}
        }
    }
    function choose(value:string){
        if(type==='CHOICE'){setting={...setting,active:value};expanded=false;dispatch('change');}
        else if(type==='CHOOSE'){set(value);expanded=false;}
        else {const values=Array.isArray(setting.value)?setting.value:[];if(values.includes(value)){if(values.length===1 && setting.canBeNone===false)return;set(values.filter((v:string)=>v!==value));}else set([...values,value]);}
    }
    async function pickFile(){try{const result=await openFileDialog({mode:setting.dialogMode??'OPEN_FILE',supportedExtensions:setting.supportedExtensions});if(result.file)set(result.file);}catch{}}
    function bind(){binding=!binding;setTyping(binding).catch(()=>{});}
    async function capture(key:string){if(!binding)return;binding=false;if(type==='BIND')set({...setting.value,boundKey:key,modifiers:[]});else set(key);await setTyping(false);}
    listen('keyboardKey',event=>{if(binding && event.action===1)capture(event.keyCode===27||event.keyCode===8?'key.keyboard.unknown':event.key);});
    listen('mouseButton',event=>{if(binding && event.action===1 && event.button!==1)capture(event.key);});
    onDestroy(()=>{if(binding)setTyping(false).catch(()=>{});});

    function vector(event:Event,axis:string){set({...setting.value,[axis]:Number((event.target as HTMLInputElement).value)});}
    function addList(){if(!draft.trim())return;set([...(setting.value??[]),draft.trim()]);draft='';}
    function movePoint(event:PointerEvent){if(draggingPoint<0)return;const b=curve.getBoundingClientRect(),xr=setting.xAxis.range,yr=setting.yAxis.range;const x0=xr.from??xr.min,x1=xr.to??xr.max,y0=yr.from??yr.min,y1=yr.to??yr.max;const points=setting.value.map((p:any,i:number)=>i===draggingPoint?{x:x0+Math.max(0,Math.min(1,(event.clientX-b.left)/b.width))*(x1-x0),y:y0+(1-Math.max(0,Math.min(1,(event.clientY-b.top)/b.height)))*(y1-y0)}:p);setting={...setting,value:points};}
    function releasePoint(){if(draggingPoint>=0){draggingPoint=-1;dispatch('change');}}
    function point(p:any){const xr=setting.xAxis.range,yr=setting.yAxis.range,x0=xr.from??xr.min,x1=xr.to??xr.max,y0=yr.from??yr.min,y1=yr.to??yr.max;return {x:(p.x-x0)/(x1-x0)*264,y:120-(p.y-y0)/(y1-y0)*120};}
</script>
<svelte:window on:pointermove={movePoint} on:pointerup={releasePoint}/>
<div class="opai-setting" data-setting={setting.name} data-type={type}>
    {#if type==='BOOLEAN'}
        <label class="boolean"><span class="setting-label" title={label(setting.name)}>{label(setting.name)}</span><input type="checkbox" checked={setting.value} on:change={e=>set(e.currentTarget.checked)}/><span class="box" aria-hidden="true"><span class="knob">{#if setting.value}<VectorIcon name="check" size={12}/>{/if}</span></span></label>
    {:else if numeric}
        <div class="number"><div class="number-label"><label class="setting-label" title={label(setting.name)} for={`${path}.${setting.name}`}>{label(setting.name)}</label><input class="number-value" aria-label="{label(setting.name)} value" type="number" value={setting.value} {step} on:change={e=>scalar(e,true)}/>{#if setting.suffix}<span>{setting.suffix}</span>{/if}</div><input id={`${path}.${setting.name}`} class="slider" type="range" min={Math.min(low,setting.value)} max={Math.max(high,setting.value)} {step} value={setting.value} style:--fill="{Math.max(0,Math.min(100,(setting.value-low)/(high-low)*100))}%" on:input={e=>scalar(e,false)} on:change={e=>scalar(e,true)}/></div>
    {:else if range}
        <div class="number-label"><span class="setting-label" title={label(setting.name)}>{label(setting.name)}</span><span class="range-values">{setting.value.from} – {setting.value.to}</span></div>{#each ['from','to'] as axis}<input aria-label="{label(setting.name)} {axis}" class="slider" type="range" min={low} max={high} {step} value={setting.value[axis]} on:input={e=>rangeValue(e,axis as 'from'|'to',false)} on:change={e=>rangeValue(e,axis as 'from'|'to',true)}/>{/each}
    {:else if type==='CHOOSE'||type==='CHOICE'||type==='MULTI_CHOOSE'||type==='ITEM_LIST'||type==='REGISTRY_LIST'||type==='REGISTRY_MUTABLE_LIST'}
        <div class="field-label" title={label(setting.name)}>{label(setting.name)}</div><button class="field choice-field" aria-expanded={expanded} on:click={toggle}><span>{type==='CHOICE'?label(setting.active):Array.isArray(setting.value)?setting.value.map(label).join(', '):label(setting.value)}</span></button>
        <Reveal visible={expanded}><div class="options choice-options">{#each type==='ITEM_LIST'?setting.items:setting.registry?entries:choices.map((value:string)=>({value,name:value})) as option}<button class="option" class:chosen={Array.isArray(setting.value)?setting.value.includes(option.value):(type==='CHOICE'?setting.active:setting.value)===option.value} on:click={()=>choose(option.value)}>{#if (Array.isArray(setting.value)?setting.value.includes(option.value):(type==='CHOICE'?setting.active:setting.value)===option.value)}<VectorIcon name="check" size={13}/>{/if}{#if option.icon}<img src={option.icon} alt="" width="16" height="16"/>{/if}<span>{label(option.name)}</span></button>{/each}</div></Reveal>
        {#if type==='CHOICE'&&children.length}<div class="nested">{#each children as child,i}<svelte:self path={`${path}.${setting.name}.${setting.active}`} bind:setting={setting.choices[setting.active].value[i]} on:change={changed}/>{/each}</div>{/if}
    {:else if group}
        <div class="group-head">{#if enabledSetting}<label class="boolean"><span class="setting-label" title={label(setting.name)}>{label(setting.name)}</span><input type="checkbox" bind:checked={enabledSetting.value} on:change={changed}/><span class="box" aria-hidden="true"><span class="knob">{#if enabledSetting.value}<VectorIcon name="check" size={12}/>{/if}</span></span></label>{:else}<span class="setting-label" title={label(setting.name)}>{label(setting.name)}</span>{/if}<button class="group-expand" aria-label="Expand {label(setting.name)}" aria-expanded={expanded} on:click={()=>expanded=!expanded}><span class="chevron" class:expanded><VectorIcon name="back" size={16}/></span></button></div>
        <Reveal visible={expanded}><div class="nested">{#each setting.value as child,i}{#if child!==enabledSetting}<svelte:self path={`${path}.${setting.name}`} bind:setting={setting.value[i]} on:change={changed}/>{/if}{/each}</div></Reveal>
    {:else if type==='TEXT'}<label class="field-label" for={`${path}.${setting.name}`}>{label(setting.name)}</label><input class="field" id={`${path}.${setting.name}`} value={setting.value} on:change={e=>set(e.currentTarget.value)}/>
    {:else if type==='FILE'}<div class="field-label" title={label(setting.name)}>{label(setting.name)}</div><button class="field" on:click={pickFile}>{setting.value||'Choose file'}</button>
    {:else if type==='KEY'||type==='BIND'}<button class="field bind" on:click={bind}><span class="setting-label" title={label(setting.name)}>{label(setting.name)}</span><span>{binding?'Press a key':(type==='BIND'?setting.value?.boundKey:setting.value)?.replace('key.keyboard.','')??'None'}</span></button>{#if type==='BIND'}<div class="options actions">{#each ['Toggle','Hold','Smart'] as action}<button class:chosen={setting.value.action===action} on:click={()=>set({...setting.value,action})}>{action}</button>{/each}</div>{/if}
    {:else if type==='COLOR'}<div class="field-label" title={label(setting.name)}>{label(setting.name)}</div><ColorPicker label={label(setting.name)} bind:value={setting.value} on:change={changed}/>
    {:else if type.startsWith('VECTOR')}<div class="field-label" title={label(setting.name)}>{label(setting.name)}</div><div class="vector">{#each Object.keys(setting.value) as axis}<label>{axis}<input type="number" value={setting.value[axis]} step={type.endsWith('_I')?1:.01} on:change={e=>vector(e,axis)}/></label>{/each}</div>
    {:else if type==='CURVE'}<button class="field" on:click={()=>expanded=!expanded}>{label(setting.name)}</button>{#if expanded}<svg class="curve" bind:this={curve} viewBox="0 0 264 120" aria-label={label(setting.name)}><polyline points={setting.value.map((p:any)=>{const q=point(p);return `${q.x},${q.y}`;}).join(' ')} fill="none" stroke="var(--accent-color)" stroke-width="2"/>{#each setting.value as p,i}<circle role="button" tabindex="0" aria-label="Curve point {i+1}" on:keydown={e=>{if(e.key==='Enter')draggingPoint=i;}} cx={point(p).x} cy={point(p).y} r="5" fill="var(--accent-color)" on:pointerdown={()=>draggingPoint=i}/>{/each}</svg>{/if}
    {:else if Array.isArray(setting.value)}<div class="field-label" title={label(setting.name)}>{label(setting.name)}</div><div class="options">{#each setting.value as value,i}<button class="option" on:click={()=>set(setting.value.filter((_:unknown,index:number)=>index!==i))}><span>{String(value)}</span><VectorIcon name="close" size={12}/></button>{/each}</div><form class="list-add" on:submit|preventDefault={addList}><input class="field" aria-label="Add {label(setting.name)}" bind:value={draft}/><button aria-label="Add value"><VectorIcon name="plus" size={14}/></button></form>
    {:else}<div class="field-label" title={label(setting.name)}>{label(setting.name)}</div><span>{String(setting.value)}</span>{/if}
</div>
<style>
    .opai-setting{font:400 16.6px 'Google Sans','Opai CJK',sans-serif;color:#ede0de;min-width:0}.setting-label{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;line-height:26px}.boolean>span:first-child{flex:1}.range-values{flex:none;white-space:nowrap}.boolean{position:relative;display:flex;align-items:center;justify-content:space-between;min-height:39.2px;cursor:pointer;gap:8px}.boolean input{position:absolute;opacity:0;width:52px;height:32px;right:0;margin:0;cursor:pointer}.box{position:relative;flex-shrink:0;width:52px;height:32px;border:2px solid #9e8d8b;border-radius:16px;background:#2e2625;color:var(--accent-color);pointer-events:none;transition:background-color 120ms,border-color 120ms}.knob{position:absolute;left:2px;top:2px;width:24px;height:24px;border-radius:12px;background:#cdb7b4;display:grid;place-items:center;transition:transform 120ms,background-color 120ms}.boolean input:checked+.box{border-color:var(--accent-color);background:var(--accent-color)}.boolean input:checked+.box .knob{transform:translateX(20px);background:#5f150f}.boolean input:active+.box .knob{width:30px}.boolean input:checked:active+.box .knob{transform:translateX(14px)}.boolean input:focus-visible+.box{outline:1px solid var(--accent-color);outline-offset:3px}.number{height:40px}.number-label{display:flex;align-items:center;gap:4px;height:26px;font-size:inherit}.number-label>:first-child{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.number-label>span:last-child{flex:none;white-space:nowrap}.number-value{flex:none;width:58px;text-align:right;color:inherit;font:inherit;background:none;border:0;appearance:textfield;min-width:0}.number-value::-webkit-inner-spin-button{appearance:none}.slider{appearance:none;display:block;width:100%;height:5px;border:0;border-radius:4px;background:linear-gradient(to right,var(--accent-color) var(--fill,0%),#56413e var(--fill,0%));margin:3px 0 10px;cursor:pointer}.slider::-webkit-slider-thumb{appearance:none;width:16px;height:16px;border-radius:50%;background:var(--accent-color);border:0}.field-label{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:32px;min-height:32px}.field{display:flex;align-items:center;justify-content:space-between;width:100%;min-width:0;height:42px;padding:0 12px;background:#2e2625;border:0;border-bottom:2px solid #cdb7b4;border-radius:4px 4px 0 0;color:inherit;font:inherit;text-align:left;margin-bottom:6px;cursor:pointer}.field>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.field[aria-expanded=true],.field:focus{border-bottom-color:var(--accent-color)}.chevron{display:block;transform:rotate(-90deg);transition:transform 160ms ease}.chevron.expanded{transform:rotate(90deg)}.options{max-height:240px;overflow:auto;background:#2e2625;border-radius:0 0 4px 4px;margin-top:-6px;margin-bottom:6px}.option{display:flex;align-items:center;justify-content:flex-start;gap:8px;width:100%;min-height:40px;color:inherit;background:none;font:inherit;text-align:left;border:0;padding:6px 12px;cursor:pointer}.option.chosen{background:#483a37;color:inherit}.choice-field,.choice-options{width:calc(100% + 8px);margin-left:-4px}.option:hover{background:#483a3780}.nested{padding-left:0}.group-head{display:flex;align-items:center;min-height:39.2px}.group-head>label,.group-head>span{flex:1;min-width:0}.group-head .boolean{margin-right:8px}.group-expand{display:grid;place-items:center;flex:none;width:24px;align-self:stretch;border:0;background:none;color:#cdb7b4;cursor:pointer}.bind{border-bottom-width:1px;height:39.2px;background:#2e2625}.actions{display:flex;margin-top:0}.actions button{font:inherit;flex:1;padding:6px;border:0;color:inherit;background:transparent;cursor:pointer}.actions button.chosen{color:var(--accent-color)}.vector{display:flex;gap:5px}.vector label{min-width:0;flex:1}.vector input{width:100%;background:#2e2625;border:0;border-bottom:1px solid #cdb7b4;color:inherit;font:inherit;padding:5px}.curve{width:100%;height:120px;background:#2e2625;touch-action:none;overflow:visible}.curve circle{cursor:grab}.list-add{display:flex;gap:4px}.list-add .field{min-width:0}.list-add button{background:#483a37;color:var(--accent-color);border:0;border-radius:4px;padding:8px;align-self:stretch;margin-bottom:6px}
</style>
