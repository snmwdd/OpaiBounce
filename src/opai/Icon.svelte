<script lang="ts">
    export let name: string;
    export let size = 12;
</script>
<span class="opai-icon" style:--icon-size="{size}px" style:width="{size}px" style:height="{size}px" style:mask-image="url('opai/image/{name}.svg')" style:-webkit-mask-image="url('opai/image/{name}.svg')" aria-hidden="true"></span>
<style>.opai-icon{display:inline-block;flex:0 0 auto;min-width:var(--icon-size);min-height:var(--icon-size);line-height:0;vertical-align:middle;background:currentColor;mask-size:contain;mask-repeat:no-repeat;mask-position:center;-webkit-mask-size:contain;-webkit-mask-repeat:no-repeat;-webkit-mask-position:center}</style>
