import mermaid from 'mermaid';

/** 避免多处同时 `mermaid.run` 打乱内部状态 */
let runQueue: Promise<void> = Promise.resolve();

export type RunMermaidInMarkdownOptions = {
	/** 偏暗界面时使用 Mermaid dark 主题 */
	preferDark?: boolean;
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
		const scope = root.classList.contains('markdown-body')
			? root
			: (root.querySelector<HTMLElement>('.markdown-body') ?? root);
		const nodes = scope.querySelectorAll<HTMLElement>(
			'.markdown-mermaid-wrap[data-mermaid="1"] .mermaid',
		);
		if (nodes.length === 0) return;

		try {
			mermaid.initialize({
				startOnLoad: false,
				theme: options?.preferDark ? 'dark' : 'default',
				securityLevel: 'loose',
			});
			await mermaid.run({
				nodes: Array.from(nodes),
				suppressErrors: false,
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
