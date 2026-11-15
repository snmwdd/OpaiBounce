<script lang="ts">
 import type {ModuleSetting} from '../../../../integration/types';
 import OpaiSetting from '../../../../opai/OpaiSetting.svelte';
 export let setting:ModuleSetting;
 export let path:string;
 export let displayName: string | undefined = undefined;
 export let hint: string | undefined = undefined;
</script>
<OpaiSetting {path} {displayName} {hint} bind:setting on:change/>
