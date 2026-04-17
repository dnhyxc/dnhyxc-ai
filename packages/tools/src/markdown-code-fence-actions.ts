export type MarkdownCodeFenceAction = 'copy' | 'download';

export type MarkdownCodeFenceCopyFeedbackOptions = {
	copiedText?: string;
	resetAfterMs?: number;
	stateAttrName?: string;
};

export type MarkdownCodeFenceInfo = {
	block: HTMLElement;
	code: string;
	lang: string;
	fileExtension: string;
	filename: string;
};

export type MarkdownCodeFenceTextInit = {
	code: string;
	lang?: string;
	filename?: string;
};

export type MarkdownCodeFenceDownloadTask = {
	code: string;
	lang: string;
	fileExtension: string;
	filename: string;
	blob: Blob;
};

export type MarkdownCodeFenceActionPayload = MarkdownCodeFenceInfo & {
	action: MarkdownCodeFenceAction;
	button: HTMLButtonElement;
	root: HTMLElement | Document;
};

export type BindMarkdownCodeFenceActionsOptions = {
	getFilename?: (info: Omit<MarkdownCodeFenceInfo, 'filename'>) => string;
	onCopy?: (payload: MarkdownCodeFenceActionPayload) => void | Promise<void>;
	onDownload?: (
		payload: MarkdownCodeFenceActionPayload,
	) => void | Promise<void>;
	onAction?: (payload: MarkdownCodeFenceActionPayload) => void | Promise<void>;
	preventDefault?: boolean;
	stopPropagation?: boolean;
	enableDefaultCopy?: boolean;
	copyFeedback?: boolean | MarkdownCodeFenceCopyFeedbackOptions;
};

const LANG_TO_EXT: Record<string, string> = {
	typescript: 'ts',
	ts: 'ts',
	tsx: 'tsx',
	javascript: 'js',
	js: 'js',
	jsx: 'jsx',
	json: 'json',
	python: 'py',
	py: 'py',
	rust: 'rs',
	rs: 'rs',
	go: 'go',
	java: 'java',
	html: 'html',
	css: 'css',
	md: 'md',
	markdown: 'md',
	yaml: 'yml',
	yml: 'yml',
	sh: 'sh',
	bash: 'sh',
};

