import { getValue, setValue } from '@/utils/store';

/** 与系统设置里 `shortcut_${key}` 对齐 */
export const KNOWLEDGE_SHORTCUT_KEY_IDS = {
	save: 6,
	clear: 7,
	openLibrary: 8,
	/** Markdown 底部操作栏展开/收起 */
	toggleMarkdownBottomBar: 9,
	/** 打开回收站 */
	openTrash: 10,
	/** 将编辑器选中的内容发送到助手输入框 */
	pasteToAssistant: 11,
	/**
	 * Markdown 编辑器底部操作栏：按顺序的快速操作（⌘+1…⌘+0）
	 *
	 * 说明：
	 * - 这些快捷键**仅在知识库页面内生效**（registerGlobally=false）
	 * - 由 `MarkdownEditor` 内部根据当前可用按钮（是否有 Diff/助手/自动保存等）决定是否执行
	 */
	markdownBarAction1: 12,
	markdownBarAction2: 13,
	markdownBarAction3: 14,
	markdownBarAction4: 15,
	markdownBarAction5: 16,
	markdownBarAction6: 17,
	markdownBarAction7: 18,
	markdownBarAction8: 19,
	markdownBarAction9: 20,
	markdownBarAction0: 21,
	/** Markdown 底部操作栏：复位拖动后的几何位置（与「复位操作栏初始位置」按钮一致） */
	markdownBarResetPosition: 22,
} as const;

/** 与 `views/setting/system/config.ts` 中默认值保持一致 */
export const KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS = {
	save: 'Meta + S',
	/** 避免 Meta+Control+D：在 macOS 上常被系统拦截，应用收不到 keydown */
	clear: 'Meta + Shift + D',
	/** Command（Meta）+ Shift + L */
	openLibrary: 'Meta + Shift + L',
	/** Command（Meta）+ Shift + B：切换底部操作栏 */
	toggleMarkdownBottomBar: 'Meta + Shift + B',
	/** Command（Meta）+ Shift + T：打开回收站 */
	openTrash: 'Meta + Shift + T',
	/** Command（Meta）+ Shift + V：将编辑器选中的内容发送到助手输入框 */
	pasteToAssistant: 'Meta + Shift + V',
	/**
	 * Markdown 底部操作栏：按顺序的快速操作（默认 ⌘ + 数字键）。
	 *
	 * 注意：
	 * - 这里只提供默认 chord，实际是否执行由 `MarkdownEditor` 根据按钮可用性判定
	 * - `0` 对应 Digit0
	 */
	markdownBarAction1: 'Meta + 1',
	markdownBarAction2: 'Meta + 2',
	markdownBarAction3: 'Meta + 3',
	markdownBarAction4: 'Meta + 4',
	markdownBarAction5: 'Meta + 5',
	markdownBarAction6: 'Meta + 6',
	markdownBarAction7: 'Meta + 7',
	markdownBarAction8: 'Meta + 8',
	markdownBarAction9: 'Meta + 9',
	markdownBarAction0: 'Meta + 0',
	/** Command（Meta）+ -：复位操作栏位置（避免与 ⌘+数字 冲突） */
	markdownBarResetPosition: 'Meta + -',
} as const;

type ParsedChord = {
	meta: boolean;
	control: boolean;
	alt: boolean;
	shift: boolean;
	/** 主键小写：字母为 a–z，其余为 e.key.toLowerCase()（如 enter、arrowdown） */
	key: string;
};

/** 将存储串解析为修饰键 + 主键；至少需有一个修饰键（与全局快捷键 Rust 规则一致） */
function parseChordString(raw: string | undefined | null): ParsedChord | null {
	if (raw == null || !raw.trim()) return null;
	let meta = false;
	let control = false;
	let alt = false;
	let shift = false;
	const keyTokens: string[] = [];
	for (const part of raw.split(' + ').map((p) => p.trim())) {
		if (!part) continue;
		const low = part.toLowerCase();
		if (['meta', 'super', 'command', 'cmd'].includes(low)) {
			meta = true;
			continue;
		}
		if (['control', 'ctrl'].includes(low)) {
			control = true;
			continue;
		}
		if (low === 'alt') {
			alt = true;
			continue;
		}
		if (low === 'shift') {
			shift = true;
			continue;
		}
		keyTokens.push(part);
	}
	if (keyTokens.length !== 1) return null;
	const keyRaw = keyTokens[0];
	const keyNorm = keyRaw.toLowerCase();
	if (!meta && !control && !alt && !shift) return null;
	return { meta, control, alt, shift, key: keyNorm };
}

