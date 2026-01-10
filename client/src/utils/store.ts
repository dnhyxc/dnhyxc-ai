import { appDataDir, join } from '@tauri-apps/api/path';
import { Store } from '@tauri-apps/plugin-store';

const dataDir = await appDataDir();
const settingsPath = await join(dataDir, 'settings.json');
console.log(settingsPath, 'settingsPath');
const store = await Store.load(settingsPath);

console.log(store, 'store');

export const setValue = async <T = any>(
	key: string,
	value: T,
	saveNow = true,
) => {
	await store.set(key, value);
	if (saveNow) {
		await save();
	}
};

export const getValue = async <T = any>(
	key: string,
): Promise<T | undefined> => {
	return await store.get(key);
};

export const save = async () => {
	return await store.save();
};

export const deleteValue = async (key: string) => {
	await store.delete(key);
};
