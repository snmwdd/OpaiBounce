<script lang="ts">
    import {onMount} from 'svelte';
    import {musicViewState as musicState,musicActive,musicWidgets,musicRequest} from './music';
    import {smoothBands} from './musicMotion';
    import LyricScroller from './LyricScroller.svelte';
    import MusicIcon from './MusicIcon.svelte';
    import MusicProgress from './MusicProgress.svelte';
    export let kind:string, inEditor=false;
    let bands:number[]=Array(32).fill(0),restartSpectrum=()=>{};
    $: track=$musicState?.track;
    $: enabled=kind==='MusicInfo'?$musicWidgets.info:kind==='MusicLyrics'?$musicWidgets.lyrics:$musicWidgets.spectrum;
    $: shown=inEditor||$musicActive&&!!track&&enabled&&(kind!=='MusicLyrics'||($musicState?.lyricsMode??'HUD')==='HUD');
    $: duration=track?.duration??0;
    $: spectrumActive=kind==='MusicSpectrum'&&shown&&!!$musicState?.playing;
    $: if(!spectrumActive)bands=inEditor?Array.from({length:32},(_,i)=>.12+.4*Math.sin(i*.23)**2):Array(32).fill(0);
    $: spectrumActive,restartSpectrum();
    onMount(()=>{
        if(kind!=='MusicSpectrum')return;
        let alive=true,epoch=0,timer:ReturnType<typeof setTimeout>;
        function restart(){
            clearTimeout(timer);const ticket=++epoch;
            if(!spectrumActive||document.hidden)return;
            async function poll(){
                try{const value=await musicRequest<{bands:number[]}>('/spectrum');if(alive&&ticket===epoch)bands=Array.from({length:32},(_,i)=>Math.min(1,Math.max(0,Number(value.bands[i])||0)));}catch{if(alive&&ticket===epoch)bands=Array(32).fill(0);}
                if(alive&&ticket===epoch)timer=setTimeout(poll,100);
            }
            void poll();
        }
        restartSpectrum=restart;document.addEventListener('visibilitychange',restart);
        return()=>{alive=false;epoch++;clearTimeout(timer);restartSpectrum=()=>{};document.removeEventListener('visibilitychange',restart);};
    });
</script>
{#if shown}
{#if kind==='MusicInfo'}
<section class="music-info" aria-label="Music Info">
    {#if track?.cover}<img class="album-back" src={track.cover} alt="" referrerpolicy="no-referrer"/><img class="album" src={track.cover} alt="专辑封面" referrerpolicy="no-referrer"/>{:else}<div class="album placeholder"><MusicIcon name="note" size={24}/></div>{/if}
    <div class="info"><strong>{track?.name??'Tritium Music'}</strong><span class="artist">{track?.artists.join(' / ')??'歌曲信息预览'}</span><MusicProgress {duration}/></div>
</section>
{:else if kind==='MusicLyrics'}
<LyricScroller/>
{:else}
<div class="music-spectrum" aria-label="Music Spectrum" data-playing={spectrumActive}><svg use:smoothBands={bands} viewBox="0 0 480 70" role="img" aria-label="音频频谱"><path/></svg></div>
{/if}
{/if}
<style>
.music-info{position:relative;isolation:isolate;contain:layout style;display:flex;align-items:center;gap:5px;box-sizing:border-box;width:230px;height:56px;padding:4px 5px;overflow:hidden;border-radius:10.5px;background:#080808de;color:white;box-shadow:var(--opai-hud-shadow);font-family:'Google Sans','Opai CJK',sans-serif}.album-back{position:absolute;inset:-20%;width:140%;height:140%;object-fit:cover;filter:blur(10px);opacity:1;transform:translateZ(0);pointer-events:none}.music-info:after{content:"";position:absolute;inset:0;background:#0007;pointer-events:none}.album{position:relative;z-index:1;width:48px;height:48px;object-fit:cover;border-radius:6px;flex:none}.placeholder{display:grid;place-items:center;background:#ffffff15;color:var(--accent-color)}.info{position:relative;z-index:1;min-width:0;flex:1}.info strong,.artist{display:block;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.info strong{font-size:12px;line-height:17px}.artist{font-size:9px;line-height:13px;color:#c1c1c1}.music-spectrum{width:480px;height:70px;filter:var(--opai-hud-silhouette-shadow)}.music-spectrum svg{display:block;width:100%;height:100%;fill:#b6b6b6a0}
</style>
