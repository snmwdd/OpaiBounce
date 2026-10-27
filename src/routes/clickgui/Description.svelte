<script lang="ts">
    import {fade} from 'svelte/transition';
    import {description,scaleFactor} from './clickgui_store';
    let width=0,height=0,viewportWidth=innerWidth,viewportHeight=innerHeight;
    $: available=viewportWidth*2/$scaleFactor;
    $: left=Math.max(6,Math.min(available-width-6,($description?.x??0)+12));
    $: top=Math.max(6,Math.min(viewportHeight*2/$scaleFactor-height-6,($description?.y??0)-height/2));
</script>
<svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight}/>
{#if $description}
    <div class="description-wrapper" role="tooltip" bind:clientWidth={width} bind:clientHeight={height} style:left="{left}px" style:top="{top}px" transition:fade={{duration:120}}>
        {$description.description}
    </div>
{/if}
<style>.description-wrapper{position:fixed;z-index:999999;max-width:min(320px,calc(100% - 24px));pointer-events:none;border:1px solid #71666566;border-radius:9px;padding:4px 8px;background:#272425eb;box-shadow:0 1px 5px #0003;color:var(--clickgui-text-color);font:14px/20px 'Google Sans','Opai CJK',sans-serif}</style>