export function markdownCodeFenceFileExtension(lang: string): string {
	const key = lang.toLowerCase().trim();
	if (!key) return 'txt';
	return LANG_TO_EXT[key] || (/^[a-z0-9+.#-]{1,24}$/i.test(key) ? key : 'txt');
}

export function getMarkdownCodeFencePlainText(block: HTMLElement): string {
	const code = block.querySelector('pre code');
	return code?.textContent ?? '';
}

export function getMarkdownCodeFenceInfo(
	block: HTMLElement,
	options: Pick<BindMarkdownCodeFenceActionsOptions, 'getFilename'> = {},
): MarkdownCodeFenceInfo {
	const code = getMarkdownCodeFencePlainText(block);
	const lang =
		block
			.querySelector('.chat-md-code-lang')
			?.textContent?.trim()
			?.toLowerCase() || 'text';
	const fileExtension = markdownCodeFenceFileExtension(lang);
	const baseInfo = { block, code, lang, fileExtension };
	return {
		...baseInfo,
		filename: options.getFilename?.(baseInfo) ?? `code.${fileExtension}`,
	};
}

/**
 * 不依赖 DOM，直接由代码文本构造代码块信息；适合 Mermaid 代码模式等非标准 block 场景。
 */
export function createMarkdownCodeFenceInfo(
	init: MarkdownCodeFenceTextInit,
): Omit<MarkdownCodeFenceInfo, 'block'> {
	const lang = init.lang?.trim().toLowerCase() || 'text';
	const fileExtension = markdownCodeFenceFileExtension(lang);
	return {
		code: init.code,
		lang,
		fileExtension,
		filename: init.filename ?? `code.${fileExtension}`,
	};
}

export function resolveMarkdownCodeFenceActionPayload(
	target: EventTarget | null,
	root: HTMLElement | Document,
	options: Pick<BindMarkdownCodeFenceActionsOptions, 'getFilename'> = {},
): MarkdownCodeFenceActionPayload | null {
	const el =
		target instanceof Element
			? target
			: target instanceof Node
				? target.parentElement
				: null;
	const button = el?.closest<HTMLButtonElement>('[data-chat-code-action]');
	if (!button || !root.contains(button)) return null;
	const action = button.getAttribute(
		'data-chat-code-action',
	) as MarkdownCodeFenceAction | null;
	if (action !== 'copy' && action !== 'download') return null;
	const block = button.closest<HTMLElement>('[data-chat-code-block]');
	if (!block || !root.contains(block)) return null;
	return {
		action,
		button,
		root,
		...getMarkdownCodeFenceInfo(block, options),
	};
}

export async function copyMarkdownCodeFence(
	info: Pick<MarkdownCodeFenceInfo, 'code'>,
): Promise<void> {
	await navigator.clipboard.writeText(info.code);
}

/**
 * 统一把代码块信息转换为可下载任务，并交给宿主提供的下载器执行。
 */
export async function downloadMarkdownCodeFenceWith(
	info: Pick<
		MarkdownCodeFenceInfo,
		'code' | 'lang' | 'fileExtension' | 'filename'
	>,
	download: (task: MarkdownCodeFenceDownloadTask) => void | Promise<void>,
): Promise<void> {
	const blob = new Blob([info.code], { type: 'text/plain;charset=utf-8' });
	await download({
		code: info.code,
		lang: info.lang,
		fileExtension: info.fileExtension,
		filename: info.filename,
		blob,
	});
}

export function showMarkdownCodeFenceCopiedFeedback(
	button: HTMLButtonElement,
	options: MarkdownCodeFenceCopyFeedbackOptions = {},
): void {
	const copiedText = options.copiedText ?? '已复制';
	const resetAfterMs = options.resetAfterMs ?? 1500;
	const stateAttrName = options.stateAttrName ?? 'data-chat-code-copied';
	const prev = button.textContent;
	button.setAttribute(stateAttrName, '1');
	button.textContent = copiedText;
	window.setTimeout(() => {
		button.removeAttribute(stateAttrName);
		button.textContent = prev;
	}, resetAfterMs);
}

/**
 * 这里声明两次是 TypeScript 的函数重载（function overload，函数重载），
 * 目的是同时支持两种更直观的调用方式：
 * - `bindMarkdownCodeFenceActions(options)`
 * - `bindMarkdownCodeFenceActions(root, options)`
 *
 * 前两段只是“对外类型签名”，真正的实现只有下面第三段。
 * 这样做可以让调用方拿到更清晰的参数提示，避免直接暴露丑陋的联合参数类型。
 */
export function bindMarkdownCodeFenceActions(
	options?: BindMarkdownCodeFenceActionsOptions,
): () => void;
export function bindMarkdownCodeFenceActions(
	root: HTMLElement | Document,
	options?: BindMarkdownCodeFenceActionsOptions,
): () => void;
export function bindMarkdownCodeFenceActions(
	rootOrOptions?: HTMLElement | Document | BindMarkdownCodeFenceActionsOptions,
	maybeOptions: BindMarkdownCodeFenceActionsOptions = {},
): () => void {
	const root =
		rootOrOptions instanceof HTMLElement || rootOrOptions instanceof Document
			? rootOrOptions
			: document;
	const options =
		rootOrOptions instanceof HTMLElement || rootOrOptions instanceof Document
			? maybeOptions
			: (rootOrOptions ?? {});
	const onClick = (event: Event) => {
		const payload = resolveMarkdownCodeFenceActionPayload(
			event.target,
			root,
			options,
		);
		if (!payload) return;
		if (options.preventDefault !== false) {
			event.preventDefault();
		}
		if (options.stopPropagation === true) {
			event.stopPropagation();
		}
		if (payload.action === 'copy') {
			const run = async () => {
				if (options.onCopy) {
					await options.onCopy(payload);
				} else if (options.enableDefaultCopy !== false) {
					await copyMarkdownCodeFence(payload);
					if (options.copyFeedback !== false) {
						showMarkdownCodeFenceCopiedFeedback(
							payload.button,
							typeof options.copyFeedback === 'object'
								? options.copyFeedback
								: undefined,
						);
					}
				}
			};
			void run();
		} else if (payload.action === 'download') {
			void options.onDownload?.(payload);
		}
		void options.onAction?.(payload);
	};
	root.addEventListener('click', onClick);
	return () => {
		root.removeEventListener('click', onClick);
	};
}
