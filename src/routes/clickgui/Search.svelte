<script lang="ts">
    import {onDestroy, tick} from 'svelte';
    import type {Module} from '../../integration/types';
    import {convertToSpacedString} from '../../theme/theme_config';
    import {clickGuiVisible} from '../../opai/clickGuiLifecycle';
    import {hudGeometry} from '../../opai/hudGeometry';
    import Reveal from '../../opai/Reveal.svelte';
    import VectorIcon from '../../opai/VectorIcon.svelte';
    import {highlightModuleName} from './clickgui_store';

    export let modules: Module[];

    let dock: HTMLElement;
    let trigger: HTMLButtonElement;
    let input: HTMLInputElement;
    let expanded = false;
    let query = '';
    let selected = 0;
    const id = 'opai-clickgui-module-results';

    function normalize(text: string) {
        return text.toLowerCase().replace(/\s+/g, '');
    }

    $: scale = $hudGeometry.gameScale * $hudGeometry.density;
    $: indexed = modules.map(module => ({
        module,
        terms: [module.name, ...module.aliases].map(normalize),
    }));
    $: term = normalize(query);
    $: results = term
        ? indexed.filter(item => item.terms.some(text => text.includes(term))).map(item => item.module)
        : [];
    $: if (!$clickGuiVisible && expanded) close();
    $: if (selected >= results.length) selected = 0;

    async function open() {
        expanded = true;
        await tick();
        input?.focus({preventScroll: true});
    }

    function close(returnFocus = false) {
        input?.blur();
        expanded = false;
        selected = 0;
        query = '';
        if (returnFocus) void tick().then(() => trigger?.focus({preventScroll: true}));
    }

    function choose(module: Module) {
        // Reset first so choosing the same module again also scrolls it into view.
        if ($highlightModuleName === module.name) highlightModuleName.set(null);
        highlightModuleName.set(module.name);
        close(true);
    }

    function handleKeys(event: KeyboardEvent) {
        if (event.isComposing) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close(true);
        } else if (event.key === 'Enter' && results[selected]) {
            event.preventDefault();
            choose(results[selected]);
        } else if (results.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            selected = (selected + direction + results.length) % results.length;
            document.getElementById(id + '-' + selected)?.scrollIntoView({block: 'nearest'});
        }
    }

    function closeOutside(event: PointerEvent) {
        if (expanded && event.target instanceof Node && !dock.contains(event.target)) close();
    }

    function closeOnFocusExit(event: FocusEvent) {
        if (expanded && event.relatedTarget instanceof Node && !dock.contains(event.relatedTarget)) close();
    }

    onDestroy(() => input?.blur());
</script>

<svelte:window on:pointerdown={closeOutside}/>
<div class="search-dock" class:expanded style:--scale={scale} bind:this={dock}
     role="search" aria-label="ClickGUI module search" on:focusout={closeOnFocusExit}>
    <Reveal visible={expanded && !!term}>
        {#if results.length}
            <div class="search-results" role="listbox" aria-label="Matching modules" {id}>
                {#each results as module, index (module.name)}
                    <button type="button" class="result" class:selected={selected === index} role="option"
                            id={id + '-' + index} aria-selected={selected === index} tabindex="-1"
                            on:mousedown|preventDefault on:click={() => choose(module)}>
                        <span>{convertToSpacedString(module.name)}</span>
                    </button>
                {/each}
            </div>
        {:else}
            <div class="empty-results" role="status">No matching modules</div>
        {/if}
    </Reveal>
    {#if expanded}
        <div class="search-bar">
            <span class="search-icon" aria-hidden="true"></span>
            <input type="search" role="combobox" aria-label="Search modules" autocomplete="off"
                   aria-autocomplete="list" aria-expanded={results.length > 0}
                   aria-controls={results.length ? id : undefined}
                   aria-activedescendant={results.length ? id + '-' + selected : undefined}
                   placeholder="Search modules" bind:this={input} bind:value={query}
                   on:input={() => selected = 0} on:keydown={handleKeys}/>
            <button type="button" class="close-search" aria-label="Close module search" on:click={() => close(true)}>
                <VectorIcon name="close" size={7 * scale}/>
            </button>
        </div>
    {:else}
        <button type="button" class="search-trigger" aria-label="Open module search" aria-expanded="false"
                bind:this={trigger} on:click={open}>
            <span class="search-icon" aria-hidden="true"></span>
            <span>Search</span>
        </button>
    {/if}
</div>

<style>
    .search-dock {
        position: fixed;
        left: calc(8px * var(--scale));
        bottom: calc(8px * var(--scale));
        z-index: 10000;
        width: calc(62px * var(--scale));
        max-width: calc(100vw - 49px * var(--scale));
        border-radius: calc(14px * var(--scale));
        background: #131012ed;
        color: var(--text-color);
        box-shadow: var(--opai-hud-shadow);
        overflow: hidden;
        transition: width 240ms cubic-bezier(.18,.8,.3,1.08), border-radius 240ms;
        font: calc(8.5px * var(--scale)) 'Google Sans', 'Opai CJK', sans-serif;
    }
    .search-dock.expanded { width: calc(149px * var(--scale)); border-radius: calc(10px * var(--scale)); }
    .search-bar, .search-trigger {
        display: flex;
        align-items: center;
        gap: calc(4px * var(--scale));
        width: 100%;
        height: calc(26.7px * var(--scale));
        padding: 0 calc(7px * var(--scale));
    }
    .search-trigger, .close-search, .result {
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
    }
    .search-trigger { color: var(--accent-color); justify-content: center; }
    .search-trigger:focus-visible { outline-offset: -3px; }
    .search-icon {
        flex: 0 0 auto;
        width: calc(8px * var(--scale));
        height: calc(8px * var(--scale));
        background: var(--accent-color);
        mask: url('/img/menu/icon-search.svg') center / contain no-repeat;
    }
    .search-bar input {
        flex: 1;
        min-width: 0;
        font: inherit;
        color: inherit;
        background: transparent;
        border: 0;
        outline: none;
    }
    input::-webkit-search-cancel-button { appearance: none; }
    .close-search {
        flex: none;
        display: grid;
        place-items: center;
        width: calc(12px * var(--scale));
        height: calc(12px * var(--scale));
        padding: 0;
    }
    .search-results {
        padding: calc(4px * var(--scale));
        max-height: min(46vh, calc(108px * var(--scale)));
        overflow-y: auto;
        overscroll-behavior: contain;
    }
    .result {
        display: block;
        width: 100%;
        padding: calc(4px * var(--scale)) calc(5px * var(--scale));
        border-radius: calc(4px * var(--scale));
        text-align: left;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .result.selected, .result:hover { color: var(--accent-color); background: #ffffff12; }
    .empty-results { padding: calc(7px * var(--scale)); color: var(--text-dimmed-color); }
</style>
