import {
	getTrackedLearningNotesNoteId,
	saveLearningNoteAwait,
	saveLearningNoteKeepalive,
	setTrackedLearningNotesNoteId,
} from './learningNotesHttpSync';
import { tryGetLearningNotesStoreFromGlobal } from './learningNotesStoreSync';
import {
	getLearningNotesWindowId,
	type LearningNotesSyncMessage,
	publishLearningNotesSync,
	subscribeLearningNotesSync,
} from './learningNotesSyncBus';

const PLUGIN_SELECTOR = '[data-mf-plugin="learningNotes"]';
const DEBOUNCE_MS = 180;

let draftRevision = 0;
let lastLocalInputAt = 0;
let applyingRemote = false;

function findPluginRoot(): HTMLElement | null {
	return document.querySelector(PLUGIN_SELECTOR);
}

function findProseMirror(root: HTMLElement): HTMLElement | null {
	return root.querySelector('.ProseMirror');
}

function findPreviewBodies(root: HTMLElement): HTMLElement[] {
	return Array.from(
		root.querySelectorAll(
			'.note-preview .tiptap, .note-preview .prose, .note-preview [class*="preview-body"]',
		),
	) as HTMLElement[];
}

function readTitle(root: HTMLElement): string {
	const h1 = root.querySelector('.ProseMirror h1');
	if (h1?.textContent?.trim()) return h1.textContent.trim();
	const badge = root.querySelector(
		'.note-preview h1, .note-preview [class*="title"]',
	);
	return badge?.textContent?.trim() ?? '';
}

function collectDraft(root: HTMLElement) {
	const noteId = getTrackedLearningNotesNoteId();
	const pm = findProseMirror(root);
	if (!noteId || !pm) return null;
	const html = pm.innerHTML;
	const text = pm.textContent?.trim() ?? '';
	return {
		noteId,
		html,
		text,
		title: readTitle(root),
	};
}

function applyHtmlToProseMirror(pm: HTMLElement, html: string) {
	if (pm.innerHTML === html) return;
	pm.focus();
	const range = document.createRange();
	range.selectNodeContents(pm);
	const sel = window.getSelection();
	sel?.removeAllRanges();
	sel?.addRange(range);
	document.execCommand('insertHTML', false, html);
	pm.dispatchEvent(
		new InputEvent('input', { bubbles: true, cancelable: true }),
	);
}

function applyRemoteDraft(
	root: HTMLElement,
	msg: Extract<LearningNotesSyncMessage, { type: 'draft' }>,
) {
	const pm = findProseMirror(root);
	if (pm) {
		applyHtmlToProseMirror(pm, msg.html);
		return;
	}
	for (const body of findPreviewBodies(root)) {
		if (body.innerHTML !== msg.html) body.innerHTML = msg.html;
	}
	const titleEl = root.querySelector('.note-preview h1');
	if (titleEl && msg.title) titleEl.textContent = msg.title;
}

function applyRemoteSaved(
	root: HTMLElement,
	msg: Extract<LearningNotesSyncMessage, { type: 'saved' }>,
) {
	const pm = findProseMirror(root);
	if (pm && getTrackedLearningNotesNoteId() === msg.noteId) {
		applyHtmlToProseMirror(pm, msg.html);
	}
	for (const body of findPreviewBodies(root)) {
		if (body.innerHTML !== msg.html) body.innerHTML = msg.html;
	}
	const titleEl = root.querySelector('.note-preview h1');
	if (titleEl && msg.title) titleEl.textContent = msg.title;
}

function handleRemote(msg: LearningNotesSyncMessage) {
	if ('windowId' in msg && msg.windowId === getLearningNotesWindowId()) return;
	const root = findPluginRoot();
	if (!root) return;

	if (msg.type === 'selection' && msg.noteId) {
		setTrackedLearningNotesNoteId(msg.noteId);
		return;
	}

	// 有插件 store 时由 TipTap setContent / MobX 应用，避免 execCommand 漏删空行
	if (tryGetLearningNotesStoreFromGlobal()) return;

	if (msg.type === 'draft' && msg.noteId === getTrackedLearningNotesNoteId()) {
		applyingRemote = true;
		try {
			applyRemoteDraft(root, msg);
		} finally {
			applyingRemote = false;
		}
		return;
	}
	if (msg.type === 'saved' && msg.noteId === getTrackedLearningNotesNoteId()) {
		if (!msg.html.trim()) return;
		applyingRemote = true;
		try {
			applyRemoteSaved(root, msg);
		} finally {
			applyingRemote = false;
		}
	}
}

