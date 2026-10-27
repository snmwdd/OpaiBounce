<script lang="ts">
    import {onMount} from 'svelte';
    let left = -100;
    onMount(()=>{const timer=setInterval(() => {
        left += 100;

        if (left > window.innerWidth + 100) {
            left = -100;
        }
    }, 500);return()=>clearInterval(timer);});
</script>

<div class="taco">
    <img src="img/hud/taco/taco.gif" alt="taco no load :(("
         class:transition={left < window.innerWidth + 100 && left > -100} style:transform="translateX({left}px)">
</div>

<style lang="scss">
  .taco {
    position: relative;
    height: 60px;
    width: 100vw;
    background-color: transparent;

    img {
      position: absolute;
      left:0;
      will-change:transform;
      height: 100%;

      &.transition {
        transition: linear transform 500ms;
      }
    }
  }
</style>

