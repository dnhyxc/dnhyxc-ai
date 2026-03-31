/** Tauri 保存命令返回（Rust `SaveFileResult` 序列化为 camelCase） */
export type SaveKnowledgeMarkdownResult = {
	success: string;
	message: string;
	filePath?: string;
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
		return JSON.stringify(e);
	} catch {
		return '未知错误';
	}
}

/** Tauri `save_knowledge_markdown` 入参（与 Rust `SaveKnowledgeMarkdownArgs` 对应） */
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
};

/** 桌面端写入本地 Markdown（可选自定义路径）。未传路径时写入「与下载相同的 savePath」下的 `knowledge` 子目录 */
export async function invokeSaveKnowledgeMarkdown(
	payload: SaveKnowledgeMarkdownPayload,
): Promise<SaveKnowledgeMarkdownResult> {
	const { invoke } = await import('@tauri-apps/api/core');
	// Tauri 2：结构体参数必须放在与 Rust 形参同名的键下（此处为 `input`），字段用 camelCase 对应 SaveKnowledgeMarkdownInput
	return invoke<SaveKnowledgeMarkdownResult>('save_knowledge_markdown', {
		input: {
			title: payload.title,
			content: payload.content,
			...(payload.filePath != null && payload.filePath !== ''
				? { filePath: payload.filePath }
				: {}),
			...(payload.dirPath != null && payload.dirPath !== ''
				? { dirPath: payload.dirPath }
				: {}),
		},
	});
}
