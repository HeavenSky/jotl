// 源码, jotl.config.json 与界面语言在 localStorage 中的读写; 存储不可用(隐私模式, 配额满, 被禁用)时不抛异常.
export const SOURCE_STORAGE_KEY = "jotl-playground:source";
export const CONFIG_STORAGE_KEY = "jotl-playground:config";
export const LOCALE_STORAGE_KEY = "jotl-playground:locale";

function storage(): Storage | undefined {
	try {
		return globalThis.localStorage;
	} catch {
		return undefined;
	}
}

function load(key: string): string | undefined {
	try {
		return storage()?.getItem(key) ?? undefined;
	} catch {
		return undefined;
	}
}

/** 返回是否写入成功. */
function save(key: string, value: string): boolean {
	try {
		const target = storage();
		if (target === undefined) return false;
		target.setItem(key, value);
		return true;
	} catch {
		return false;
	}
}

export const loadSource = (): string | undefined => load(SOURCE_STORAGE_KEY);
export const saveSource = (source: string): boolean => save(SOURCE_STORAGE_KEY, source);
export const loadConfig = (): string | undefined => load(CONFIG_STORAGE_KEY);
export const saveConfig = (config: string): boolean => save(CONFIG_STORAGE_KEY, config);
export const loadLocaleChoice = (): string | undefined => load(LOCALE_STORAGE_KEY);
export const saveLocaleChoice = (locale: string): boolean => save(LOCALE_STORAGE_KEY, locale);
