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

/** 在检测到的编辑器中打开本地 .md（前台为 Cursor 用 Cursor，否则默认 Trae；见 Tauri `open_knowledge_markdown_in_editor`） */
export async function invokeOpenKnowledgeMarkdownInEditor(
	filePath: string,
): Promise<{ openedWith: string }> {
	const { invoke } = await import('@tauri-apps/api/core');
	return invoke<{ openedWith: string }>('open_knowledge_markdown_in_editor', {
		input: { filePath },
	});
}
