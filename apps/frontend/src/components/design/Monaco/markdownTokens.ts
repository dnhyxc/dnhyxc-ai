import type { OnMount } from '@monaco-editor/react';

type MonacoApi = Parameters<OnMount>[1];

/**
 * Monaco 自带的 `markdown` 语言默认不会对 fenced code block 内做嵌入语言高亮，
 * 体验上会出现 ```tsx 内“全是白色”的情况。
 *
 * 这里用 Monarch 的 nextEmbedded 做一个轻量增强：
 * - 识别常见围栏语言标记（tsx/ts/js/css/...）
 * - 在围栏内部切换到对应语言的 tokenization
 *
 * 约束：
 * - 这是“编辑器显示高亮”层面的增强，不影响 Prettier 格式化逻辑
 * - 不追求完整 Markdown 语法高亮（保持轻量、避免破坏现有主题）
 */
export function registerMarkdownFenceEmbeddedHighlight(
	monaco: MonacoApi,
): void {
	// 只覆盖 markdown 的 token provider：尽量小改动，只解决 code fence 内无高亮的问题
	monaco.languages.setMonarchTokensProvider('markdown', {
		// 仅定义我们关心的 fenced code block + 少量 Markdown token
		tokenizer: {
			root: [
				// 围栏代码块（按语言进入对应 state）
				// 注意：Monaco 通常只有 `typescript` / `javascript` 两套主 tokenizer；
				// `typescriptreact` / `javascriptreact` 在多数打包配置下并不存在，嵌入会退化成“全白”。
				[
					/^\s*```tsx\b.*$/,
					{ token: 'string', next: '@fence_tsx', nextEmbedded: 'typescript' },
				],
				[
					/^\s*```ts\b.*$/,
					{ token: 'string', next: '@fence_ts', nextEmbedded: 'typescript' },
				],
				[
					/^\s*```jsx\b.*$/,
					{ token: 'string', next: '@fence_jsx', nextEmbedded: 'javascript' },
				],
				[
					/^\s*```js\b.*$/,
					{ token: 'string', next: '@fence_js', nextEmbedded: 'javascript' },
				],
				[
					/^\s*```javascript\b.*$/,
					{ token: 'string', next: '@fence_js', nextEmbedded: 'javascript' },
				],
				[
					/^\s*```json\b.*$/,
					{ token: 'string', next: '@fence_json', nextEmbedded: 'json' },
				],
				[
					/^\s*```css\b.*$/,
					{ token: 'string', next: '@fence_css', nextEmbedded: 'css' },
				],
				[
					/^\s*```scss\b.*$/,
					{ token: 'string', next: '@fence_scss', nextEmbedded: 'scss' },
				],
				[
					/^\s*```less\b.*$/,
					{ token: 'string', next: '@fence_less', nextEmbedded: 'less' },
				],
				[
					/^\s*```html\b.*$/,
					{ token: 'string', next: '@fence_html', nextEmbedded: 'html' },
				],
				[
					/^\s*```yaml\b.*$/,
					{ token: 'string', next: '@fence_yaml', nextEmbedded: 'yaml' },
				],
				[
					/^\s*```yml\b.*$/,
					{ token: 'string', next: '@fence_yaml', nextEmbedded: 'yaml' },
				],
				[
					/^\s*```sh\b.*$/,
					{ token: 'string', next: '@fence_shell', nextEmbedded: 'shell' },
				],
				[
					/^\s*```bash\b.*$/,
					{ token: 'string', next: '@fence_shell', nextEmbedded: 'shell' },
				],

				// 未识别语言：仍作为 code fence，但不做嵌入高亮
				[
					/^\s*```[a-zA-Z0-9_-]*\b.*$/,
					{ token: 'string', next: '@fence_plain' },
				],

				// 少量 Markdown 高亮（保持轻量）
				[/^\s*#{1,6}\s.*$/, 'keyword'],
				[/`[^`]+`/, 'string'],
				[/\*\*[^*]+\*\*/, 'strong'],
				[/\*[^*]+\*/, 'emphasis'],
				[/\[[^\]]+\]\([^)]+\)/, 'link'],

				[/^>.*$/, 'comment'],
				[/^[-*+]\s+.*$/, 'keyword'],
				[/^\d+\.\s+.*$/, 'keyword'],

				[/.*$/, ''],
			],

			fence_tsx: [
				[/^```\s*$/, { token: 'string', next: '@pop', nextEmbedded: '@pop' }],
				[/.*$/, ''],
			],
			fence_ts: [
				[/^```\s*$/, { token: 'string', next: '@pop', nextEmbedded: '@pop' }],
				[/.*$/, ''],
			],
			fence_jsx: [
				[/^```\s*$/, { token: 'string', next: '@pop', nextEmbedded: '@pop' }],
				[/.*$/, ''],
			],
			fence_js: [
				[/^```\s*$/, { token: 'string', next: '@pop', nextEmbedded: '@pop' }],
				[/.*$/, ''],
			],
			fence_json: [
				[/^```\s*$/, { token: 'string', next: '@pop', nextEmbedded: '@pop' }],
				[/.*$/, ''],
			],
			fence_css: [
				[/^```\s*$/, { token: 'string', next: '@pop', nextEmbedded: '@pop' }],
				[/.*$/, ''],
			],
			fence_scss: [
				[/^```\s*$/, { token: 'string', next: '@pop', nextEmbedded: '@pop' }],
				[/.*$/, ''],
			],
			fence_less: [
				[/^```\s*$/, { token: 'string', next: '@pop', nextEmbedded: '@pop' }],
				[/.*$/, ''],
			],
			fence_html: [
				[/^```\s*$/, { token: 'string', next: '@pop', nextEmbedded: '@pop' }],
				[/.*$/, ''],
			],
			fence_yaml: [
				[/^```\s*$/, { token: 'string', next: '@pop', nextEmbedded: '@pop' }],
				[/.*$/, ''],
			],
			fence_shell: [
				[/^```\s*$/, { token: 'string', next: '@pop', nextEmbedded: '@pop' }],
				[/.*$/, ''],
			],
			fence_plain: [
				[/^```\s*$/, { token: 'string', next: '@pop' }],
				[/.*$/, ''],
			],
		},
	});
}
