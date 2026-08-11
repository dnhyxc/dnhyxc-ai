/**
 * 通用本地文件选择（Tauri 系统对话框 → 返回本地绝对路径）。
 *
 * ---------------------------------------------------------------------------
 * 何时用
 * ---------------------------------------------------------------------------
 * - 桌面端需要系统原生「打开文件」对话框（含扩展名过滤、单选/多选）
 * - 只要路径，不把大文件读进内存（视频、电子书等后续自行 `convertFileSrc` / 读取）
 * - Web 端无此能力；请用 `<input type="file">` 或 `DragDropFileUpload`
 *
 * ---------------------------------------------------------------------------
 * 导入
 * ---------------------------------------------------------------------------
 * ```ts
 * import { pickLocalFiles, selectFile, selectFiles } from '@/utils';
 * // 或
 * import { pickLocalFiles, selectFile, selectFiles } from '@/utils/select-files';
 * ```
 *
 * ---------------------------------------------------------------------------
 * 推荐入口：`pickLocalFiles`（按 `multiple` 自动收窄返回类型）
 * ---------------------------------------------------------------------------
 * ```ts
 * // 1) 单选、不限类型 → string | null
 * const path = await pickLocalFiles();
 * if (!path) return; // 用户取消
 *
 * // 2) 单选 + 扩展名限制
 * const md = await pickLocalFiles({ accept: '.md', title: '导入 Markdown' });
 *
 * // 3) 多选 + 视频扩展名 → string[] | null
 * const videos = await pickLocalFiles({
 *   accept: '.mp4,.webm,.mov,.mkv,.flv,.m4v,.ogg,.ogv',
 *   multiple: true,
 *   title: '选择视频',
 * });
 * if (!videos?.length) return;
 * ```
 *
 * ---------------------------------------------------------------------------
 * 语义化别名（行为等价，返回类型更直观）
 * ---------------------------------------------------------------------------
 * ```ts
 * // 单选 → string | null（内部强制 multiple: false）
 * const path = await selectFile({ accept: '.json' });
 *
 * // 多选 → string[] | null（内部强制 multiple: true）
 * const paths = await selectFiles({
 *   accept: '.png,.jpg,.jpeg,.webp',
 *   title: '选择图片',
 * });
 * ```
 *
 * ---------------------------------------------------------------------------
 * 参数 `SelectFilesOptions`
 * ---------------------------------------------------------------------------
 * | 字段       | 默认     | 说明 |
 * |-----------|----------|------|
 * | `accept`  | 不传/空  | HTML 风格扩展名列表，逗号分隔，如 `.mp4,.webm`；不传则允许所有类型 |
 * | `multiple`| `false`  | `true` 多选；默认单选 |
 * | `title`   | 不传     | 系统对话框标题（部分平台可能忽略） |
 *
 * `accept` 规则：
 * - 只识别以 `.` 开头的扩展名（如 `.mp4`）；大小写不敏感
 * - `video/*`、`image/png` 等 MIME / 通配符**不会**写入系统过滤器（OS 对话框只认扩展名）
 * - 传了有效扩展名后，对话框仅展示对应类型；前端仍会再校验一次路径后缀，防止用户切到「所有文件」误选
 *
 * ---------------------------------------------------------------------------
 * 返回值与错误
 * ---------------------------------------------------------------------------
 * - 用户取消 / 未选中 → `null`（不会抛错）
 * - 成功：单选为绝对路径 `string`；多选为 `string[]`（至少 1 项）
 * - 其它 Tauri / IPC 错误 → 原样 `throw`，由调用方处理
 *
 * ---------------------------------------------------------------------------
 * 与业务专用命令的关系
 * ---------------------------------------------------------------------------
 * - 知识库 `.md`、英语学习 `.json`、电子书等旧专用命令可继续用；新需求优先本模块
 * - 本模块只负责「选路径」；读内容、上传 COS 等请在调用方自行接
 * - 插件 / 子应用请走 Host bridge：`api.ui.pickLocalFiles`（见 federation capabilities）
 */

export type SelectFilesOptions = {
	/** 如 `.mp4,.webm,.mov`；不传/空串 = 任意文件 */
	accept?: string;
	/** 默认 false（单选） */
	multiple?: boolean;
	/** 系统对话框标题 */
	title?: string;
};

/** 从 accept 抽出 `.ext`（与 Rust 侧规则一致，供二次校验） */
export function parseAcceptExtensions(accept: string | undefined): string[] {
	if (!accept?.trim()) return [];
	const out: string[] = [];
	for (const part of accept.split(',')) {
		const s = part.trim();
		if (!s.startsWith('.') || s.length < 2) continue;
		const ext = s.slice(1).trim().toLowerCase();
		if (!ext || ext.includes('*') || ext.includes('/')) continue;
		if (!out.includes(ext)) out.push(ext);
	}
	return out;
}

function pathMatchesAccept(path: string, accept: string | undefined): boolean {
	const exts = parseAcceptExtensions(accept);
	if (exts.length === 0) return true;
	const lower = path.toLowerCase();
	return exts.some((ext) => lower.endsWith(`.${ext}`));
}

function isCanceled(e: unknown): boolean {
	const msg = e instanceof Error ? e.message : String(e ?? '');
	return msg.includes('canceled') || msg.includes('未选择');
}

/** 底层 invoke：始终返回路径数组；取消 null */
async function invokeSelectFilesRaw(
	options: SelectFilesOptions = {},
): Promise<string[] | null> {
	const { invoke } = await import('@tauri-apps/api/core');
	try {
		const paths = await invoke<string[]>('select_files', {
			input: {
				...(options.accept?.trim() ? { accept: options.accept.trim() } : {}),
				...(options.multiple === true ? { multiple: true } : {}),
				...(options.title?.trim() ? { title: options.title.trim() } : {}),
			},
		});
		const accept = options.accept?.trim() || undefined;
		const filtered = (paths ?? []).filter((p) => pathMatchesAccept(p, accept));
		return filtered.length > 0 ? filtered : null;
	} catch (e) {
		if (isCanceled(e)) return null;
		throw e;
	}
}

/** 单选：返回路径；取消 null */
export async function selectFile(
	options?: Omit<SelectFilesOptions, 'multiple'>,
): Promise<string | null> {
	const paths = await invokeSelectFilesRaw({ ...options, multiple: false });
	return paths?.[0] ?? null;
}

/** 多选：返回路径数组；取消 null */
export async function selectFiles(
	options?: Omit<SelectFilesOptions, 'multiple'> & { multiple?: true },
): Promise<string[] | null> {
	return invokeSelectFilesRaw({ ...options, multiple: true });
}

/**
 * 统一入口：默认单选返回 `string | null`；`multiple: true` 返回 `string[] | null`。
 *
 * @example
 * const path = await pickLocalFiles({ accept: '.md' });
 * const videos = await pickLocalFiles({
 *   accept: '.mp4,.webm,.mov,.mkv,.flv,.m4v,.ogg,.ogv',
 *   multiple: true,
 * });
 */
export async function pickLocalFiles(
	options?: SelectFilesOptions & { multiple?: false },
): Promise<string | null>;

export async function pickLocalFiles(
	options: SelectFilesOptions & { multiple: true },
): Promise<string[] | null>;

export async function pickLocalFiles(
	options: SelectFilesOptions = {},
): Promise<string | string[] | null> {
	const paths = await invokeSelectFilesRaw(options);
	if (paths == null) return null;
	return options.multiple === true ? paths : (paths[0] ?? null);
}
