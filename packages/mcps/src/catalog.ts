import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CatalogComponent, ComponentsCatalogFile } from './types.js';

let cached: {
	path: string;
	data: ComponentsCatalogFile;
	mtime: number;
} | null = null;

/** 解析 catalog 文件绝对路径（可通过 DNHYXC_COMPONENT_CATALOG_PATH 覆盖） */
export function getCatalogPath(): string {
	const env = process.env.DNHYXC_COMPONENT_CATALOG_PATH;
	if (env && existsSync(env)) return env;
	const here = dirname(fileURLToPath(import.meta.url));
	const fromDist = join(here, '..', 'catalog', 'components.json');
	if (existsSync(fromDist)) return fromDist;
	return join(here, '..', '..', 'catalog', 'components.json');
}

function readJson(path: string): ComponentsCatalogFile {
	const raw = readFileSync(path, 'utf8');
	const data = JSON.parse(raw) as ComponentsCatalogFile;
	if (!data?.components || !Array.isArray(data.components)) {
		throw new Error(`catalog 格式无效：缺少 components 数组（${path}）`);
	}
	return data;
}

/** 加载并缓存 catalog（按文件 mtime 失效） */
export function loadCatalogSync(): ComponentsCatalogFile {
	const path = getCatalogPath();
	if (!existsSync(path)) {
		throw new Error(
			`未找到组件目录文件：${path}。可设置环境变量 DNHYXC_COMPONENT_CATALOG_PATH。`,
		);
	}
	const mtime = statSync(path).mtimeMs;
	if (cached && cached.path === path && cached.mtime === mtime) {
		return cached.data;
	}
	const data = readJson(path);
	cached = { path, data, mtime };
	return data;
}

export type ListFilters = {
	group?: 'ui' | 'design';
	category?: string;
	tag?: string;
	limit?: number;
};

export function listComponents(filters: ListFilters): CatalogComponent[] {
	const { components } = loadCatalogSync();
	let list = [...components];
	if (filters.group) {
		list = list.filter((c) => c.group === filters.group);
	}
	if (filters.category) {
		const c = filters.category.toLowerCase();
		list = list.filter((x) => x.category.toLowerCase() === c);
	}
	if (filters.tag) {
		const t = filters.tag.toLowerCase();
		list = list.filter((x) =>
			x.tags.some((tag) => tag.toLowerCase().includes(t)),
		);
	}
	const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
	return list.slice(0, limit);
}

export function searchComponents(
	query: string,
	options: { group?: 'ui' | 'design'; limit?: number } = {},
): { item: CatalogComponent; score: number }[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	const tokens = q.split(/\s+/).filter(Boolean);
	const { components } = loadCatalogSync();
	let list = [...components];
	if (options.group) {
		list = list.filter((c) => c.group === options.group);
	}
	const scored = list.map((item) => {
		const hay = [
			item.id,
			item.slug,
			item.name,
			item.title,
			item.description,
			item.category,
			item.source,
			...(item.tags ?? []),
		]
			.join(' ')
			.toLowerCase();
		let score = 0;
		for (const tok of tokens) {
			if (!tok) continue;
			if (hay.includes(tok)) score += 5;
			else if (hay.split(tok).length > 1) score += 2;
		}
		return { item, score };
	});
	const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
	return scored
		.filter((x) => x.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
}

export function getComponentById(id: string): CatalogComponent | null {
	const { components } = loadCatalogSync();
	return components.find((c) => c.id === id) ?? null;
}

export function getComponentBySlugAndGroup(
	slug: string,
	group: 'ui' | 'design',
): CatalogComponent | null {
	const { components } = loadCatalogSync();
	return components.find((c) => c.slug === slug && c.group === group) ?? null;
}

/**
 * 将 source 转为可 import 的模块路径（不含 .tsx/.ts，且去掉尾部的 /index）
 */
export function toImportModulePath(source: string): string {
	let s = source.trim();
	if (s.endsWith('.tsx') || s.endsWith('.ts')) {
		s = s.slice(0, -4);
	}
	if (s.endsWith('/index')) {
		s = s.slice(0, -'/index'.length);
	}
	return s;
}

/** design 下为具名导出入口的目录（与 apps/frontend 源码一致） */
const DESIGN_NAMED_ENTRY_SLUGS = new Set<string>([
	'ContextMenu',
	'Drawer',
	'MermaidFenceIsland',
	'MermaidFenceToolbar',
]);

/** design 各目录 index 入口：default 导出标识符与目录 slug 不一致时的映射 */
const DESIGN_DEFAULT_EXPORT_SLUG: Partial<Record<string, string>> = {
	Monaco: 'MarkdownEditor',
	Tooltip: 'TooltipSide',
	ChatMessageActions: 'MessageActions',
	Markdown: 'MarkdownPreview',
	ChatCodeToolBar: 'ChatCodeToolbarFloating',
};

/** 非 index 入口等特例：按 catalog id 指定 default 绑定名 */
const DESIGN_DEFAULT_EXPORT_BY_ID: Partial<Record<string, string>> = {
	'design-monaco-markdown-preview': 'ParserMarkdownPreviewPane',
};

function designDefaultBinding(component: CatalogComponent): string | null {
	const byId = DESIGN_DEFAULT_EXPORT_BY_ID[component.id];
	if (byId) return byId;
	if (component.group !== 'design') return null;
	if (!component.source.includes('/design/')) return null;
	if (!component.source.endsWith('/index.tsx')) return null;
	if (DESIGN_NAMED_ENTRY_SLUGS.has(component.slug)) return null;
	return DESIGN_DEFAULT_EXPORT_SLUG[component.slug] ?? component.slug;
}

export type ImportSnippet = {
	modulePath: string;
	importStatement: string;
	/** 在 JSX 或 default import 中使用的标识符 */
	binding: string;
	importKind: 'default' | 'named';
};

/**
 * 生成推荐 import：ui 与多数 design 子文件为具名；design 下 index 入口多为 default。
 */
export function buildImportSnippet(component: CatalogComponent): ImportSnippet {
	const modulePath = toImportModulePath(component.source);
	const defaultBinding = designDefaultBinding(component);
	if (defaultBinding) {
		return {
			modulePath,
			importStatement: `import ${defaultBinding} from '${modulePath}';`,
			binding: defaultBinding,
			importKind: 'default',
		};
	}
	const named = component.name || component.slug;
	return {
		modulePath,
		importStatement: `import { ${named} } from '${modulePath}';`,
		binding: named,
		importKind: 'named',
	};
}
