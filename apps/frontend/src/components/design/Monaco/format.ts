import type { OnMount } from '@monaco-editor/react';
import type { Plugin } from 'prettier';

import { MONACO_TAB_SIZE } from './options';

/** 与 pangu 一致的 CJK Unicode 块，用于轻量「盘古之白」 */
const PANGU_CJK =
	'\u2E80-\u2EFF\u2F00-\u2FDF\u3040-\u309F\u30A0-\u30FA\u30FC-\u30FF\u3100-\u312F\u3200-\u32FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF';

type MonacoApi = Parameters<OnMount>[1];

/** 与仓库 biome.json 接近 */
const PRETTIER_CODE_OPTIONS = {
	useTabs: true,
	tabWidth: 2,
	singleQuote: true,
	semi: true,
	printWidth: 100,
	proseWrap: 'preserve' as const,
	endOfLine: 'lf' as const,
};

const registered = new Set<string>();

function registerOnce(
	monaco: MonacoApi,
	languageId: string,
	formatter: (source: string) => Promise<string>,
): void {
	if (registered.has(languageId)) return;
	registered.add(languageId);
	monaco.languages.registerDocumentFormattingEditProvider(languageId, {
		async provideDocumentFormattingEdits(model: any) {
			const text = model.getValue();
			try {
				const formatted = await formatter(text);
				if (formatted === text) return [];
				return [{ range: model.getFullModelRange(), text: formatted }];
			} catch {
				return [];
			}
		},
	});
}

async function formatWithBabelParser(source: string): Promise<string> {
	const [{ format }, babelMod, estreeMod] = await Promise.all([
		import('prettier/standalone'),
		import('prettier/plugins/babel'),
		import('prettier/plugins/estree'),
	]);
	return format(source, {
		...PRETTIER_CODE_OPTIONS,
		parser: 'babel',
		plugins: [babelMod as unknown as Plugin, estreeMod as unknown as Plugin],
	});
}

async function formatWithTypeScriptParser(source: string): Promise<string> {
	const [{ format }, tsMod, estreeMod] = await Promise.all([
		import('prettier/standalone'),
		import('prettier/plugins/typescript'),
		import('prettier/plugins/estree'),
	]);
	return format(source, {
		...PRETTIER_CODE_OPTIONS,
		parser: 'typescript',
		plugins: [tsMod as unknown as Plugin, estreeMod as unknown as Plugin],
	});
}

/**
 * 仅在 CJK 与 ASCII 字母数字交界处插入空格（精简版盘古之白）。
 * 不使用 pangu.spacingText：其会在标点、括号、引号、运算符等与文字之间也加空格，易破坏 Markdown/排版。
 */
function spacingMarkdownProse(markdown: string): string {
	const cjkThenAlnum = new RegExp(`([${PANGU_CJK}])([A-Za-z0-9])`, 'g');
	const alnumThenCjk = new RegExp(`([A-Za-z0-9])([${PANGU_CJK}])`, 'g');
	const outsideFences = markdown.split(/(```[\s\S]*?```)/g);
	return outsideFences
		.map((chunk) => {
			if (chunk.startsWith('```')) {
				return chunk;
			}
			return chunk
				.split(/(`[^`\n]*`)/g)
				.map((part) => {
					if (part.startsWith('`') && part.endsWith('`')) {
						return part;
					}
					return part
						.replace(cjkThenAlnum, '$1 $2')
						.replace(alnumThenCjk, '$1 $2');
				})
				.join('');
		})
		.join('');
}

/**
 * Prettier 仅传 markdown 插件时不会排版围栏内代码；需同时加载 babel/estree/typescript/html。
 */
async function formatMarkdownWithPrettier(source: string): Promise<string> {
	const [{ format }, markdownMod, babelMod, estreeMod, typescriptMod, htmlMod] =
		await Promise.all([
			import('prettier/standalone'),
			import('prettier/plugins/markdown'),
			import('prettier/plugins/babel'),
			import('prettier/plugins/estree'),
			import('prettier/plugins/typescript'),
			import('prettier/plugins/html'),
		]);
	const plugins: Plugin[] = [
		markdownMod as unknown as Plugin,
		babelMod as unknown as Plugin,
		estreeMod as unknown as Plugin,
		typescriptMod as unknown as Plugin,
		htmlMod as unknown as Plugin,
	];
	const formatted = await format(source, {
		parser: 'markdown',
		plugins,
		...PRETTIER_CODE_OPTIONS,
		useTabs: false,
		tabWidth: MONACO_TAB_SIZE,
	});
	return spacingMarkdownProse(formatted);
}

async function formatJson(source: string): Promise<string> {
	const [{ format }, babelMod, estreeMod] = await Promise.all([
		import('prettier/standalone'),
		import('prettier/plugins/babel'),
		import('prettier/plugins/estree'),
	]);
	return format(source, {
		...PRETTIER_CODE_OPTIONS,
		parser: 'json',
		plugins: [babelMod as unknown as Plugin, estreeMod as unknown as Plugin],
	});
}

async function formatHtml(source: string): Promise<string> {
	const [{ format }, htmlMod] = await Promise.all([
		import('prettier/standalone'),
		import('prettier/plugins/html'),
	]);
	return format(source, {
		...PRETTIER_CODE_OPTIONS,
		parser: 'html',
		plugins: [htmlMod as unknown as Plugin],
	});
}

/** Monaco 文档格式化：Markdown（含围栏内多语言）与纯 JS/TS/JSON/HTML */
export function registerPrettierFormatProviders(monaco: MonacoApi): void {
	registerOnce(monaco, 'markdown', formatMarkdownWithPrettier);
	registerOnce(monaco, 'javascript', formatWithBabelParser);
	registerOnce(monaco, 'javascriptreact', formatWithBabelParser);
	registerOnce(monaco, 'typescript', formatWithTypeScriptParser);
	registerOnce(monaco, 'typescriptreact', formatWithTypeScriptParser);
	registerOnce(monaco, 'json', formatJson);
	registerOnce(monaco, 'html', formatHtml);
}
