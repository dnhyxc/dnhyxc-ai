/**
 * 英语学习列表续读：按侧栏模块开关与清除（服务端持久化 + 本地会话缓存）。
 */
import { ENGLISH_LEARNING_LIST_RESUME_LIBRARY_ID } from '@/constants';
import { hasValidAuthToken } from '@/router/authPaths';
import {
	type ElResumeModuleSettings,
	getElResumeModuleSettings,
	listEnglishClassicQuotesLibraries,
	listEnglishVocabularyLibraries,
	patchElListResume,
	patchElResumeModuleSetting,
} from '@/service';
import type { ElFixedListScope } from '@/store/englishLearningResume';
import {
	clearElResumeOffset,
	elFixedListKind,
	elFixedListResumeId,
} from '@/store/englishLearningResume';
import type { LibraryKind } from '@/views/englishLearning/library/types';
import { invalidateLibraryWordsListCache } from './libraryWordsListCache';

export type ElResumeModuleKey = keyof ElResumeModuleSettings;

export const EL_RESUME_MODULE_KEYS: ElResumeModuleKey[] = [
	'library-vocab',
	'library-classic',
	'favorites',
	'mistakes',
	'daily-memorize',
];

export const EL_RESUME_SETTINGS_CHANGED =
	'english-learning-resume-settings-changed';

const FIXED_SCOPES_BY_MODULE: Record<
	Exclude<ElResumeModuleKey, `library-${string}`>,
	ElFixedListScope[]
> = {
	favorites: ['vocab-favorites', 'classic-favorites'],
	mistakes: ['vocab-mistakes', 'classic-mistakes'],
	'daily-memorize': ['vocab-daily-memorize'],
};

const CACHE_NS_BY_SCOPE: Record<ElFixedListScope, string> = {
	'vocab-favorites': 'vocab-favorites',
	'classic-favorites': 'classic-favorites',
	'vocab-mistakes': 'vocab-mistakes',
	'classic-mistakes': 'classic-mistakes',
	'vocab-daily-memorize': 'vocab-daily-memorize',
};

let settingsRevision = 0;
const revisionListeners = new Set<() => void>();
const disabledModules = new Set<ElResumeModuleKey>();
let hydratePromise: Promise<void> | null = null;

function bumpSettingsRevision(): void {
	settingsRevision += 1;
	for (const listener of revisionListeners) listener();
	window.dispatchEvent(
		new CustomEvent(EL_RESUME_SETTINGS_CHANGED, { bubbles: true }),
	);
}

function applyModuleSettings(modules: ElResumeModuleSettings): boolean {
	const nextDisabled = new Set<ElResumeModuleKey>();
	for (const key of EL_RESUME_MODULE_KEYS) {
		if (modules[key] === false) nextDisabled.add(key);
	}
	const changed =
		nextDisabled.size !== disabledModules.size ||
		[...nextDisabled].some((key) => !disabledModules.has(key));
	disabledModules.clear();
	for (const key of nextDisabled) disabledModules.add(key);
	return changed;
}

export function getElResumeSettingsRevision(): number {
	return settingsRevision;
}

export function subscribeElResumeSettings(listener: () => void): () => void {
	revisionListeners.add(listener);
	return () => revisionListeners.delete(listener);
}

/** 从服务端拉取模块开关（登录用户）；可重入 */
export async function hydrateElResumeModuleSettings(): Promise<void> {
	if (!hasValidAuthToken()) {
		if (disabledModules.size > 0) {
			disabledModules.clear();
			bumpSettingsRevision();
		}
		return;
	}
	if (hydratePromise) return hydratePromise;
	hydratePromise = (async () => {
		try {
			const res = await getElResumeModuleSettings({ silent: true });
			if (res.data?.modules && applyModuleSettings(res.data.modules)) {
				bumpSettingsRevision();
			}
		} catch {
			// ponytail: 拉取失败保持默认全开
		}
	})();
	return hydratePromise;
}

export function resetElResumeModuleSettingsCache(): void {
	disabledModules.clear();
	hydratePromise = null;
	bumpSettingsRevision();
}

export function libraryResumeModuleKey(kind: LibraryKind): ElResumeModuleKey {
	return kind === 'vocab' ? 'library-vocab' : 'library-classic';
}

