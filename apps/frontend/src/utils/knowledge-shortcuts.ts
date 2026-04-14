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
}> {
	const [s, c, o, b, t] = await Promise.all([
		getValue<string>(`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.save}`),
		getValue<string>(`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.clear}`),
		getValue<string>(`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.openLibrary}`),
		getValue<string>(
			`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.toggleMarkdownBottomBar}`,
		),
		getValue<string>(`shortcut_${KNOWLEDGE_SHORTCUT_KEY_IDS.openTrash}`),
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
	};
}

/** 设置页保存知识库快捷键后派发，知识页可立即重载 */
export const KNOWLEDGE_SHORTCUTS_CHANGED_EVENT =
	'dnhyxc-knowledge-shortcuts-changed';
