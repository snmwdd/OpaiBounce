<script lang="ts">
    // Paths from OpaiIcons.java and HudEditButton.java in the supplied Opai shell.
    export let name: 'plus'|'gear'|'back'|'check'|'pencil'|'close'|'folder';
    export let size = 16;
    let gear = '';
    for(let i=0;i<32;i++){const a=i*Math.PI/16,r=i%4===0||i%4===3?11:8.7;gear+=`${i?'L':'M'}${12+Math.cos(a)*r},${12+Math.sin(a)*r}`;}
    gear+='Z M16,12 A4,4 0 1,0 8,12 A4,4 0 1,0 16,12Z';
</script>
<span class="vector-icon" style:width="{size}px" style:height="{size}px" style:min-width="{size}px" style:min-height="{size}px" aria-hidden="true">
{#if name==='close'}<img class="original-close" src="img/menu/icon-close.svg" alt="" width={size} height={size}/>
{:else}<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {#if name==='folder'}<path d="M2 6C2 4.9 2.9 4 4 4H9L11 6H20C21.1 6 22 6.9 22 8V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18Z" fill="currentColor"/>
    {:else if name==='plus'}<path d="M12 2V22M2 12H22" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
    {:else if name==='back'}<path d="M15 3L6 12L15 21" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    {:else if name==='check'}<path d="M2 13L9 21L23 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
    {:else if name==='gear'}<path d={gear} fill="currentColor" fill-rule="evenodd"/>
    {:else if name==='pencil'}<g transform="scale(.898876)"><path d="M6.5 16.4L15.7 7.2L19.5 11L10.3 20.2L6.2 20.5ZM16.6 6.3L17.4 5.5C20.1 2.8 23.9 6.6 21.2 9.3L20.4 10.1Z" fill="currentColor"/><rect x="6" y="22" width="16" height="1.6" rx=".5" fill="currentColor"/></g>{/if}
</svg>{/if}
</span>
<style>.vector-icon{display:inline-flex;flex:none;align-items:center;justify-content:center;line-height:0;vertical-align:middle}svg,.original-close{display:block;flex:none;width:100%;height:100%;overflow:visible}.original-close{object-fit:contain}</style>