/** ponytail: 无插件 store 时的 DOM 草稿同步；升级路径为 connectStore + 编辑器 API */
export function attachLearningNotesDomSync(): () => void {
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	const localWindowId = getLearningNotesWindowId();

	const flushDraft = () => {
		if (applyingRemote) return;
		// store 路径由插件 scheduleLearningNotesDraftPublish 负责
		if (tryGetLearningNotesStoreFromGlobal()) return;
		const root = findPluginRoot();
		if (!root) return;
		const draft = collectDraft(root);
		if (!draft) return;
		draftRevision += 1;
		publishLearningNotesSync({
			type: 'draft',
			...draft,
			revision: draftRevision,
			windowId: localWindowId,
			ts: Date.now(),
		});
	};

	const onEditorInput = () => {
		if (applyingRemote) return;
		lastLocalInputAt = Date.now();
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(flushDraft, DEBOUNCE_MS);
	};

	const onClick = (ev: MouseEvent) => {
		const root = findPluginRoot();
		if (!root?.contains(ev.target as Node)) return;
		const card = (ev.target as HTMLElement).closest('.grid > div');
		if (!card) return;
		const idx = Array.from(card.parentElement?.children ?? []).indexOf(card);
		if (idx < 0) return;
		const titles = root.querySelectorAll('.grid > div .truncate.text-base');
		const title = titles[idx]?.textContent?.trim();
		if (!title) return;
		const listItem = root.querySelectorAll('.grid > div')[idx];
		const idAttr = listItem?.getAttribute('data-note-id');
		if (idAttr) setTrackedLearningNotesNoteId(idAttr);
	};

	const observer = new MutationObserver(() => {
		const root = findPluginRoot();
		const pm = root ? findProseMirror(root) : null;
		if (!pm || pm.dataset.lnDomSync === '1') return;
		pm.dataset.lnDomSync = '1';
		pm.addEventListener('input', onEditorInput);
	});

	observer.observe(document.body, { childList: true, subtree: true });
	document.addEventListener('click', onClick, true);
	const unsub = subscribeLearningNotesSync(handleRemote);

	const root = findPluginRoot();
	const pm = root ? findProseMirror(root) : null;
	if (pm && pm.dataset.lnDomSync !== '1') {
		pm.dataset.lnDomSync = '1';
		pm.addEventListener('input', onEditorInput);
	}

	return () => {
		if (debounceTimer) clearTimeout(debounceTimer);
		observer.disconnect();
		document.removeEventListener('click', onClick, true);
		unsub();
		const r = findPluginRoot();
		const editor = r ? findProseMirror(r) : null;
		editor?.removeEventListener('input', onEditorInput);
	};
}

export function shouldRemountLearningNotesOnListChange(): boolean {
	if (document.activeElement?.closest('.ProseMirror')) return false;
	return Date.now() - lastLocalInputAt > 1500;
}

function hasNoteBody(html: string, text: string): boolean {
	if (text.trim()) return true;
	const plain = html
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/gi, ' ')
		.trim();
	return plain.length > 0;
}

/** 关窗前从 DOM 读当前正文并 keepalive 保存（不依赖 dirty 标记） */
export function flushLearningNotesDomKeepaliveOnClose(
	noteIdOverride?: string | null,
): boolean {
	const root = findPluginRoot();
	if (!root) return false;
	const noteId = noteIdOverride ?? getTrackedLearningNotesNoteId();
	const pm = findProseMirror(root);
	if (!pm) return false;
	const html = pm.innerHTML;
	const text = pm.textContent?.trim() ?? '';
	if (!hasNoteBody(html, text)) return false;
	saveLearningNoteKeepalive({
		id: noteId,
		title: readTitle(root),
		html,
	});
	return true;
}

/** 托管关窗：await DOM 快照保存 */
export async function flushLearningNotesDomSaveOnClose(
	noteIdOverride?: string | null,
): Promise<boolean> {
	const root = findPluginRoot();
	if (!root) return false;
	const noteId = noteIdOverride ?? getTrackedLearningNotesNoteId();
	const pm = findProseMirror(root);
	if (!pm) return false;
	const html = pm.innerHTML;
	const text = pm.textContent?.trim() ?? '';
	if (!hasNoteBody(html, text)) return false;
	return saveLearningNoteAwait({
		id: noteId,
		title: readTitle(root),
		html,
	});
}
