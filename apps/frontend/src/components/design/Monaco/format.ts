import type { OnMount } from '@monaco-editor/react';
import type { Plugin } from 'prettier';
import * as babelPluginMod from 'prettier/plugins/babel';
import * as estreePluginMod from 'prettier/plugins/estree';
import * as htmlPluginMod from 'prettier/plugins/html';
import * as markdownPluginMod from 'prettier/plugins/markdown';
import * as postcssPluginMod from 'prettier/plugins/postcss';
import * as typescriptPluginMod from 'prettier/plugins/typescript';
import * as yamlPluginMod from 'prettier/plugins/yaml';
import { format } from 'prettier/standalone';

import { MONACO_TAB_SIZE } from './options';

/** 与 pangu 一致的 CJK Unicode 块，用于轻量「盘古之白」 */
const PANGU_CJK =
	'\u2E80-\u2EFF\u2F00-\u2FDF\u3040-\u309F\u30A0-\u30FA\u30FC-\u30FF\u3100-\u312F\u3200-\u32FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF';

type MonacoApi = Parameters<OnMount>[1];

/** ESM 下 Prettier 插件常为 default 导出 */
function asPrettierPlugin(mod: unknown): Plugin {
	const m = mod as { default?: Plugin };
	return (m?.default ?? mod) as Plugin;
}

/**
 * 与参考代码一致：一次性传入 markdown / babel / ts / html / postcss / yaml 等插件。
 * 浏览器端使用 standalone 的 format，不可用主包 `import prettier from 'prettier'`（依赖 Node）。
 */
const PRETTIER_PLUGINS: Plugin[] = [
	asPrettierPlugin(markdownPluginMod),
	asPrettierPlugin(babelPluginMod),
	asPrettierPlugin(estreePluginMod),
	asPrettierPlugin(typescriptPluginMod),
	asPrettierPlugin(htmlPluginMod),
	asPrettierPlugin(postcssPluginMod),
	asPrettierPlugin(yamlPluginMod),
];

/** 与参考示例及仓库习惯对齐 */
const PRETTIER_BASE_OPTIONS = {
	singleQuote: true,
	tabWidth: 2,
	semi: true,
	arrowParens: 'avoid' as const,
	printWidth: 100,
	endOfLine: 'lf' as const,
};

const documentFormatterDisposables = new Map<string, { dispose: () => void }>();
const rangeFormatterDisposables = new Map<string, { dispose: () => void }>();

/**
 * Monaco languageId -> Prettier parser 名。
 * Prettier 3 中 CSS 系由 postcss 插件提供，解析器名为 css / scss / less（对应旧版 postcss 插件 + parser: 'postcss' 场景）。
 */
function prettierParserForMonacoLanguage(languageId: string): string | null {
	switch (languageId) {
		case 'markdown':
			return 'markdown';
		case 'javascript':
		case 'javascriptreact':
			return 'babel';
		case 'typescript':
		case 'typescriptreact':
			return 'typescript';
		case 'html':
			return 'html';
		case 'css':
			return 'css';
		case 'less':
			return 'less';
		case 'scss':
			return 'scss';
		case 'yaml':
			return 'yaml';
		case 'json':
			return 'json';
		default:
			return null;
	}
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

async function formatWithPrettierForModel(model: {
	getValue: () => string;
	getLanguageId: () => string;
}): Promise<string | null> {
	const language = model.getLanguageId();
	if (language === 'c' || language === 'python') {
		return null;
	}
	const parser = prettierParserForMonacoLanguage(language);
	if (!parser) {
		return null;
	}
	const text = model.getValue();
	try {
		const formatted = await format(text, {
			parser,
			plugins: PRETTIER_PLUGINS,
			...PRETTIER_BASE_OPTIONS,
			...(parser === 'markdown'
				? {
						useTabs: false,
						tabWidth: MONACO_TAB_SIZE,
						proseWrap: 'preserve' as const,
					}
				: {
						useTabs: true,
					}),
		});
		const out =
			language === 'markdown' ? spacingMarkdownProse(formatted) : formatted;
		return out === text ? null : out;
	} catch (err) {
		if (import.meta.env.DEV) {
			console.warn(`[Monaco Prettier] 格式化失败 (${language}):`, err);
		}
		return null;
	}
}

function createDocumentFormattingProvider() {
	return {
		displayName: 'Prettier',
		async provideDocumentFormattingEdits(model: {
			getValue: () => string;
			getLanguageId: () => string;
			getFullModelRange: () => unknown;
		}) {
			const out = await formatWithPrettierForModel(model);
			if (out == null) return [];
			return [{ range: model.getFullModelRange(), text: out }];
		},
	};
}

function createRangeFormattingProvider() {
	return {
		displayName: 'Prettier',
		async provideDocumentRangeFormattingEdits(
			model: {
				getValue: () => string;
				getLanguageId: () => string;
				getFullModelRange: () => {
					startLineNumber: number;
					startColumn: number;
					endLineNumber: number;
					endColumn: number;
				};
			},
			range: {
				startLineNumber: number;
				startColumn: number;
				endLineNumber: number;
				endColumn: number;
			},
		) {
			const full = model.getFullModelRange();
			if (
				range.startLineNumber !== full.startLineNumber ||
				range.startColumn !== full.startColumn ||
				range.endLineNumber !== full.endLineNumber ||
				range.endColumn !== full.endColumn
			) {
				return [];
			}
			const out = await formatWithPrettierForModel(model);
			if (out == null) return [];
			return [{ range: full, text: out }];
		},
	};
}

/** 与参考 registerDocumentFormatInfo 一致：按语言注册同一套 Provider，内部用 getLanguageId 选 parser */
const LANGUAGES_WITH_FORMAT: string[] = [
	'markdown',
	'javascript',
	'javascriptreact',
	'typescript',
	'typescriptreact',
	'html',
	'css',
	'less',
	'scss',
	'yaml',
	'json',
];

export function registerPrettierFormatProviders(monaco: MonacoApi): void {
	const docProvider = createDocumentFormattingProvider();
	const rangeProvider = createRangeFormattingProvider();
	for (const languageId of LANGUAGES_WITH_FORMAT) {
		documentFormatterDisposables.get(languageId)?.dispose();
		rangeFormatterDisposables.get(languageId)?.dispose();
		documentFormatterDisposables.set(
			languageId,
			monaco.languages.registerDocumentFormattingEditProvider(
				languageId,
				docProvider,
			),
		);
		rangeFormatterDisposables.set(
			languageId,
			monaco.languages.registerDocumentRangeFormattingEditProvider(
				languageId,
				rangeProvider,
			),
		);
	}
}