/** 判断两条快捷键存储串是否语义相同（忽略 Command/Meta、Ctrl/Control 等写法差异） */
export function chordStringsSemanticallyEqual(
	a: string | undefined | null,
	b: string | undefined | null,
): boolean {
	const pa = parseChordString(a);
	const pb = parseChordString(b);
	if (!pa || !pb) return false;
	return (
		pa.meta === pb.meta &&
		pa.control === pb.control &&
		pa.alt === pb.alt &&
		pa.shift === pb.shift &&
		pa.key === pb.key
	);
}

function eventPrimaryKeyNormalized(e: KeyboardEvent): string | null {
	const k = e.key;
	if (['Control', 'Alt', 'Shift', 'Meta'].includes(k)) return null;
	if (k.length === 1) return k.toLowerCase();
	return k.toLowerCase();
}

/**
 * 主键是否匹配：优先 e.key；组合键下部分环境 e.key 异常时用 e.code 兜底（KeyA–KeyZ、Digit0–9）
 */
function eventKeyMatchesChord(e: KeyboardEvent, expectedKey: string): boolean {
	const fromKey = eventPrimaryKeyNormalized(e);
	if (fromKey != null && fromKey === expectedKey) return true;

	const code = e.code;
	const letter = /^Key([A-Z])$/.exec(code);
	if (letter && expectedKey.length === 1 && /[a-z]/.test(expectedKey)) {
		return letter[1].toLowerCase() === expectedKey;
	}
	const digit = /^Digit([0-9])$/.exec(code);
	if (digit && expectedKey === digit[1]) return true;
	const numpad = /^Numpad([0-9])$/.exec(code);
	if (numpad && expectedKey === numpad[1]) return true;
	// 主键为减号：部分环境 e.key 与 e.code 不一致时用物理键兜底
	if (expectedKey === '-' && (code === 'Minus' || code === 'NumpadSubtract'))
		return true;

	return false;
}

/** 判断当前按键是否与设置中保存的 chord 一致（忽略 Command/Ctrl 等写法差异） */
export function chordMatchesStored(
	stored: string | undefined,
	e: KeyboardEvent,
): boolean {
	const parsed = parseChordString(stored);
	if (!parsed) return false;
	if (e.metaKey !== parsed.meta) return false;
	if (e.ctrlKey !== parsed.control) return false;
	if (e.altKey !== parsed.alt) return false;
	if (e.shiftKey !== parsed.shift) return false;
	return eventKeyMatchesChord(e, parsed.key);
}

/** 旧默认在 macOS 上几乎收不到 keydown，读到则迁移为新默认并写回 store */
function normalizeLegacyClearChord(stored: string | undefined): {
	value: string;
	didMigrate: boolean;
} {
	const raw = stored?.trim() ?? '';
	if (!raw) {
		return {
			value: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.clear,
			didMigrate: false,
		};
	}
	const norm = raw
		.replace(/\s*\+\s*/g, ' + ')
		.replace(/\s+/g, ' ')
		.trim();
	const low = norm.toLowerCase();
	if (low === 'meta + control + d' || low === 'command + control + d') {
		return { value: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.clear, didMigrate: true };
	}
	return { value: raw, didMigrate: false };
}

/** 旧默认 Meta+Control+L 改为 Command+Shift+L，读到则写回 store */
function normalizeLegacyOpenLibraryChord(stored: string | undefined): {
	value: string;
	didMigrate: boolean;
} {
	const raw = stored?.trim() ?? '';
	if (!raw) {
		return {
			value: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.openLibrary,
			didMigrate: false,
		};
	}
	const norm = raw
		.replace(/\s*\+\s*/g, ' + ')
		.replace(/\s+/g, ' ')
		.trim();
	const low = norm.toLowerCase();
	if (low === 'meta + control + l' || low === 'command + control + l') {
		return {
			value: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.openLibrary,
			didMigrate: true,
		};
	}
	return { value: raw, didMigrate: false };
}

