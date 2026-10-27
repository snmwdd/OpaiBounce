<script lang="ts">
 import type {ModuleSetting} from '../../../../integration/types';
 import OpaiSetting from '../../../../opai/OpaiSetting.svelte';
 export let setting:ModuleSetting;
 export let path:string;
</script>
<OpaiSetting {path} bind:setting on:change/>
