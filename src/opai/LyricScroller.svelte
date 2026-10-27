<script lang="ts">
 import {musicLyrics,musicTranslations,musicLyricIndex,musicWidgets,currentLyric,musicTrackTitle} from './music';
 import {lyricSlide} from './musicMotion';
 $: index=$musicLyricIndex;
 $: start=Math.max(0,index-2);
 $: rows=$musicLyrics.length?$musicLyrics.slice(start,Math.max(0,index)+3).map((line,i)=>({...line,index:start+i})):[{time:0,text:$musicTrackTitle,index:0}];
</script>
<section class="music-lyrics" aria-label="Music Lyrics">{#each rows as line (line.time+':'+line.index)}<div class="lyric-row" class:current={line.index===index||!$musicLyrics.length} use:lyricSlide={{y:48+(line.index-Math.max(0,index))*38,opacity:line.index===index||!$musicLyrics.length?1:Math.abs(line.index-index)===1?.35:.08}}><span>{line.text||'…'}</span>{#if $musicWidgets.translation&&$musicTranslations.length}<small>{currentLyric($musicTranslations,line.time)}</small>{/if}</div>{/each}</section>
<style>.music-lyrics{position:relative;overflow:hidden;width:450px;height:120px;text-align:right;font-family:'Google Sans','Opai CJK',sans-serif;text-shadow:0 1px 2px #000b,0 0 4px var(--hud-shadow-color);color:#fff;mask-image:linear-gradient(transparent,#000 15%,#000 88%,transparent)}.lyric-row{position:absolute;left:0;right:0;top:0;font-size:14px;line-height:18px;will-change:transform,opacity}.lyric-row span,.lyric-row small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lyric-row small{font-size:9px;line-height:12px}</style>
