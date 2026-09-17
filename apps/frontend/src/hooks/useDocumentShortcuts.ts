import { useEffect, useRef, useState } from 'react';
import {
	chordMatchesStored,
	KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS,
	KNOWLEDGE_SHORTCUTS_CHANGED_EVENT,
	loadKnowledgeShortcutChords,
} from '@/utils/knowledge-shortcuts';

type DocShortcutHandlers = {
	onSave?: () => void;
	onNew?: () => void;
};

let handlers: DocShortcutHandlers = {};

/** 当前页注册保存/新建；返回解绑（仅当仍是同一函数引用时清空） */
export function bindDocumentShortcutHandlers(
	next: DocShortcutHandlers,
): () => void {
	handlers = { ...handlers, ...next };
	return () => {
		if (next.onSave && handlers.onSave === next.onSave) {
			handlers = { ...handlers, onSave: undefined };
		}
		if (next.onNew && handlers.onNew === next.onNew) {
			handlers = { ...handlers, onNew: undefined };
		}
	};
}

/** Layout 挂载：应用内统一监听「通用：保存 / 新建」chord */
export function useDocumentShortcuts(): {
	saveChord: string;
	newChord: string;
} {
	const [chords, setChords] = useState<{ save: string; clear: string }>({
		save: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.save,
		clear: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.clear,
	});
	const chordsRef = useRef(chords);
	chordsRef.current = chords;

	useEffect(() => {
		const reload = async () => {
			const c = await loadKnowledgeShortcutChords();
			setChords({ save: c.save, clear: c.clear });
		};
		void reload();
		const onChanged = () => void reload();
		window.addEventListener(KNOWLEDGE_SHORTCUTS_CHANGED_EVENT, onChanged);
		return () => {
			window.removeEventListener(KNOWLEDGE_SHORTCUTS_CHANGED_EVENT, onChanged);
		};
	}, []);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			const { save, clear } = chordsRef.current;
			if (chordMatchesStored(save, e)) {
				const fn = handlers.onSave;
				if (!fn) return;
				e.preventDefault();
				fn();
				return;
			}
			if (chordMatchesStored(clear, e)) {
				const fn = handlers.onNew;
				if (!fn) return;
				e.preventDefault();
				fn();
			}
		};
		window.addEventListener('keydown', onKeyDown, true);
		return () => window.removeEventListener('keydown', onKeyDown, true);
	}, []);

	return { saveChord: chords.save, newChord: chords.clear };
}

/** 页面侧只读当前保存/新建 chord（用于 Tooltip） */
export function useDocumentShortcutHints(): {
	saveChord: string;
	newChord: string;
} {
	const [chords, setChords] = useState<{ save: string; clear: string }>({
		save: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.save,
		clear: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.clear,
	});

	useEffect(() => {
		const reload = async () => {
			const c = await loadKnowledgeShortcutChords();
			setChords({ save: c.save, clear: c.clear });
		};
		void reload();
		const onChanged = () => void reload();
		window.addEventListener(KNOWLEDGE_SHORTCUTS_CHANGED_EVENT, onChanged);
		return () => {
			window.removeEventListener(KNOWLEDGE_SHORTCUTS_CHANGED_EVENT, onChanged);
		};
	}, []);

	return { saveChord: chords.save, newChord: chords.clear };
}
