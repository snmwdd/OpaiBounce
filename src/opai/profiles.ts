import {get} from 'svelte/store';
import {getModules, getModuleSettings, setModuleSettings, setModuleEnabled, getPersistentStorageItem} from '../integration/rest';
import {savePersistentItem} from '../integration/persistent_storage';
import type {ChoiceSetting, ConfigurableSetting, ModuleSetting} from '../integration/types';
import {opaiPreferences} from './preferences';

const PROFILE_KEY = 'opai.profiles';
export type Profile = {
    name: string;
    created: string;
    modules: {name: string; enabled: boolean; settings: ConfigurableSetting}[];
};
let loading = false;

export async function readProfiles(): Promise<Profile[]> {
    const stored = await getPersistentStorageItem(PROFILE_KEY);
    try {
        const entries = JSON.parse(stored ?? localStorage.getItem(PROFILE_KEY) ?? '[]');
        return Array.isArray(entries) ? entries : [];
    } catch {
        return [];
    }
}

export async function writeProfiles(profiles: Profile[]) {
    const encoded = JSON.stringify(profiles);
    await savePersistentItem(PROFILE_KEY, encoded);
    if (await getPersistentStorageItem(PROFILE_KEY) !== encoded) {
        throw new Error('LiquidBounce did not retain the configuration list.');
    }
}

export async function captureProfile(name: string): Promise<Profile> {
    const modules = await getModules();
    const snapshot: Profile = {name, created: new Date().toISOString(), modules: []};
    // Bound the number of requests to the native server and retain module order.
    for (let index = 0; index < modules.length; index += 4) {
        const batch = await Promise.all(modules.slice(index, index + 4).map(async module => {
            try {
                const settings = await getModuleSettings(module.name);
                if (!Array.isArray(settings.value)) throw new Error('Invalid settings');
                const enabled = settings.value.find(setting => setting.name === 'Enabled')?.value;
                return {name: module.name, enabled: typeof enabled === 'boolean' ? enabled : module.enabled, settings};
            } catch (error) {
                throw new Error(`Cannot save ${module.name}: ${String(error)}`);
            }
        }));
        snapshot.modules.push(...batch);
    }
    return snapshot;
}

function isGroup(setting: ModuleSetting): setting is ConfigurableSetting {
    return ['CONFIGURABLE', 'TOGGLEABLE', 'CHOICE'].includes(setting.valueType) && Array.isArray(setting.value);
}

function withoutBindings(group: ConfigurableSetting): ConfigurableSetting {
    const value = group.value.filter(setting => !['BIND', 'KEY'].includes(setting.valueType)).map(setting => {
        if (!isGroup(setting)) return setting;
        const filtered = withoutBindings(setting);
        if (setting.valueType !== 'CHOICE') return filtered;
        const choice = setting as ChoiceSetting;
        const choices = Object.fromEntries(Object.entries(choice.choices ?? {}).map(
            ([name, branch]) => [name, isGroup(branch) ? withoutBindings(branch) : branch],
        ));
        return {...choice, value: filtered.value, choices};
    });
    return {...group, value};
}

function sameValue(expected: unknown, actual: unknown): boolean {
    if (typeof expected === 'number' && typeof actual === 'number') {
        return Math.abs(expected - actual) <= Math.max(1, Math.abs(expected)) * 1e-7;
    }
    if (Array.isArray(expected)) {
        return Array.isArray(actual) && expected.length === actual.length
            && expected.every((item, index) => sameValue(item, actual[index]));
    }
    if (expected !== null && typeof expected === 'object' && actual !== null && typeof actual === 'object') {
        const keys = Object.keys(expected);
        return keys.length === Object.keys(actual).length && keys.every(key =>
            sameValue((expected as Record<string, unknown>)[key], (actual as Record<string, unknown>)[key]),
        );
    }
    return Object.is(expected, actual);
}

