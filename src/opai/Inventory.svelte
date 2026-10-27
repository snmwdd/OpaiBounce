<script lang="ts">
    import {onMount} from 'svelte';
    import {getPlayerInventory} from '../integration/rest';
    import {listen} from '../integration/ws';
    import type {ItemStack} from '../integration/types';
    import ItemStackView from '../routes/hud/elements/inventory/ItemStackView.svelte';
    let stacks: ItemStack[] = [];
    onMount(() => { getPlayerInventory().then(i => stacks = i.main.slice(9)).catch(() => {}); });
    listen('clientPlayerInventory',e => stacks = e.inventory.main.slice(9));
</script>
<div class="opai-inventory"><div class="title">Inventory</div><div class="slots">{#each Array(27) as _,i}<div class="slot">{#if stacks[i]?.count > 0}<div class="item"><ItemStackView stack={stacks[i]}/></div>{/if}</div>{/each}</div></div>
<style>.opai-inventory{width:182px;height:80px;overflow:hidden;border-radius:7px;background:var(--opai-hud-surface,#0009);backdrop-filter:blur(2px);color:#ede0de}.title{height:18px;font:9px 'Google Sans','Opai CJK',sans-serif;background:var(--opai-hud-heading,#20202098);padding:3px 7px}.slots{display:grid;grid-template-columns:repeat(9,17px);grid-auto-rows:17px;gap:3px;padding:2px 3px}.slot{border-radius:2px;background:#33333316;overflow:hidden}.item{zoom:.5}</style>
