<script lang="ts">
    import {onMount} from 'svelte';
    import {location} from 'svelte-spa-router';
    import {listen} from '../integration/ws';
    import {installActivityMonitor,islandActivity} from './islandActivity';
    import {installBridgeAPI,refreshBridge,bridgeState} from './scriptBridge';
    let refresh=()=>{};
    listen('virtualScreen',()=>refresh());listen('disconnect',()=>{islandActivity.set(null);refresh();});
    onMount(()=>{
        const uninstall=installBridgeAPI();const stopActivity=installActivityMonitor(()=>['/hud','/clickgui'].includes($location)&&$bridgeState?.capabilities.activity===true);let alive=true;
        function poll(){if(alive&&($location==='/hud'||$location==='/clickgui'))void refreshBridge();}
        refresh=poll;poll();const timer=setInterval(poll,250);const unsubscribe=location.subscribe(()=>poll());
        return()=>{alive=false;refresh=()=>{};clearInterval(timer);unsubscribe();uninstall();stopActivity();};
    });
</script>