function firstMismatch(expected: ConfigurableSetting, actual: ConfigurableSetting, path = ''): string | undefined {
    // The API omits hidden values. Verify values exposed by the current client,
    // including values that became visible after applying the saved mode.
    const remaining = [...actual.value];
    for (const setting of expected.value) {
        const index = remaining.findIndex(current => current.name === setting.name && current.valueType === setting.valueType);
        if (index < 0) continue;
        const [current] = remaining.splice(index, 1);
        const settingPath = path + setting.name;
        if (isGroup(setting) && isGroup(current)) {
            if (setting.valueType === 'CHOICE') {
                const savedChoice = setting as ChoiceSetting, actualChoice = current as ChoiceSetting;
                if (savedChoice.active !== actualChoice.active) return settingPath;
                for (const [name, branch] of Object.entries(savedChoice.choices ?? {})) {
                    const currentBranch = actualChoice.choices?.[name];
                    if (!isGroup(branch) || !currentBranch || !isGroup(currentBranch)) continue;
                    const mismatch = firstMismatch(branch, currentBranch, settingPath + '.' + name + '.');
                    if (mismatch) return mismatch;
                }
            }
            const mismatch = firstMismatch(setting, current, settingPath + '.');
            if (mismatch) return mismatch;
        } else if (!sameValue(setting.value, current.value)) {
            return settingPath;
        }
    }
}

export async function loadProfile(snapshot: Profile) {
    if (loading) throw new Error('A configuration is already loading.');
    if (!Array.isArray(snapshot?.modules) || snapshot.modules.some(module =>
        typeof module?.name !== 'string' || typeof module.enabled !== 'boolean' || !Array.isArray(module.settings?.value),
    )) throw new Error('Invalid configuration');

    loading = true;
    try {
        const failures: string[] = [];
        const existing = new Set((await getModules()).map(module => module.name));
        const loadKeybinds = get(opaiPreferences).loadKeybinds;
        const applied: {name: string; enabled: boolean; settings: ConfigurableSetting}[] = [];

        // The native endpoint saves the shared modules file on each write.
        for (const module of snapshot.modules) {
            if (!existing.has(module.name)) {
                failures.push(module.name + ' unavailable');
                continue;
            }
            const settings = loadKeybinds ? module.settings : withoutBindings(module.settings);
            const parameters = {...settings, value: settings.value.filter(setting => setting.name !== 'Enabled')};
            try {
                if (parameters.value.length) await setModuleSettings(module.name, parameters);
                applied.push({...module, settings: parameters});
            } catch (error) {
                failures.push(`${module.name} parameters (${String(error)})`);
            }
        }

        const beforeToggle = new Map((await getModules()).map(module => [module.name, module.enabled]));
        for (const module of applied) {
            if (module.name === 'ClickGUI' || beforeToggle.get(module.name) === module.enabled) continue;
            try {
                await setModuleEnabled(module.name, module.enabled);
            } catch (error) {
                failures.push(`${module.name} state (${String(error)})`);
            }
        }

        const verified = new Map((await getModules()).map(module => [module.name, module.enabled]));
        for (let index = 0; index < applied.length; index += 4) {
            const batch = await Promise.all(applied.slice(index, index + 4).map(async module => {
                const problems: string[] = [];
                if (module.name !== 'ClickGUI' && verified.get(module.name) !== module.enabled) {
                    problems.push(module.name + ' enabled state');
                }
                if (module.settings.value.length) {
                    try {
                        const mismatch = firstMismatch(module.settings, await getModuleSettings(module.name));
                        if (mismatch) problems.push(`${module.name}.${mismatch}`);
                    } catch (error) {
                        problems.push(`${module.name} verification (${String(error)})`);
                    }
                }
                return problems;
            }));
            failures.push(...batch.flat());
        }
        if (failures.length) throw new Error('Configuration loaded with errors: ' + [...new Set(failures)].join(', '));
    } finally {
        loading = false;
        window.dispatchEvent(new Event('opai-profile-loaded'));
    }
}
