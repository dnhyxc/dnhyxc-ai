import type mermaidApi from 'mermaid';
import { queryMermaidMarkdownEntryNodes } from './markdown-selectors.js';

/** 避免多处同时 `mermaid.run` 打乱内部状态 */
let runQueue: Promise<void> = Promise.resolve();

/** 避免每次 run 都 `initialize` 造成主题与内部状态抖动 */
let lastMermaidInitSignature = '';

let mermaidMod: typeof mermaidApi | null = null;

/** Vite / MF 可能把 default 再包一层；只认带 initialize+run 的实例 */
function resolveMermaidApi(mod: unknown): typeof mermaidApi {
	const candidates: unknown[] = [];
	let cur: unknown = mod;
	for (let i = 0; i < 3 && cur != null; i++) {
		candidates.push(cur);
		if (typeof cur !== 'object' || !('default' in cur)) break;
		cur = (cur as { default: unknown }).default;
	}
	for (const c of candidates) {
		try {
			if (
				c &&
				typeof c === 'object' &&
				typeof (c as typeof mermaidApi).initialize === 'function' &&
				typeof (c as typeof mermaidApi).run === 'function'
			) {
				return c as typeof mermaidApi;
			}
		} catch {
			// vitest mock Proxy：访问未声明的 named export 会抛错，跳过该候选
		}
	}
	throw new Error('[mermaid-in-markdown] unexpected mermaid module shape');
}

async function loadMermaid(): Promise<typeof mermaidApi> {
	if (mermaidMod) return mermaidMod;
	const mod = await import('mermaid');
	mermaidMod = resolveMermaidApi(mod);
	return mermaidMod;
}

function ensureMermaidInitialized(
	mermaid: typeof mermaidApi,
	preferDark?: boolean,
): void {
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
 * 由 `@dnhyxc-ai/markdown-kit/react` 导出；`mermaid` 为 tsup external，随本包 dependencies 安装供打包器解析。
 * 首次调用才动态加载 mermaid，避免主包/路由壳打入整图库。
 */
export async function runMermaidInMarkdownRoot(
	root: HTMLElement | null | undefined,
	options?: RunMermaidInMarkdownOptions,
): Promise<void> {
	if (!root) return;

	const task = async (): Promise<void> => {
		// 从 root 全子树收集，避免 shell 内多个 `.markdown-body`（正文 + 思考区）时只命中第一个
		const nodes = queryMermaidMarkdownEntryNodes(root);
		if (nodes.length === 0) return;

		try {
			const mermaid = await loadMermaid();
			ensureMermaidInitialized(mermaid, options?.preferDark);
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