/** 旧提示为 Meta+Control+B，与当前默认 Meta+Shift+B 不一致；读到则迁移 */
function normalizeLegacyMarkdownBottomBarChord(stored: string | undefined): {
	value: string;
	didMigrate: boolean;
} {
	const raw = stored?.trim() ?? '';
	if (!raw) {
		return {
			value: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.toggleMarkdownBottomBar,
			didMigrate: false,
		};
	}
	const norm = raw
		.replace(/\s*\+\s*/g, ' + ')
		.replace(/\s+/g, ' ')
		.trim();
	const low = norm.toLowerCase();
	if (low === 'meta + control + b' || low === 'command + control + b') {
		return {
			value: KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.toggleMarkdownBottomBar,
			didMigrate: true,
		};
	}
	return { value: raw, didMigrate: false };
}

/** 从 store 读取知识库页面快捷键（无记录则用默认） */
export async function loadKnowledgeShortcutChords(): Promise<{
	save: string;
	clear: string;
	openLibrary: string;
	toggleMarkdownBottomBar: string;
	openTrash: string;
	pasteToAssistant: string;
	markdownBarAction1: string;
	markdownBarAction2: string;
	markdownBarAction3: string;
	markdownBarAction4: string;
	markdownBarAction5: string;
	markdownBarAction6: string;
	markdownBarAction7: string;
	markdownBarAction8: string;
	markdownBarAction9: string;
	markdownBarAction0: string;
	markdownBarResetPosition: string;
}> {
	const [s, c, o, b, t, v, a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aReset] =
		await Promise.all([
			getValue<string>(`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.save}`),
			getValue<string>(`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.clear}`),
			getValue<string>(`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.openLibrary}`),
			getValue<string>(
				`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.toggleMarkdownBottomBar}`,
			),
			getValue<string>(`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.openTrash}`),
			getValue<string>(
				`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.pasteToAssistant}`,
			),
			getValue<string>(
				`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.markdownBarAction1}`,
			),
			getValue<string>(
				`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.markdownBarAction2}`,
			),
			getValue<string>(
				`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.markdownBarAction3}`,
			),
			getValue<string>(
				`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.markdownBarAction4}`,
			),
			getValue<string>(
				`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.markdownBarAction5}`,
			),
			getValue<string>(
				`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.markdownBarAction6}`,
			),
			getValue<string>(
				`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.markdownBarAction7}`,
			),
			getValue<string>(
				`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.markdownBarAction8}`,
			),
			getValue<string>(
				`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.markdownBarAction9}`,
			),
			getValue<string>(
				`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.markdownBarAction0}`,
			),
			getValue<string>(
				`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.markdownBarResetPosition}`,
			),
		]);
	const { value: clear, didMigrate: clearMigrated } =
		normalizeLegacyClearChord(c);
	if (clearMigrated) {
		await setValue(
			`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.clear}`,
			KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.clear,
		);
	}
	const { value: openLibrary, didMigrate: libMigrated } =
		normalizeLegacyOpenLibraryChord(o);
	if (libMigrated) {
		await setValue(
			`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.openLibrary}`,
			KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.openLibrary,
		);
	}
	const { value: toggleMarkdownBottomBar, didMigrate: barMigrated } =
		normalizeLegacyMarkdownBottomBarChord(b);
	if (barMigrated) {
		await setValue(
			`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.toggleMarkdownBottomBar}`,
			KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.toggleMarkdownBottomBar,
		);
	}
	return {
		save: s?.trim() || KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.save,
		clear,
		openLibrary,
		toggleMarkdownBottomBar,
		openTrash: t?.trim() || KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.openTrash,
		pasteToAssistant:
			v?.trim() || KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.pasteToAssistant,
		markdownBarAction1:
			a1?.trim() || KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction1,
		markdownBarAction2:
			a2?.trim() || KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction2,
		markdownBarAction3:
			a3?.trim() || KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction3,
		markdownBarAction4:
			a4?.trim() || KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction4,
		markdownBarAction5:
			a5?.trim() || KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction5,
		markdownBarAction6:
			a6?.trim() || KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction6,
		markdownBarAction7:
			a7?.trim() || KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction7,
		markdownBarAction8:
			a8?.trim() || KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction8,
		markdownBarAction9:
			a9?.trim() || KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction9,
		markdownBarAction0:
			a0?.trim() || KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarAction0,
		markdownBarResetPosition:
			aReset?.trim() ||
			KNOWLEDGE_SHORTCUT_DEFAULT_CHORDS.markdownBarResetPosition,
	};
}

/** 设置页保存知识库快捷键后派发，知识页可立即重载 */
export const KNOWLEDGE_SHORTCUTS_CHANGED_EVENT =
	'dnhyxc-knowledge-shortcuts-changed';
