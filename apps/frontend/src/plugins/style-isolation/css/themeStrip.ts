/**
 * Remote :root/:host 上 Host 语义主题 token 剥离。
 */
import { PLUGIN_ROOT_ATTR } from '../protocol';

/** :root → realm；html/body → realm + [data-plugin-root] */
export function mapDocRootToken(token: string, sel: string): string {
	if (/^:root$/i.test(token)) return sel;
	if (/^(?:html|body)$/i.test(token)) return `${sel}${PLUGIN_ROOT_ATTR}`;
	return token;
}

/**
 * Remote `:root` 写死的 Host 语义变量；remap 到 realm 后会挡住继承。
 * 不匹配 `--color-*`（@theme 别名）与 `--el-*` 等组件库变量。
 */
export const HOST_THEME_CUSTOM_PROP =
	/^--(?:brand-accent(?:-soft|-light|-dark)?|theme-[a-z0-9-]+|background|foreground|card(?:-foreground)?|popover(?:-foreground)?|primary(?:-foreground)?|secondary(?:-foreground)?|muted(?:-foreground)?|accent(?:-foreground)?|destructive|border|input|ring|radius)$/i;

/** 选择器列表是否仅为 `:root` / `:host`（Tailwind @theme 常写成二者并列） */
export function isDocRootOnlySelectors(selectors: string): boolean {
	const parts = selectors
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	return parts.length > 0 && parts.every((s) => /^(:root|:host)$/i.test(s));
}

/** 从 `{…}` 声明块去掉 Host 主题自定义属性 */
export function stripHostThemeDecls(declBlock: string): string {
	if (declBlock.length < 2 || declBlock[0] !== '{') return declBlock;
	const inner = declBlock.slice(1, -1);
	const cleaned = inner.replace(
		/(^|;)\s*(--[\w-]+)\s*:\s*[^;]*/g,
		(full, lead: string, prop: string) =>
			HOST_THEME_CUSTOM_PROP.test(prop) ? lead : full,
	);
	const tidy = cleaned
		.replace(/;\s*;+/g, ';')
		.replace(/^\s*;\s*/, '')
		.replace(/;\s*$/, '')
		.trim();
	return `{${tidy}}`;
}
