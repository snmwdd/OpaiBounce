<script lang="ts">
    export let name:'note'|'home'|'search'|'heart'|'playlist'|'play'|'pause'|'next'|'previous'|'repeat'|'shuffle'|'volume'|'gear'|'close'|'back'|'pencil'|'chevron'|'user'='note';
    export let size=20;
</script>
<svg class="music-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-icon={name}>
    {#if name==='note'}<path d="M9 17V5l12-3v12M9 8l12-3"/><ellipse cx="5.5" cy="18" rx="3.5" ry="2.5" fill="currentColor" stroke="none"/><ellipse cx="17.5" cy="15" rx="3.5" ry="2.5" fill="currentColor" stroke="none"/>
    {:else if name==='play'}<path d="m7 4 14 8-14 8Z" fill="currentColor" stroke="none"/>
    {:else if name==='pause'}<path d="M7 4v16M17 4v16" stroke-width="4"/>
    {:else if name==='next'}<path d="m4 4 12 8-12 8Z" fill="currentColor" stroke="none"/><path d="M20 4v16" stroke-width="2.5"/>
    {:else if name==='previous'}<path d="m20 4-12 8 12 8Z" fill="currentColor" stroke="none"/><path d="M4 4v16" stroke-width="2.5"/>
    {:else if name==='heart'}<path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/>
    {:else if name==='search'}<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 6 6"/>
    {:else if name==='home'}<path d="m2 11 10-9 10 9M5 9v12h5v-7h4v7h5V9"/>
    {:else if name==='playlist'}<path d="M3 5h14M3 10h14M3 15h8M18 12v7"/><ellipse cx="15.5" cy="20" rx="2.5" ry="2"/>
    {:else if name==='repeat'}<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3"/>
    {:else if name==='shuffle'}<path d="M3 5h3l12 14h3M3 19h3L18 5h3m-3-3 3 3-3 3m0 8 3 3-3 3"/>
    {:else if name==='volume'}<path d="M3 9h4l5-5v16l-5-5H3Zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16"/>
    {:else if name==='gear'}<path d="m10 2-1 3-3 1-3-1-2 4 2 3-2 3 2 4 3-1 3 1 1 3h4l1-3 3-1 3 1 2-4-2-3 2-3-2-4-3 1-3-1-1-3Z" transform="translate(0 -1) scale(.96)"/><circle cx="12" cy="11" r="3.5"/>
    {:else if name==='close'}<path d="m5 5 14 14M19 5 5 19"/>
    {:else if name==='back'}<path d="m15 4-8 8 8 8"/>
    {:else if name==='pencil'}<path d="m4 15 11-11a3 3 0 0 1 5 5L9 20l-6 1Zm9-9 5 5M3 21h18"/>
    {:else if name==='chevron'}<path d="m5 9 7 7 7-7"/>
    {:else if name==='user'}<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2Z"/>{/if}
</svg>
<style>.music-icon{display:block;flex:none;overflow:visible}</style>
