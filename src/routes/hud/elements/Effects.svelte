<script lang="ts">
    import {listen} from '../../../integration/ws';
    import type {StatusEffect} from '../../../integration/types';
    import {effectTextureUrl} from '../../../integration/rest';
    import {fly} from 'svelte/transition';
    import {flip} from 'svelte/animate';
    export let inEditor=false;
    let effects:StatusEffect[]=[];
    listen('clientPlayerData',e=>effects=e.playerData.effects??[]);listen('clientPlayerEffect',e=>effects=e.effects);
    $: visibleEffects=effects.length?effects:inEditor?[
        {effect:'minecraft:night_vision',localizedName:'Night Vision',duration:9580,amplifier:0,color:0x1f1fa1},
        {effect:'minecraft:speed',localizedName:'Speed',duration:1780,amplifier:1,color:0x7cafc6}
    ]:[];
    const originals=new Set(['speed','slowness','haste','mining_fatigue','strength','jump_boost','nausea','regeneration','resistance','fire_resistance','water_breathing','invisibility','night_vision','weakness','poison','absorption','saturation']);
    function icon(id:string){let key=id.split(':').at(-1)!;if(key==='health_boost')key='regeneration';return originals.has(key)?`opai/samsara/potion/${key}.png`:effectTextureUrl(id);}
    function color(value:number){return '#'+(value&0xffffff).toString(16).padStart(6,'0');}
    function time(ticks:number){if(ticks<0)return '*:*';const seconds=Math.floor(ticks/20);return `${Math.floor(seconds/60)}:${(seconds%60).toString().padStart(2,'0')}`;}
    function amplifier(value:number){return value===0?'':(['I','II','III','IV','V','VI','VII','VIII','IX','X'][value]??String(value+1));}
</script>
{#if visibleEffects.length}<div class="effects">
    {#each visibleEffects as effect (effect.effect)}<div class="effect" style:--effect-color={color(effect.color)} animate:flip={{duration:180}} transition:fly={{x:-6,duration:180}}>
        <span class="effect-icon" role="img" aria-label={effect.localizedName} style:mask-image="url('{icon(effect.effect)}')" style:-webkit-mask-image="url('{icon(effect.effect)}')"></span>
        <span class="name">{effect.localizedName}{#if effect.amplifier>0}<span class="amplifier">{' '+amplifier(effect.amplifier)}</span>{/if}</span>
        <span class="duration" class:urgent={effect.duration>=0&&effect.duration<300}>{time(effect.duration)}</span>
    </div>{/each}
</div>{/if}
<style>.effects{display:flex;flex-direction:column;align-items:flex-start;gap:4px;background:transparent;padding:4px 6px}.effect{display:grid;grid-template-columns:17px max-content;grid-template-rows:12px 12px;align-items:center;gap:0 7px;width:max-content;max-width:100%;padding:4px 9px;border-radius:6px;background:#121216a6;background:linear-gradient(to right,color-mix(in srgb,var(--effect-color) 20%,#121216b8),#1212168f);font:700 9px/12px 'Google Sans','Opai CJK',sans-serif}.effect-icon{display:block;width:13.8px;height:13.8px;grid-row:1/3;background:var(--effect-color);mask-size:contain;mask-repeat:no-repeat;mask-position:center;-webkit-mask-size:contain;-webkit-mask-repeat:no-repeat;-webkit-mask-position:center;image-rendering:pixelated}.name,.amplifier{color:var(--effect-color);white-space:nowrap}.duration{grid-column:2;font:700 8px/12px 'Google Sans','Opai CJK',sans-serif;color:var(--text-color)}.duration.urgent{color:#ff6b62}</style>
