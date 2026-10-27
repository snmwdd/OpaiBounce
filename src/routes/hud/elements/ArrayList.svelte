<script lang="ts">
    import {onMount} from 'svelte';
    import type {Module} from '../../../integration/types';
    import {getModules} from '../../../integration/rest';
    import {listen} from '../../../integration/ws';
    import {getTextWidth} from '../../../integration/text_measurement';
    import {flip} from 'svelte/animate';
    import {fly} from 'svelte/transition';
    import {convertToSpacedString,spaceSeperatedNames} from '../../../theme/theme_config';
    export let settings:{[name:string]:any};
    let modules:Module[]=[],fontRevision=0,alive=true;
    $: rows=modules.filter(m=>m.enabled&&!m.hidden).map(m=>{
        const label=$spaceSeperatedNames?convertToSpacedString(m.name):m.name;
        const tag=settings.showTags&&m.tag?m.tag:'';
        fontRevision;
        return {...m,label,visibleTag:tag,width:getTextWidth(label+(tag?' '+tag:''),'400 9px "Opai List", "Opai List CJK", sans-serif')};
    }).sort((a,b)=>settings.order==='Ascending'?a.width-b.width:b.width-a.width);
    async function refresh(){const items=await getModules();if(alive)modules=items;}
    onMount(()=>{
        void refresh();
        // The list can be the first regular-font consumer. fonts.ready alone
        // may resolve before module data arrives and requests that face.
        void Promise.all([document.fonts.load('400 9px "Opai List"'),document.fonts.load('400 9px "Opai List CJK"')]).then(()=>{if(alive)fontRevision++;});
        return()=>{alive=false;};
    });
    listen('moduleToggle',()=>void refresh());listen('refreshArrayList',()=>void refresh());
</script>
<div class="arraylist" aria-label="Enabled modules">
    {#each rows as row (row.name)}<div class="module" data-module={row.name} style={settings.itemAlignment==='Left'?'margin-right:auto':'margin-left:auto'} animate:flip={{duration:200}} transition:fly={{x:settings.itemAlignment==='Left'?-40:40,duration:200}}><span class="module-name">{row.label}</span>{#if row.visibleTag}<span class="tag">{' '+row.visibleTag}</span>{/if}</div>{/each}
</div>
<style>@font-face{font-family:"Opai List";src:url("/opai/font/GoogleSans-Regular.ttf");font-weight:400;font-display:swap}@font-face{font-family:"Opai List CJK";src:url("/opai/font/NotoSansSC-Regular.ttf");font-weight:400;font-display:swap}.arraylist{display:flex;flex-direction:column;align-items:stretch;position:relative;padding-right:1px}.arraylist:after{content:"";position:absolute;right:0;top:0;bottom:0;width:1px;pointer-events:none;background:linear-gradient(to bottom,var(--accent-color),color-mix(in srgb,var(--accent-color) 35%,#3f242b))}.module{display:flex;align-items:baseline;width:max-content;max-width:100%;background:linear-gradient(to left,color-mix(in srgb,var(--accent-color) 12%,transparent),transparent 24px),#0009;color:var(--arraylist-text-color);font:400 9px/12.5px 'Opai List','Opai List CJK',sans-serif;white-space:nowrap;border-radius:0;padding:0 3px;border:0}.tag{white-space:pre;color:var(--arraylist-tag-color)}.module-name{min-width:0}</style>
