/** Tauri 保存命令返回（Rust `SaveFileResult` 序列化为 camelCase） */
export type SaveKnowledgeMarkdownResult = {
	success: string;
	message: string;
	filePath?: string;
};

/** `resolve_knowledge_markdown_target` 返回 */
export type KnowledgeMarkdownTarget = {
	path: string;
	exists: boolean;
};

/** 解析 `invoke` 抛错（Tauri 常为非 Error 对象） */
export function formatTauriInvokeError(e: unknown): string {
	if (e instanceof Error) return e.message;
	if (typeof e === 'string') return e;
	if (e && typeof e === 'object' && 'message' in e) {
		const m = (e as { message: unknown }).message;
		if (typeof m === 'string') return m;
	}
	try {
		return '保存失败';
	} catch {
		return '未知错误';
	}
}

function buildInvokeInput(payload: SaveKnowledgeMarkdownPayload) {
	return {
		title: payload.title,
		content: payload.content,
		...(payload.filePath != null && payload.filePath !== ''
			? { filePath: payload.filePath }
			: {}),
		...(payload.dirPath != null && payload.dirPath !== ''
			? { dirPath: payload.dirPath }
			: {}),
		...(payload.overwrite === true ? { overwrite: true } : {}),
		...(payload.previousTitle != null && payload.previousTitle !== ''
			? { previousTitle: payload.previousTitle }
			: {}),
	};
}

/** Tauri `save_knowledge_markdown` / `resolve_knowledge_markdown_target` 入参 */
export type SaveKnowledgeMarkdownPayload = {
	title: string;
	content: string;
	/**
	 * 保存路径（优先于 dirPath）：
	 * - 以 `.md` 结尾或指向已有文件 → 按完整文件路径写入；
	 * - 已有目录、末尾带 `/`、或普通文件夹路径 → 在该目录下生成 `标题.md`。
	 */
	filePath?: string;
	/** 仅目录；等价于把目录传给 filePath */
	dirPath?: string;
	/** 为 true 时覆盖已存在的同名文件 */
	overwrite?: boolean;
	/**
	 * 编辑已有条目且标题已变更时传入：打开该条时的原标题（用于本地 .md 重命名，避免旧文件残留成「第二条」）
	 */
	previousTitle?: string;
};

/** 解析即将写入的路径及是否已存在（用于覆盖确认） */
export async function invokeResolveKnowledgeMarkdownTarget(
	payload: SaveKnowledgeMarkdownPayload,
): Promise<KnowledgeMarkdownTarget> {
	const { invoke } = await import('@tauri-apps/api/core');
	return invoke<KnowledgeMarkdownTarget>('resolve_knowledge_markdown_target', {
		input: buildInvokeInput(payload),
	});
}

/** 桌面端写入本地 Markdown */
export async function invokeSaveKnowledgeMarkdown(
	payload: SaveKnowledgeMarkdownPayload,
): Promise<SaveKnowledgeMarkdownResult> {
	const { invoke } = await import('@tauri-apps/api/core');
	return invoke<SaveKnowledgeMarkdownResult>('save_knowledge_markdown', {
		input: buildInvokeInput(payload),
	});
}

/** Tauri `delete_knowledge_markdown` 入参（与保存共用路径规则） */
export type DeleteKnowledgeMarkdownPayload = {
	title: string;
	filePath?: string;
	dirPath?: string;
};

function buildDeleteInvokeInput(payload: DeleteKnowledgeMarkdownPayload) {
	return {
		title: payload.title,
		...(payload.filePath != null && payload.filePath !== ''
			? { filePath: payload.filePath }
			: {}),
		...(payload.dirPath != null && payload.dirPath !== ''
			? { dirPath: payload.dirPath }
			: {}),
	};
}

/** 桌面端按标题与目录删除本地 Markdown */
export async function invokeDeleteKnowledgeMarkdown(
	payload: DeleteKnowledgeMarkdownPayload,
): Promise<SaveKnowledgeMarkdownResult> {
	const { invoke } = await import('@tauri-apps/api/core');
	return invoke<SaveKnowledgeMarkdownResult>('delete_knowledge_markdown', {
		input: buildDeleteInvokeInput(payload),
	});
}

/** `list_knowledge_markdown_files` 入参 */
export type ListKnowledgeMarkdownInput = {
	/** 为空时使用应用默认知识库目录 */
	dirPath?: string;
};

/** 目录下列出的单条 Markdown 元信息 */
export type KnowledgeMarkdownFileEntry = {
	path: string;
	title: string;
	updatedAtMs: number;
};

