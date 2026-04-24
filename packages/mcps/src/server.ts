import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
	buildImportSnippet,
	getCatalogPath,
	getComponentById,
	getComponentBySlugAndGroup,
	listComponents,
	loadCatalogSync,
	searchComponents,
} from './catalog.js';

const INSTRUCTIONS = [
	'本 MCP 提供本仓库「组件目录」catalog/components.json 的只读查询能力。',
	'在实现 UI 或改代码前：先 search_components 或 list_components，再用 get_component_details 取 props 与示例。',
	'写入代码时使用 resolve_component_import 返回的 importStatement，路径与 apps/frontend 中 @/components 别名一致。',
	'注意：design 下部分组件为复合导出，若 import 报错请打开 source 文件核对实际 export 名称。',
].join('\n');

function textResult(obj: unknown) {
	return {
		content: [
			{
				type: 'text' as const,
				text: JSON.stringify(obj, null, 2),
			},
		],
	};
}

function main() {
	const server = new McpServer(
		{ name: 'dnhyxc-component-catalog', version: '0.0.1' },
		{ instructions: INSTRUCTIONS },
	);

	server.registerTool(
		'list_component_ids',
		{
			title: '列出组件 ID',
			description:
				'仅列出 catalog 中组件的 id 列表；支持按 group、category、tag 过滤。适合在调用其它工具前快速拿到可用 id。',
			inputSchema: {
				group: z.enum(['ui', 'design']).optional().describe('仅 ui 或 design'),
				category: z
					.string()
					.optional()
					.describe('按 category 精确匹配（大小写不敏感）'),
				tag: z.string().optional().describe('标签包含该字符串即命中'),
				limit: z
					.number()
					.int()
					.min(1)
					.max(500)
					.optional()
					.describe('最多返回条数，默认 500'),
			},
		},
		async (args) => {
			const meta = loadCatalogSync();
			const list = listComponents({
				group: args.group,
				category: args.category,
				tag: args.tag,
				limit: args.limit ?? 500,
			});
			return textResult({
				catalogVersion: meta.version,
				basePath: meta.basePath,
				catalogPath: getCatalogPath(),
				count: list.length,
				ids: list.map((c) => c.id),
			});
		},
	);

	server.registerTool(
		'list_components',
		{
			title: '列出组件',
			description:
				'列出 catalog 中的组件摘要（id、title、slug、group、category、source、tags）。可按 group、category、tag 过滤。',
			inputSchema: {
				group: z.enum(['ui', 'design']).optional().describe('仅 ui 或 design'),
				category: z
					.string()
					.optional()
					.describe('按 category 精确匹配（大小写不敏感）'),
				tag: z.string().optional().describe('标签包含该字符串即命中'),
				limit: z
					.number()
					.int()
					.min(1)
					.max(500)
					.optional()
					.describe('最多返回条数，默认 200'),
			},
		},
		async (args) => {
			const meta = loadCatalogSync();
			const list = listComponents({
				group: args.group,
				category: args.category,
				tag: args.tag,
				limit: args.limit,
			});
			const summaries = list.map((c) => ({
				id: c.id,
				title: c.title,
				slug: c.slug,
				name: c.name,
				group: c.group,
				category: c.category,
				description: c.description,
				source: c.source,
				tags: c.tags,
			}));
			return textResult({
				catalogVersion: meta.version,
				basePath: meta.basePath,
				catalogPath: getCatalogPath(),
				count: summaries.length,
				components: summaries,
			});
		},
	);

	server.registerTool(
		'search_components',
		{
			title: '查询组件',
			description:
				'按关键词在 id、slug、name、title、description、tags、category、source 中做简单打分检索，返回最相关的若干条。',
			inputSchema: {
				query: z.string().min(1).describe('检索关键词，支持多个词以空格分隔'),
				group: z.enum(['ui', 'design']).optional(),
				limit: z.number().int().min(1).max(100).optional().describe('默认 20'),
			},
		},
		async (args) => {
			const hits = searchComponents(args.query, {
				group: args.group,
				limit: args.limit,
			});
			return textResult({
				query: args.query,
				count: hits.length,
				results: hits.map(({ item, score }) => ({
					score,
					id: item.id,
					title: item.title,
					slug: item.slug,
					group: item.group,
					category: item.category,
					source: item.source,
					tags: item.tags,
				})),
			});
		},
	);

	server.registerTool(
		'get_component_details',
		{
			title: '获取组件详情',
			description:
				'按 id（推荐）或 slug+group 返回完整条目：props、examples、relatedSources 等，并附带可直接复制的使用示例（import + JSX）。',
			inputSchema: {
				id: z.string().optional().describe('catalog 中的 id，如 ui-button'),
				slug: z.string().optional().describe('与 group 联用，如 button + ui'),
				group: z.enum(['ui', 'design']).optional().describe('与 slug 联用'),
			},
		},
		async (args) => {
			if (!args.id && !(args.slug && args.group)) {
				return textResult({
					error: 'INVALID_ARGUMENTS',
					message: '必须提供 id，或同时提供 slug 与 group',
				});
			}
			let comp = args.id ? getComponentById(args.id) : null;
			if (!comp && args.slug && args.group) {
				comp = getComponentBySlugAndGroup(args.slug, args.group);
			}
			if (!comp) {
				return textResult({
					error: 'NOT_FOUND',
					message: '未找到组件，请检查 id 或 slug+group',
					hint: '可先调用 search_components',
				});
			}
			const meta = loadCatalogSync();
			const snippet = buildImportSnippet(comp);
			/**
			 * components.json 的 examples 已尽量写成“可复制的实际用例”（含 import + JSX）。
			 * 因此这里不再额外 prepend importStatement，避免出现重复导入。
			 */
			const bestExampleCode =
				comp.examples?.map((e) => e.code?.trim()).find(Boolean) ?? '';
			const usageExample = bestExampleCode
				? bestExampleCode
				: [
						snippet.importStatement,
						'',
						`// 在 JSX 中使用 <${snippet.binding} />（请结合 props 与源码 export 调整）`,
					].join('\n');
			return textResult({
				meta: {
					catalogVersion: meta.version,
					basePath: meta.basePath,
					catalogPath: getCatalogPath(),
				},
				usageExample: {
					importKind: snippet.importKind,
					binding: snippet.binding,
					modulePath: snippet.modulePath,
					importStatement: snippet.importStatement,
					code: usageExample,
				},
				component: comp,
			});
		},
	);

	server.registerTool(
		'resolve_component_import',
		{
			title: '解析组件 import',
			description:
				'根据 id 或 slug+group 生成推荐 import 语句与模块路径，便于在代码中自动插入引用。',
			inputSchema: {
				id: z.string().optional(),
				slug: z.string().optional(),
				group: z.enum(['ui', 'design']).optional(),
			},
		},
		async (args) => {
			if (!args.id && !(args.slug && args.group)) {
				return textResult({
					error: 'INVALID_ARGUMENTS',
					message: '必须提供 id，或同时提供 slug 与 group',
				});
			}
			let comp = args.id ? getComponentById(args.id) : null;
			if (!comp && args.slug && args.group) {
				comp = getComponentBySlugAndGroup(args.slug, args.group);
			}
			if (!comp) {
				return textResult({
					error: 'NOT_FOUND',
					message: '未找到组件',
				});
			}
			const snippet = buildImportSnippet(comp);
			const firstExample = comp.examples?.[0];
			const firstExampleTitle =
				firstExample?.title ??
				firstExample?.name ??
				firstExample?.description ??
				'示例';
			return textResult({
				id: comp.id,
				title: comp.title,
				modulePath: snippet.modulePath,
				importStatement: snippet.importStatement,
				importKind: snippet.importKind,
				binding: snippet.binding,
				/** @deprecated 与 binding 相同，保留兼容旧消费方 */
				namedExport: snippet.binding,
				usageHint: firstExample
					? `${firstExampleTitle}：\n${firstExample.code}`
					: `在 JSX 中使用 <${snippet.binding} />（请结合 props 与源码 export 调整）`,
				sourceFile: comp.source,
			});
		},
	);

	const transport = new StdioServerTransport();
	void server.connect(transport);
}

main();
