<script lang="ts">
    import {onMount} from 'svelte';
    import {getPlayerInventory} from '../integration/rest';
    import {listen} from '../integration/ws';
    import type {PlayerInventory} from '../integration/events';
    import type {ItemStack} from '../integration/types';
    import ItemStackView from '../routes/hud/elements/inventory/ItemStackView.svelte';
    import HudCard from './HudCard.svelte';
    import {occupied,inventoryCounts} from './hudInventory';
    export let mode:'equipment'|'crafting'|'enderchest'|'statistics';
    export let settings:Record<string,any>={};
    export let inEditor=false;
    let inventory:PlayerInventory|null=null,eventSeen=false;
    let stacks:ItemStack[]=[];
    onMount(()=>{let alive=true;getPlayerInventory().then(value=>{if(alive&&!eventSeen)inventory=value;}).catch(()=>{});return()=>{alive=false;};});
    listen('clientPlayerInventory',event=>{eventSeen=true;inventory=event.inventory;});listen('disconnect',()=>inventory=null);
    $: title=({equipment:'Equipment',crafting:'Crafting',enderchest:'Ender Chest',statistics:'Items'})[mode];
    $: columns=mode==='equipment'?(settings.layout==='Horizontal'?4:1):mode==='crafting'?2:mode==='enderchest'?9:Math.max(1,Math.min(9,Number(settings.rowLength)||1));
    $: stacks=!inventory?[]:mode==='equipment'?[...inventory.armor].reverse().filter(occupied):mode==='crafting'?inventory.crafting:mode==='enderchest'?inventory.enderChest:inventoryCounts(inventory.main,Array.isArray(settings.items)?settings.items:[],settings.showEmpty!==false);
    $: size=mode==='equipment'?Math.max(stacks.length,inEditor?4:0):mode==='crafting'?4:mode==='enderchest'?27:stacks.length;
</script>
<HudCard {title}><div class="panel-items" style:--columns={columns} style:min-width={mode==='equipment'?'72px':undefined}>
    {#each Array(size) as _,index}<div class="slot" class:placeholder={!occupied(stacks[index])}>
        {#if stacks[index]&&(mode==='statistics'||occupied(stacks[index]))}<div class="item"><ItemStackView stack={stacks[index]}/></div>{/if}
    </div>{/each}
    {#if size===0}<span class="empty">{mode==='equipment'?'No equipment':'No items'}</span>{/if}
</div></HudCard>
<style>.panel-items{display:grid;grid-template-columns:repeat(var(--columns),17px);grid-auto-rows:minmax(17px,auto);gap:3px}.slot{width:17px;height:17px;position:relative;border-radius:3px;background:#ffffff06}.slot.placeholder{background:#ffffff08}.item{zoom:.5}.empty{font-size:8px;color:#b9b9b9;white-space:nowrap;grid-column:1/-1}</style>
