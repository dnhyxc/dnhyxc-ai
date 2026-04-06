import mermaid from 'mermaid';

/** 避免多处同时 `mermaid.run` 打乱内部状态 */
let runQueue: Promise<void> = Promise.resolve();

/** 避免每次 run 都 `initialize` 造成主题与内部状态抖动 */
let lastMermaidInitSignature = '';

function ensureMermaidInitialized(preferDark?: boolean): void {
	const signature = preferDark ? 'dark' : 'default';
	if (lastMermaidInitSignature === signature) return;
	lastMermaidInitSignature = signature;
	mermaid.initialize({
		startOnLoad: false,
		theme: preferDark ? 'dark' : 'default',
		securityLevel: 'loose',
	});
}

export type RunMermaidInMarkdownOptions = {
	/** 偏暗界面时使用 Mermaid dark 主题 */
	preferDark?: boolean;
	/** 流式等不完整 DSL 时可 true，减少错误占位闪烁；默认 false */
	suppressErrors?: boolean;
};

/**
 * 在已挂载的 Markdown 容器内查找 `[data-mermaid="1"]` 占位块并渲染为 SVG。
 * 由 `@dnhyxc-ai/tools/react` 导出；`mermaid` 为 tsup external，随本包 dependencies 安装供打包器解析。
 */
export async function runMermaidInMarkdownRoot(
	root: HTMLElement | null | undefined,
	options?: RunMermaidInMarkdownOptions,
): Promise<void> {
	if (!root) return;

	const task = async (): Promise<void> => {
		// 从 root 全子树收集，避免 shell 内多个 `.markdown-body`（正文 + 思考区）时只命中第一个
		const nodes = root.querySelectorAll<HTMLElement>(
			'.markdown-mermaid-wrap[data-mermaid="1"] .mermaid',
		);
		if (nodes.length === 0) return;

		try {
			ensureMermaidInitialized(options?.preferDark);
			await mermaid.run({
				nodes: Array.from(nodes),
				suppressErrors: options?.suppressErrors === true,
			});
		} catch (err) {
			if (typeof console !== 'undefined' && console.warn) {
				console.warn('[mermaid-in-markdown]', err);
			}
		}
	};

	runQueue = runQueue.then(task).catch(() => {});
	await runQueue;
}
