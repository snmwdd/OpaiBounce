<script lang="ts">
    import {pixelGlyphs} from './pixelFont';
    export let text: string;
    $: characters = Array.from(text);
    $: supported = characters.every(character => character in pixelGlyphs);
    $: path = supported ? characters.map((character,index) => pixelGlyphs[character].split('/').flatMap((row,y) => Array.from(row).flatMap((bit,x) => bit === '1' ? [`M${index * 6 + x} ${y}h1v1h-1z`] : [])).join('')).join('') : '';
</script>
{#if supported}
    <svg class="pixel-text" role="img" aria-label={text} width={Math.max(1, characters.length * 6 - 1)} height="7" viewBox="0 0 {Math.max(1, characters.length * 6 - 1)} 7" shape-rendering="crispEdges"><path d={path} fill="currentColor"/></svg>
{:else}
    <span class="fallback">{text}</span>
{/if}
<style>
    .pixel-text { display: block; flex-shrink: 0; overflow: visible; }
    .fallback { font: 9px 'Opai CJK', monospace; white-space: nowrap; }
</style>
