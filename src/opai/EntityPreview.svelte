<script lang="ts">
    import {onMount,tick} from 'svelte';
    import {bridgeState,previewModule,sendPreview,clearPreview} from './scriptBridge';
    import {scaleFactor} from '../routes/clickgui/clickgui_store';
    import {clickGuiVisible} from './clickGuiLifecycle';
    let card:HTMLDivElement,body:HTMLDivElement,left=0,top=80;
    $: target=$previewModule;
    $: show=!!target&&!!$bridgeState?.capabilities.preview&&$clickGuiVisible;
    $: ratio=$scaleFactor/2;
    let report=()=>{},hadPreview=false;
    function changed(visible:boolean){if(!visible&&hadPreview)void clearPreview().catch(()=>{});hadPreview=visible;}
    $: changed(show);
    $: target,ratio,show,report();
    function options(setting:any,result:Record<string,unknown>={}){
        if(!setting)return result;
        if(setting.name==='Enabled'||setting.name==='Bind'||setting.name==='Hidden')return result;
        if(Array.isArray(setting.value)){if(setting.value.every((x:any)=>typeof x==='string'))result[setting.name]=setting.value;else{const enabled=setting.value.find((x:any)=>x.name==='Enabled');if(enabled)result[setting.name]=enabled.value;for(const child of setting.value)options(child,result);}}
        else if(setting.name)result[setting.name]=setting.value;
        // CHOICE carries children in choices; send only active options, not every mode.
        const active=setting.choices?.[setting.active]??setting.choices?.find?.((x:any)=>x.name===setting.active);
        if(active)options(active,result);
        return result;
    }
    onMount(()=>{
        let busy=false,alive=true;
        report=async()=>{
            if(!alive||!show||!target||!card||!body||busy)return;
            const anchor=target.anchor.getBoundingClientRect();if(anchor.width<1||anchor.height<1)return;
            const logicalWidth=230,logicalHeight=300;
            const right=anchor.right/ratio+12;
            left=Math.max(8,Math.min(innerWidth/ratio-logicalWidth-8,right+logicalWidth+8<=innerWidth/ratio?right:anchor.left/ratio-logicalWidth-12));
            top=Math.max(8,Math.min(innerHeight/ratio-logicalHeight-8,anchor.top/ratio));
            busy=true;await tick();if(!alive||!show||!body){busy=false;return;}
            const r=body.getBoundingClientRect();if(r.width<1){busy=false;return;}
            try{await sendPreview(target.name,{x:r.x,y:r.y,width:r.width,height:r.height},options(target.settings));if(!alive||!show)await clearPreview();}catch{}finally{busy=false;}
        };
        void tick().then(()=>report());
        const timer=setInterval(()=>report(),250);
        return()=>{alive=false;report=()=>{};clearInterval(timer);void clearPreview().catch(()=>{});};
    });
</script>
{#if show}
<div class="entity-preview" bind:this={card} style:left="{left}px" style:top="{top}px" aria-label="Entity render preview">
    <div class="preview-title">Entity Render Preview <span>{target?.name}</span></div>
    <div class="preview-body" bind:this={body}>{#if !$bridgeState?.inWorld}<span>Enter a world to preview</span>{:else if $bridgeState?.previewError}<span class="preview-error">Preview unavailable — retrying…</span>{/if}</div>
</div>
{/if}
<style>.entity-preview{position:fixed;z-index:9998;width:230px;height:300px;border-radius:9px;background:#211b1ac7;box-shadow:0 0 8px #0007;pointer-events:none;color:var(--text-color);animation:appear 180ms ease-out}.preview-title{font:14px 'Google Sans','Opai CJK',sans-serif;padding:8px 10px}.preview-title>span{display:block;font-size:10px;color:var(--accent-color)}.preview-body{position:relative;height:250px;margin:0 10px 10px;display:grid;place-items:center;font-size:12px}.preview-error{align-self:end;padding:6px;color:var(--accent-color);text-align:center}@keyframes appear{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}</style>
