/**
 * Remote :root/:host 上 Host 语义主题 token 剥离（可配置）。
 */
import { PLUGIN_ROOT_ATTR } from '../protocol';

/** :root → realm；html/body → realm + [data-plugin-root] */
export function mapDocRootToken(token: string, sel: string): string {
	if (/^:root$/i.test(token)) return sel;
	if (/^(?:html|body)$/i.test(token)) return `${sel}${PLUGIN_ROOT_ATTR}`;
	return token;
}

/**
 * 默认：本产品 shadcn / brand / theme-* 变量。
 * Host 可通过 `configureStyleIsolation({ themePropPattern })` 覆盖。
 */
export const DEFAULT_HOST_THEME_CUSTOM_PROP =
	/^--(?:brand-accent(?:-soft|-light|-dark)?|theme-[a-z0-9-]+|background|foreground|card(?:-foreground)?|popover(?:-foreground)?|primary(?:-foreground)?|secondary(?:-foreground)?|muted(?:-foreground)?|accent(?:-foreground)?|destructive|border|input|ring|radius)$/i;

let themePropPattern: RegExp = DEFAULT_HOST_THEME_CUSTOM_PROP;

export function setHostThemePropPattern(pattern?: RegExp) {
	themePropPattern = pattern ?? DEFAULT_HOST_THEME_CUSTOM_PROP;
}

export function getHostThemePropPattern(): RegExp {
	return themePropPattern;
}

/** @deprecated 使用 getHostThemePropPattern()；保留别名兼容旧 smoke */
export const HOST_THEME_CUSTOM_PROP = DEFAULT_HOST_THEME_CUSTOM_PROP;

export function isDocRootOnlySelectors(selectors: string): boolean {
	const parts = selectors
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	return parts.length > 0 && parts.every((s) => /^(:root|:host)$/i.test(s));
}

export function stripHostThemeDecls(declBlock: string): string {
	if (declBlock.length < 2 || declBlock[0] !== '{') return declBlock;
	const inner = declBlock.slice(1, -1);
	const pat = getHostThemePropPattern();
	const cleaned = inner.replace(
		/(^|;)\s*(--[\w-]+)\s*:\s*[^;]*/g,
		(full, lead: string, prop: string) => (pat.test(prop) ? lead : full),
	);
	const tidy = cleaned
		.replace(/;\s*;+/g, ';')
		.replace(/^\s*;\s*/, '')
		.replace(/;\s*$/, '')
		.trim();
	return `{${tidy}}`;
}
