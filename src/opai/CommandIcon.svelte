<script lang="ts">
    export let name:string;
    $: asset=name==='Hide'?'opai/adapted/eye-off.svg':name==='bind'?'opai/adapted/keyboard.svg':'img/menu/icon-eye.svg';
</script>
<span class="opai-command-icon" data-icon={name} aria-hidden="true">
    {#if name==='directory'}
        <!-- OpaiIcons.FOLDER from the supplied shell. -->
        <svg viewBox="0 0 24 24"><path d="M2 5H10L12 8H22V21H2Z" fill="currentColor"/></svg>
    {:else if name==='profile'}
        <!-- OpaiIcons.LOAD, keeping the original clipboard and arrow geometry. -->
        <svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="19" rx="2" fill="currentColor"/><rect x="7" y="1" width="10" height="4" rx="1" fill="currentColor"/><path d="M12 8V17M8 13L12 17L16 13" fill="none" stroke="#171312" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    {:else if name==='Enable'||name==='Disable'}
        <!-- DynamicIslandPainter toggle outline and knob, framed to fill a menu icon. -->
        <svg viewBox="4 8 28 20"><rect x="5" y="10" width="26" height="16" rx="8" fill="currentColor"/><rect x={name==='Enable'?20:8.5} y="13.5" width="8" height="8" rx="4" fill="#171312"/></svg>
    {:else if name==='Toggle'||name==='Reveal'}
        <!-- OpaiIcons.BACK arrowheads, composed into the reference's bidirectional command glyph. -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7H21M3 17H21"/><path d="M15 3L6 12L15 21" transform="translate(1 3) scale(.333333)" vector-effect="non-scaling-stroke"/><path d="M15 3L6 12L15 21" transform="translate(23 21) scale(-.333333)" vector-effect="non-scaling-stroke"/></svg>
    {:else}<span class="asset" style:mask-image="url('{asset}')" style:-webkit-mask-image="url('{asset}')"></span>{/if}
</span>
<style>.opai-command-icon{display:inline-flex;flex:none;width:22px;height:22px;min-width:22px;align-items:center;justify-content:center;color:inherit}svg,.asset{display:block;width:100%;height:100%}.asset{background:currentColor;mask-size:contain;mask-repeat:no-repeat;mask-position:center;-webkit-mask-size:contain;-webkit-mask-repeat:no-repeat;-webkit-mask-position:center}</style>
