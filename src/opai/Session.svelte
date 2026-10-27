<script lang="ts">
    import {onMount} from 'svelte';
    import {getSession} from '../integration/rest';
    import {REST_BASE} from '../integration/host';
    import {listen} from '../integration/ws';
    import Head from './Head.svelte';
    import Icon from './Icon.svelte';
    export let settings: Record<string,any>;
    let uuid = '', time = '0s';
    const start = Number(sessionStorage.getItem('opai.session-start')) || Date.now();
    onMount(() => {
        sessionStorage.setItem('opai.session-start',String(start));
        getSession().then(s => uuid = s.uuid).catch(() => {});
        const timer = setInterval(() => {const seconds = Math.floor((Date.now()-start)/1000);time = seconds<60?`${seconds}s`:`${Math.floor(seconds/60)}m ${seconds%60}s`;},1000);
        return () => clearInterval(timer);
    });
    listen('session',e => uuid = e.session.uuid);
</script>
<div class="session"><div class="face">{#if uuid}<Head src="{REST_BASE}/api/v1/client/resource/skin?uuid={uuid}" size={34}/>{/if}</div><div class="elapsed">Time elapsed {time}</div><div class="stats"><Icon name="skull" size={7}/>{settings.kills ?? 0} kills <Icon name="stats" size={7}/>{settings.wins ?? 0} wins</div></div>
<style>.session{width:max-content;min-width:150px;height:49px;padding:6px;display:grid;grid-template-columns:34px max-content;grid-template-rows:20px 17px;gap:0 10px;background:var(--opai-hud-surface,#0009);border-radius:7.5px;backdrop-filter:blur(2px);color:white;font:9px 'Google Sans','Opai CJK',sans-serif}.face{width:34px;height:34px;border-radius:6px;overflow:hidden;grid-row:1/3;background:#29201c}.elapsed{color:#b9b9b9;align-self:center}.stats{display:flex;gap:5px;align-items:center}</style>