/** 词库/语句库条目或固定列表占位 library_id 对应的侧栏模块 */
export function entryResumeModuleKey(
	kind: LibraryKind,
	libraryId: string,
): ElResumeModuleKey {
	const id = libraryId.trim();
	const R = ENGLISH_LEARNING_LIST_RESUME_LIBRARY_ID;
	if (id === R.vocabFavorites || id === R.classicFavorites) return 'favorites';
	if (id === R.vocabMistakes || id === R.classicMistakes) return 'mistakes';
	if (id === R.vocabDailyMemorize) return 'daily-memorize';
	return libraryResumeModuleKey(kind);
}

export function fixedListResumeModuleKey(
	scope: ElFixedListScope,
): ElResumeModuleKey {
	if (scope.endsWith('-favorites')) return 'favorites';
	if (scope.endsWith('-mistakes')) return 'mistakes';
	return 'daily-memorize';
}

export function isElResumeModuleEnabled(moduleKey: ElResumeModuleKey): boolean {
	return !disabledModules.has(moduleKey);
}

// 将某侧栏模块的阅读进度开关写入服务端，并同步本页内存中的 disabledModules 与订阅方
export async function setElResumeModuleEnabled(
	// 目标模块：词库/语句库/收藏/错题/记词记录之一，与后端 moduleKey 一致
	moduleKey: ElResumeModuleKey,
	// true 开启续读记录与按进度加载；false 关闭后不再写入 offset，列表也不读已有进度
	enabled: boolean,
): Promise<void> {
	// 未登录无法 PATCH 用户级设置，提前失败由调用方 Toast
	if (!hasValidAuthToken()) {
		// 抛出固定文案，EnglishSidebarResumeMenu 捕获后提示需登录
		throw new Error('login required');
	}
	// 请求 PATCH /items-resume/modules，持久化该模块的 enabled 状态
	const res = await patchElResumeModuleSetting(moduleKey, enabled);
	// 响应带全量 modules 时以服务端为准刷新本地禁用集合
	if (res.data?.modules) {
		// 用返回的全表覆盖 disabledModules，避免与 DB 其它模块状态不一致
		applyModuleSettings(res.data.modules);
		// 响应无 modules 时按本次入参乐观更新单模块（兼容异常响应体）
	} else if (enabled) {
		// 开启：从禁用集合移除，isElResumeModuleEnabled 随即返回 true
		disabledModules.delete(moduleKey);
	} else {
		// 关闭：加入禁用集合，后续 resolve/set/flush 续读均短路
		disabledModules.add(moduleKey);
	}
	// 通知 useSyncExternalStore / 列表 hook 重载，使关闭后立即停止按进度加载
	bumpSettingsRevision();
}

async function clearFixedScopeResume(scope: ElFixedListScope): Promise<void> {
	const kind = elFixedListKind(scope);
	const id = elFixedListResumeId(scope);
	clearElResumeOffset(kind, id);
	invalidateLibraryWordsListCache(CACHE_NS_BY_SCOPE[scope], id);
	if (hasValidAuthToken()) {
		await patchElListResume(kind, id, 0);
	}
}

async function clearLibraryKindResume(kind: LibraryKind): Promise<void> {
	const cacheNs = kind;
	const listFn =
		kind === 'vocab'
			? listEnglishVocabularyLibraries
			: listEnglishClassicQuotesLibraries;
	if (hasValidAuthToken()) {
		const res = await listFn({ limit: 1000, offset: 0 });
		const libs = Array.isArray(res.data) ? res.data : [];
		await Promise.all(
			libs.map(async (lib) => {
				clearElResumeOffset(kind, lib.id);
				invalidateLibraryWordsListCache(cacheNs, lib.id);
				await patchElListResume(kind, lib.id, 0);
			}),
		);
		return;
	}
	// ponytail: 未登录仅清会话缓存，无库列表 API
}

/** 清除模块下全部续读（本地 + 服务端 offset 归零） */
export async function clearElResumeModule(
	moduleKey: ElResumeModuleKey,
): Promise<void> {
	if (moduleKey === 'library-vocab') {
		await clearLibraryKindResume('vocab');
	} else if (moduleKey === 'library-classic') {
		await clearLibraryKindResume('classic');
	} else {
		await Promise.all(
			FIXED_SCOPES_BY_MODULE[moduleKey].map((scope) =>
				clearFixedScopeResume(scope),
			),
		);
	}
	bumpSettingsRevision();
}
