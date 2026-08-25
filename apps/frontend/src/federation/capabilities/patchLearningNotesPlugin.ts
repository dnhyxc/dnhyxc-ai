import type { HostBridgeProps, PluginManager } from '@dnhyxc-ai/federation-kit';
import { type ComponentType, createElement, useEffect } from 'react';
import { attachLearningNotesDomSync } from './learningNotesDomSync';
import { installLearningNotesApiSync } from './learningNotesStoreSync';

const PATCHED = Symbol('lnHostPatched');

type PluginMod = {
	default: ComponentType<HostBridgeProps>;
} & Record<symbol | string, unknown>;

function patchModDefault(mod: PluginMod) {
	if (mod[PATCHED]) return;
	const Original = mod.default;
	if (typeof Original !== 'function') return;

	function LearningNotesWithHostSync(props: HostBridgeProps) {
		useEffect(() => {
			const disposeStore = installLearningNotesApiSync(props.api);
			const disposeDom = attachLearningNotesDomSync();
			return () => {
				disposeStore();
				disposeDom();
			};
		}, [props.api]);

		return createElement(Original, props);
	}

	mod.default = LearningNotesWithHostSync;
	mod[PATCHED] = true;
}

/** 包装 learningNotes 插件入口，注入跨窗同步 */
export function patchLearningNotesPluginManager(manager: PluginManager) {
	const original = manager.ensurePlugin.bind(manager);
	manager.ensurePlugin = async (id, opts) => {
		const result = await original(id, opts);
		if (id === 'learningNotes' && result.status === 'activated') {
			patchModDefault(result.mod as PluginMod);
		}
		return result;
	};

	const loaded = manager.get('learningNotes');
	if (loaded?.status === 'activated') {
		patchModDefault(loaded.mod as PluginMod);
	}
}
