<script lang="ts">
    import type {ItemStack} from "../../../../integration/types";
    import {mapToColor} from "../../../../util/color_utils";
    import {itemTextureUrl} from "../../../../integration/rest";

    export let stack: ItemStack;

    let count=0,damage=0,identifier='',maxDamage=0;
    let enchantments:ItemStack['enchantments'];
    $: ({count,damage,identifier,maxDamage,enchantments}=stack);

    $: countColor = count <= 0 ? "red" : "white";

    $: durability=maxDamage>0?Math.max(0,Math.min(1,(maxDamage-damage)/maxDamage)):0;
    $: valueColor=mapToColor(120*durability);
</script>

<div class="item-stack">
    {#if enchantments&&Object.keys(enchantments).length}
        <div class="mask" style="mask-image: url({itemTextureUrl(identifier)})"></div>
    {/if}
    <img class="item-icon" src={itemTextureUrl(identifier)} alt={identifier}/>

    <div class="durability-bar" class:hidden={damage===0||maxDamage<=0}>
        <div class="durability"
             style="width: {100*durability}%; background-color: {valueColor}">
        </div>
    </div>

    <div class="count" class:hidden={count === 1 || identifier === "minecraft:air"} style="color: {countColor}">
        {count}
    </div>
</div>

<style lang="scss">

  .hidden {
    display: none;
  }

  .item-stack {
    position: relative;
    width: 32px;
    height: 32px;
  }

  .mask {
    position: absolute;
    background: radial-gradient(circle, var(--item-enchant-glow-start-color), var(--item-enchant-glow-end-color) 100%);
    mix-blend-mode: screen;
    scale: 105%;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    mask-size: cover;
  }

  .item-icon {
    width: 100%;
    height: 100%;
  }

  .durability-bar {
    position: absolute;
    bottom: 0;
    left: 10%;
    width: 80%;
    height: 2px;
    background-color: var(--item-damage-background-color);
  }

  .durability {
    height: 100%;
    transition: width 150ms;
  }

  .count {
    position: absolute;
    bottom: 0;
    right: 0;
    font-size: 14px;
    font-weight: bold;
    text-shadow: 1px 1px var(--item-count-shadow-color); // This is inconsistent with other UI elements but it looks better so I will let it pass ~Senk Ju
    font-family: monospace;
  }
</style>
