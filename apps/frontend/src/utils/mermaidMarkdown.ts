import type { Mermaid } from 'mermaid';

/** 懒加载 Mermaid，仅在存在图表块时拉取，减轻首屏体积 */
let mermaidPromise: Promise<Mermaid> | null = null;

async function loadMermaid(): Promise<Mermaid> {
	if (!mermaidPromise) {
		mermaidPromise = import('mermaid').then((m) => m.default);
	}
	return mermaidPromise;
}

export type RunMermaidInMarkdownOptions = {
	/** 偏暗界面（如 theme-black）时使用 dark 主题 */
	preferDark?: boolean;
};

/**
 * 在已挂载的 Markdown 容器内查找 MarkdownParser 输出的 `[data-mermaid="1"]` 块并渲染为 SVG。
 */
export async function runMermaidInMarkdownRoot(
	root: HTMLElement | null | undefined,
	options?: RunMermaidInMarkdownOptions,
): Promise<void> {
	if (!root) return;
	const nodes = root.querySelectorAll<HTMLElement>(
		'.markdown-mermaid-wrap[data-mermaid="1"] .mermaid',
	);
	if (nodes.length === 0) return;

	try {
		const mermaid = await loadMermaid();
		mermaid.initialize({
			startOnLoad: false,
			theme: options?.preferDark ? 'dark' : 'default',
			securityLevel: 'strict',
		});
		await mermaid.run({
			nodes: Array.from(nodes),
			suppressErrors: true,
		});
	} catch {
		// 图表语法错误或加载失败时不阻断页面
	}
}
