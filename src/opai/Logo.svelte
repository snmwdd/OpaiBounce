<script lang="ts">
    import {requestMotionFrame,cancelMotionFrame} from './animation';
    import {onMount} from 'svelte';
    import {Tween,SpriteClock} from './motion';
    import {MascotPhysics} from './mascotPhysics';
    export let width = 1000;
    export let height = 550;
    export let y = 149;
    let pigX = -48, x = 0, py = 0, angle = 0;
    let flying:HTMLDivElement;
    let physics:MascotPhysics|undefined, sound:HTMLAudioElement;
    let hit = false, floating = false, selected = false, frame = 0;
    const explosion = new SpriteClock();
    let lastX = 0, lastY = 0, lastCollision = 0;
    let explosionFrame = -1;
    function explode(now: number) { explosion.start(now);if(sound){sound.currentTime=0;sound.play().catch(()=>{});} }
    const christmas = new Date().getMonth() === 11;
    function pointer(e: PointerEvent) {
        if (selected && (e.buttons & 1)) { physics?.impulse((e.clientX-lastX)/(window.innerWidth/width),(e.clientY-lastY)/(window.innerWidth/width)); }
        lastX = e.clientX; lastY = e.clientY;
    }
    onMount(() => {
        let start = -1;
        sound=new Audio('opai/badexplosion/snd_badexplosion.wav');sound.volume=.18;sound.preload='auto';sound.load();
        const sprite=new Image();sprite.src='opai/badexplosion/spritesheet.png';void sprite.decode().catch(()=>{});
        const arrival = new Tween(1200,t=>t,-48);
        let reversed = false;
        function tick(now: number) {
            if (!sessionStorage.getItem('opai.intro')) { frame = requestMotionFrame(tick); return; }
            if (start < 0) { start = now; arrival.to(width + 71,now); }
            explosionFrame = explosion.tick(now);
            if (!hit) {
                arrival.to(reversed ? -71 : width+71,now); pigX = arrival.tick(now);
                if(pigX < width/2-30 && pigX>30 && Math.random()<.02) reversed=true;
                if (pigX >= width / 2 - 30) { hit = true; floating = true; x = width / 2 - 25; py = y; physics=new MascotPhysics(x,py,now);lastCollision=now;explode(now); }
            }
            if(hit&&physics){
                const position=physics.sample(now,width,height);x=position.x;py=position.y;angle=position.angle;
                if(now-lastCollision>1000 && physics.x<width/2+25 && physics.x+48>width/2-25 && physics.y<y+50 && physics.y+48>y){
                    floating=!floating;physics.teleport(width/2-25,y);lastCollision=now;explode(now);
                }
            }
            if(flying)flying.style.transform=hit?`translate3d(${x}px,${py}px,0) rotate(${angle}deg)`:`translate3d(${pigX}px,${y}px,0)`;
            frame = requestMotionFrame(tick);
        }
        frame = requestMotionFrame(tick);
        function visibility(){if(document.hidden){cancelMotionFrame(frame);sound.pause();}else{physics?.resume(performance.now());frame=requestMotionFrame(tick);}}
        document.addEventListener('visibilitychange',visibility);
        return () => {cancelMotionFrame(frame);document.removeEventListener('visibilitychange',visibility);sound.pause();sound.removeAttribute('src');sound.load();};
    });
</script>
<svelte:window on:pointermove={pointer}/>
<div class="logo-static" data-collided={hit} style:transform="translate3d({width / 2 - 25}px,{y}px,0)">
    {#if hit && floating}<img src="opai/image/pig2.svg" alt="Opai mascot"/>{:else}<span class="logo-mask"></span>{/if}
    {#if christmas && hit && floating}<img class="hat" src="opai/image/egg/Christmas_hat.svg" alt=""/>{/if}
</div>
{#if explosionFrame>=0}<div class="explosion" style:left="{width/2-35}px" style:top="{y-32}px" style:background-position="0 {-explosionFrame*100}px"></div>{/if}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="flying" bind:this={flying} on:pointerenter={() => selected = true} on:pointerleave={() => selected = false}>
    {#if hit&&floating}<span class="logo-mask"></span>{:else}<img src="opai/image/pig2.svg" alt=""/>{/if}
</div>
<style>
    .explosion{position:absolute;width:70px;height:100px;background:url('/opai/badexplosion/spritesheet.png');pointer-events:none;z-index:3}
    .flying,.logo-static{left:0;top:0}.flying{transform:translate3d(-48px,-48px,0)}.logo-static,.flying{position:absolute;width:48px;height:48px;pointer-events:auto;z-index:2}.flying{will-change:transform;contain:layout style}img,.logo-mask{width:48px;height:48px;display:block}.logo-mask{background:var(--accent-color);mask:url('/opai/image/logo.svg') center/contain no-repeat}.hat{position:absolute;left:-16px;top:-26px}
</style>
