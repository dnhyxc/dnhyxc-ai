/** 侧栏输入：settle / 面板挂载后再由 read 页唯一交焦 */

export const EPUB_THOUGHT_COMPOSE_INPUT_ID = 'epub-thought-compose-input';
export const EPUB_ASSISTANT_INPUT_ID = 'epub-assistant-compose-input';
export const EPUB_READER_HOST_ATTR = 'data-epub-reader-host';

function focusTextareaById(id: string, scrollToEnd = false): boolean {
	const el = document.getElementById(id) as HTMLTextAreaElement | null;
	if (!el) return false;
	el.focus({ preventScroll: true });
	if (document.activeElement !== el) return false;
	const end = el.value.length;
	el.setSelectionRange(end, end);
	if (scrollToEnd) el.scrollTop = el.scrollHeight;
	return true;
}

export function focusThoughtComposeInput(): boolean {
	return focusTextareaById(EPUB_THOUGHT_COMPOSE_INPUT_ID);
}

/** MK 问书输入框：光标置于末尾（预填摘录场景） */
export function focusEpubAssistantInput(): boolean {
	return focusTextareaById(EPUB_ASSISTANT_INPUT_ID, true);
}

/** 开栏期间挂起阅读区指针，避免 mouseup/清选区把焦点打进 iframe */
export function setEpubReaderPointerSuspended(suspended: boolean): void {
	const host = document.querySelector(
		`[${EPUB_READER_HOST_ATTR}]`,
	) as HTMLElement | null;
	if (!host) return;
	host.style.pointerEvents = suspended ? 'none' : '';
}