/** 递归列出目录下所有 `.md` 文件（按修改时间新→旧排序） */
export async function invokeListKnowledgeMarkdownFiles(
	input: ListKnowledgeMarkdownInput,
): Promise<KnowledgeMarkdownFileEntry[]> {
	const { invoke } = await import('@tauri-apps/api/core');
	return invoke<KnowledgeMarkdownFileEntry[]>('list_knowledge_markdown_files', {
		input: {
			...(input.dirPath != null && input.dirPath !== ''
				? { dirPath: input.dirPath }
				: {}),
		},
	});
}

/** 读取单个 Markdown 文件正文 */
export async function invokeReadKnowledgeMarkdownFile(
	filePath: string,
): Promise<string> {
	const { invoke } = await import('@tauri-apps/api/core');
	const res = await invoke<{ content: string }>(
		'read_knowledge_markdown_file',
		{
			input: { filePath },
		},
	);
	return res.content;
}

/** 在检测到的编辑器中打开本地 .md（逻辑见 Tauri `open_knowledge_markdown_in_editor`；文档 §2.8） */
export async function invokeOpenKnowledgeMarkdownInEditor(
	filePath: string,
): Promise<{ openedWith: string }> {
	const { invoke } = await import('@tauri-apps/api/core');
	return invoke<{ openedWith: string }>('open_knowledge_markdown_in_editor', {
		input: { filePath },
	});
}

/** 保存路径解析用：从绝对路径取父目录 */
export function dirnameFs(filePath: string): string {
	const n = filePath.replace(/[/\\]+$/, '');
	const i = Math.max(n.lastIndexOf('/'), n.lastIndexOf('\\'));
	if (i <= 0) return n;
	return n.slice(0, i);
}

/** 拆分标题中的主名与扩展（无扩展时默认 `.md`） */
export function splitKnowledgeTitleStemAndExt(title: string): {
	stem: string;
	ext: string;
} {
	const t = title.trim() || '未命名';
	const lower = t.toLowerCase();
	for (const ext of ['.md', '.markdown', '.mdx'] as const) {
		if (lower.endsWith(ext)) {
			return { stem: t.slice(0, -ext.length), ext };
		}
	}
	return { stem: t, ext: '.md' };
}

/**
 * 另存为专用：仅用于 Tauri 落盘文件名，**不修改编辑器标题**。
 * 后缀为 `_年-月-日-时:分:秒`（如 `_2026-04-01-15:30:45`）；Rust 侧 sanitize 会把 `:` 换成 `-` 以兼容 Windows。
 * 仍冲突则再追加 `_2`、`_3`…
 */
export async function pickNonConflictingDiskFileTitle(
	seedTitle: string,
	pending: SaveKnowledgeMarkdownPayload,
): Promise<string> {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	const timeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	const { stem, ext } = splitKnowledgeTitleStemAndExt(seedTitle);
	for (let n = 0; n < 50; n++) {
		const mid = n === 0 ? `_${timeStr}` : `_${timeStr}_${n + 1}`;
		const candidate = `${stem}${mid}${ext}`;
		const target = await invokeResolveKnowledgeMarkdownTarget({
			...pending,
			title: candidate,
			content: '',
			overwrite: false,
		});
		if (!target.exists) return candidate;
	}
	throw new Error('无法找到可用文件名');
}

/** 根据标题扩展名选择 Monaco language，CSS 等才能走对应 Prettier parser */
export function monacoLanguageFromKnowledgeTitle(title: string): string {
	const t = title.trim().toLowerCase();
	const dot = t.lastIndexOf('.');
	if (dot < 0) return 'markdown';
	const ext = t.slice(dot + 1);
	switch (ext) {
		case 'css':
			return 'css';
		case 'scss':
		case 'sass':
			return 'scss';
		case 'less':
			return 'less';
		case 'json':
			return 'json';
		case 'html':
		case 'htm':
			return 'html';
		case 'ts':
			return 'typescript';
		case 'tsx':
			return 'typescriptreact';
		case 'jsx':
			return 'javascriptreact';
		case 'js':
		case 'mjs':
		case 'cjs':
			return 'javascript';
		case 'yaml':
		case 'yml':
			return 'yaml';
		case 'md':
		case 'markdown':
		case 'mdx':
			return 'markdown';
		default:
			return 'markdown';
	}
}

/** 与原先 persist 内联逻辑一致：仅有 username / id 时写入 author / authorId */
export function buildAuthorMeta(
	user: { username?: unknown; id?: unknown } | null,
): {
	author?: string;
	authorId?: number;
} {
	if (!user || (user.username == null && user.id == null)) {
		return {};
	}
	return {
		...(user.username != null ? { author: user.username as string } : {}),
		...(user.id != null ? { authorId: user.id as number } : {}),
	};
}
