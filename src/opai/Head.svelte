<script lang="ts">
    export let src: string;
    export let size = 26;
</script>
<span class="head" style:width="{size}px" style:height="{size}px"><img {src} alt=""/><img class="overlay" {src} alt=""/></span>
<style>.head{display:inline-block;position:relative;overflow:hidden;border-radius:5px;flex-shrink:0}.head img{position:absolute;width:800%!important;height:auto!important;max-width:none;left:-100%;top:-100%;image-rendering:pixelated;border-radius:0!important}.head .overlay{left:-500%}</style>
