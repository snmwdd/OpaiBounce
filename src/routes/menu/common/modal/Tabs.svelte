<script lang="ts">
    import type {Component, Snippet} from "svelte";

    interface Props {
        tabs: Tab[];
        activeTab?: number;
        onChangeTab?: (activeTab: number) => void | Promise<void>;
    }

    type Content = Component | Snippet;

    type SubTab = {
        title: string;
        content: Content;
    };

    type Tab = {
        title: string;
        icon: string;
        content: Content | SubTab[];
    };

    let availableTabsElement = $state<HTMLElement | undefined>();
    let activeSubTabs = $state<Record<number, number>>({});

    let {tabs, activeTab = $bindable(0), onChangeTab}: Props = $props();

    let subTabs = $derived(tabs[activeTab]?.content ?? []) as SubTab[];

    const ActiveContent = $derived.by(() => {
        const content = tabs[activeTab]?.content;

        if (Array.isArray(content)) {
            if (content.length === 0) {
                return undefined;
            }

            const activeSubTab = activeSubTabs[activeTab] ?? 0;
            return content[Math.min(activeSubTab, content.length - 1)]?.content;
        }

        return content;
    });

    function setActiveTab(i: number) {
        activeTab = i;
        onChangeTab?.(activeTab);
    }

    function setActiveSubTab(i: number) {
        activeSubTabs[activeTab] = i;
    }
</script>

<div class="tabs">
    <div class="available-tabs" bind:this={availableTabsElement}>
        {#each tabs as {title, icon}, index}
            <button
                    class="tab-button"
                    class:active={index === activeTab}
                    onclick={() => setActiveTab(index)}
                    type="button" aria-pressed={index === activeTab}
            >
                <img class="icon" src="img/menu/altmanager/{icon}" alt="">
                <span>{title}</span>
            </button>
        {/each}
    </div>

    <div class="tab-content">
        {#if Array.isArray(tabs[activeTab]?.content)}
            <div class="available-sub-tabs">
                {#each subTabs as subTab, index (subTab.title)}
                    <button
                            class="sub-tab-button"
                            class:active={index === (activeSubTabs[activeTab] ?? 0)}
                            onclick={() => setActiveSubTab(index)}
                            type="button"
                    >
                        {subTab.title}
                    </button>
                {/each}
            </div>
        {/if}

        <div class="content">
            {#if ActiveContent}
                <ActiveContent/>
            {/if}
        </div>
    </div>
</div>

<style>
.available-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:3px;background:#2e2625;border-radius:7px}.tab-button{display:flex;align-items:center;gap:7px;min-width:0;min-height:25px;padding:4px 7px;border:0;border-radius:4px;background:none;color:#cdb7b4;font:9px 'Google Sans','Opai CJK',sans-serif;cursor:pointer}.tab-button .icon{display:block;flex:none;width:14px;height:14px;object-fit:contain}.tab-button.active{background:#483a37;color:var(--accent-color)}.tab-button:hover{background:#483a3780}.available-sub-tabs{display:flex;gap:3px;margin-top:10px;padding:3px;background:#2e2625;border-radius:6px}.sub-tab-button{flex:1;min-width:0;min-height:22px;padding:4px 3px;border:0;border-radius:4px;color:#cdb7b4;background:none;font:8px 'Google Sans','Opai CJK',sans-serif;cursor:pointer}.sub-tab-button.active{background:#483a37;color:var(--accent-color)}.content{margin-top:10px;min-width:0}
</style>
