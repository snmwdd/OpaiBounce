<script lang="ts">
    export let title='';
    export let label=title;
</script>
<section class="opai-card" aria-label={label}>
    {#if title}<div class="opai-card-title">{title}</div>{/if}
    <div class="opai-card-body"><slot/></div>
</section>
<style>.opai-card{width:max-content;min-width:82px;border-radius:7px;background:var(--opai-hud-surface,#0009);overflow:hidden;color:var(--opai-hud-text,#ede0de);font:9px/13px 'Google Sans','Opai CJK',sans-serif}.opai-card-title{padding:3px 6px;height:18px;background:var(--opai-hud-heading,#20202098);line-height:12px}.opai-card-body{padding:4px 5px}</style>
