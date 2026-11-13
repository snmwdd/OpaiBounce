import {writable} from 'svelte/store';
import {getModuleSettings, getPersistentStorageItem, setModuleSettings} from '../integration/rest';
import {savePersistentItem} from '../integration/persistent_storage';
import type {BooleanSetting, ConfigurableSetting, TogglableSetting} from '../integration/types';

export const OPAI_PREFERENCES_KEY = 'opai.preferences';

const defaults = {
    shadows: true,
    blur: true,
    islandStyle: 'new' as 'new' | 'old',
    loadKeybinds: false,
    icmpPing: true,
    search: true,
};

export type OpaiPreferences = typeof defaults;
export const opaiPreferences = writable<OpaiPreferences>({...defaults});
let revision = 0;
let saving = false;
let lastNativeRecord: string | null | undefined;
let lastAppliedRead = 0;
let reads = 0;

function parsePreferences(raw: string | null): OpaiPreferences {
    let stored: Partial<OpaiPreferences> | null = null;
    try {
        stored = raw ? JSON.parse(raw) : null;
    } catch {
        // A damaged preference record can be replaced by changing a setting.
    }
    return {
        shadows: typeof stored?.shadows === 'boolean' ? stored.shadows : defaults.shadows,
        blur: typeof stored?.blur === 'boolean' ? stored.blur : defaults.blur,
        islandStyle: stored?.islandStyle === 'old' ? 'old' : 'new',
        loadKeybinds: stored?.loadKeybinds === true,
        icmpPing: stored?.icmpPing !== false,
        search: stored?.search !== false,
    };
}

function nativeBlur(settings: ConfigurableSetting) {
    const group = settings.value.find(
        setting => setting.name === 'Blur' && setting.valueType === 'TOGGLEABLE',
    ) as TogglableSetting | undefined;
    const enabled = group?.value.find(
        setting => setting.name === 'Enabled' && setting.valueType === 'BOOLEAN',
    ) as BooleanSetting | undefined;
    return group && enabled ? {group, enabled} : undefined;
}

export async function refreshOpaiPreferences(readNativeBlur = false) {
    if (saving) return;
    const request = revision;
    const read = ++reads;
    const raw = await getPersistentStorageItem(OPAI_PREFERENCES_KEY);
    if (!readNativeBlur && raw === lastNativeRecord) return;
    const preferences = parsePreferences(raw);
    if (readNativeBlur) {
        const blur = await getModuleSettings('HUD').then(nativeBlur).catch(() => undefined);
        if (blur) preferences.blur = blur.enabled.value;
    }
    if (!saving && request === revision && read >= lastAppliedRead) {
        lastAppliedRead = read;
        lastNativeRecord = raw;
        opaiPreferences.set(preferences);
    }
}

export async function changeOpaiPreference<K extends keyof OpaiPreferences>(key: K, value: OpaiPreferences[K]) {
    if (saving) throw new Error('An Opai setting is already being saved.');
    saving = true;
    revision++;
    try {
        const preferences = parsePreferences(await getPersistentStorageItem(OPAI_PREFERENCES_KEY));
        let restoreBlur: (() => Promise<void>) | undefined;
        if (key === 'blur') {
            const settings = await getModuleSettings('HUD');
            const blur = nativeBlur(settings);
            if (blur && blur.enabled.value !== value) {
                const writeBlur = (enabled: boolean) => setModuleSettings('HUD', {
                    ...settings,
                    value: [{...blur.group, value: [{...blur.enabled, value: enabled}]}],
                });
                restoreBlur = () => writeBlur(blur.enabled.value);
                try {
                    await writeBlur(value as boolean);
                    if (nativeBlur(await getModuleSettings('HUD'))?.enabled.value !== value) {
                        throw new Error('LiquidBounce did not apply the Blur setting.');
                    }
                } catch (error) {
                    await restoreBlur().catch(() => {});
                    throw error;
                }
            }
        }
        preferences[key] = value;
        const encoded = JSON.stringify(preferences);
        try {
            await savePersistentItem(OPAI_PREFERENCES_KEY, encoded);
        } catch (error) {
            await restoreBlur?.().catch(() => {});
            throw error;
        }
        lastNativeRecord = encoded;
        opaiPreferences.set(preferences);
    } finally {
        saving = false;
    }
}

export function installOpaiPreferences() {
    const root = document.documentElement;
    const apply = opaiPreferences.subscribe(preferences => {
        root.dataset.opaiShadows = preferences.shadows ? 'on' : 'off';
        root.dataset.opaiBlur = preferences.blur ? 'on' : 'off';
    });
    const sync = () => void refreshOpaiPreferences(true).catch(() => {});
    const storageChanged = (event: StorageEvent) => {
        if (event.key === OPAI_PREFERENCES_KEY) sync();
    };
    window.addEventListener('storage', storageChanged);
    window.addEventListener('opai-profile-loaded', sync);
    sync();
    return () => {
        revision++;
        apply();
        window.removeEventListener('storage', storageChanged);
        window.removeEventListener('opai-profile-loaded', sync);
    };
}
