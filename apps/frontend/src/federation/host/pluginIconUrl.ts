import type { PluginRegistry } from '@dnhyxc-ai/federation-kit';
import type { SVGProps } from 'react';

/** registry `icon` 是否按 SVG URL 拉取并内联 */
export function isPluginIconUrl(value?: string | null): boolean {
	const v = value?.trim();
	if (!v) return false;
	return (
		/^https?:\/\//i.test(v) ||
		v.startsWith('/ext-cos/') ||
		v.startsWith('/remotes/')
	);
}

/**
 * 把上传得到的 URL 写入指定插件的 menu.icon / host.icon（有则写）。
 * 二者皆无则 wrote: []。
 */
export function applyPluginIconUrl(
	data: PluginRegistry,
	pluginId: string,
	url: string,
): { next: PluginRegistry; wrote: Array<'menu' | 'host'> } {
	const wrote: Array<'menu' | 'host'> = [];
	const plugins = data.plugins.map((p) => {
		if (p.id !== pluginId) return p;
		let next = p;
		if (p.menu) {
			next = { ...next, menu: { ...p.menu, icon: url } };
			wrote.push('menu');
		}
		if (p.host) {
			next = { ...next, host: { ...p.host, icon: url } };
			wrote.push('host');
		}
		return next;
	});
	return { next: { ...data, plugins }, wrote };
}

/**
 * stroke：Lucide 描边稿 → pathLength dash
 * fill：iconfont 填充稿 → clip 显现（不加描边）
 */
export type PluginIconKind = 'stroke' | 'fill';

/** current：跟侧栏选中色；original：多色/品牌色保留上传色 */
export type PluginIconTheme = 'current' | 'original';

export type HostSvgParts = {
	viewBox: string;
	kind: PluginIconKind;
	theme: PluginIconTheme;
	rootProps: SVGProps<SVGSVGElement>;
	innerHTML: string;
};

const SHAPE_SEL = 'path,line,circle,polyline,rect,ellipse,polygon';

const ROOT_PRESENTATION = [
	'fill',
	'stroke',
	'stroke-width',
	'stroke-linecap',
	'stroke-linejoin',
	'stroke-opacity',
	'fill-opacity',
	'opacity',
] as const;

function readPaint(el: Element, attr: 'fill' | 'stroke'): string | null {
	const direct = el.getAttribute(attr);
	if (direct) return direct.trim();
	const style = el.getAttribute('style') || '';
	const m = style.match(new RegExp(`${attr}\\s*:\\s*([^;]+)`, 'i'));
	return m?.[1]?.trim() || null;
}

function hasFillPaint(el: Element): boolean {
	const fill = readPaint(el, 'fill');
	return !!(fill && fill !== 'none');
}

function parseRgb(value: string): [number, number, number] | null {
	const v = value.trim().toLowerCase();
	if (v === 'black') return [0, 0, 0];
	if (v === 'white') return [255, 255, 255];
	const short = v.match(/^#([0-9a-f]{3})$/i);
	if (short) {
		const [r, g, b] = short[1].split('').map((c) => parseInt(c + c, 16));
		return [r, g, b];
	}
	const hex = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
	if (hex) {
		const n = hex[1];
		return [
			parseInt(n.slice(0, 2), 16),
			parseInt(n.slice(2, 4), 16),
			parseInt(n.slice(4, 6), 16),
		];
	}
	const rgb = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
	if (rgb) {
		return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
	}
	return null;
}

/** 相对亮度 0–1（sRGB） */
function luminance(r: number, g: number, b: number): number {
	const lin = [r, g, b].map((c) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/**
 * iconfont 常用 #2c2c2c / #333 等近黑灰，白名单会漏；
 * 低彩度 +（够暗或够亮）视为可跟侧栏色。
 */
export function isThemeablePaint(value: string): boolean {
	const v = value.trim().toLowerCase();
	if (!v || v === 'none' || v === 'transparent') return false;
	if (v === 'currentcolor' || v === 'inherit') return true;
	if (/^url\(/i.test(v)) return false;
	const rgb = parseRgb(v);
	if (!rgb) return false;
	const [r, g, b] = rgb;
	const chroma = Math.max(r, g, b) - Math.min(r, g, b);
	const L = luminance(r, g, b);
	// 近似灰，且偏黑或偏白（含 #2c2c2c）
	if (chroma <= 24 && (L <= 0.28 || L >= 0.82)) return true;
	return false;
}

function toThemePaint(value: string): string {
	return isThemeablePaint(value) ? 'currentColor' : value.trim();
}

function collectPaintKeys(svg: Element): string[] {
	const colors = new Set<string>();
	const consider = (raw: string | null) => {
		if (!raw || raw === 'none' || raw === 'transparent') return;
		if (/^url\(/i.test(raw.trim())) {
			colors.add(`url:${raw.trim().toLowerCase()}`);
			return;
		}
		colors.add(toThemePaint(raw).toLowerCase());
	};
	consider(svg.getAttribute('fill'));
	consider(svg.getAttribute('stroke'));
	for (const el of svg.querySelectorAll(`${SHAPE_SEL},g`)) {
		consider(readPaint(el, 'fill'));
		consider(readPaint(el, 'stroke'));
	}
	for (const styleEl of svg.querySelectorAll('style')) {
		const css = styleEl.textContent ?? '';
		for (const m of css.matchAll(
			/(?:^|[;{\s])(?:fill|stroke)\s*:\s*([^;!}]+)/gi,
		)) {
			consider(m[1]);
		}
	}
	return [...colors];
}

function rewriteStylePaint(style: string, attr: 'fill' | 'stroke'): string {
	return style.replace(
		new RegExp(`(${attr}\\s*:\\s*)([^;]+)`, 'ig'),
		(_, prefix: string, val: string) => {
			const t = val.trim();
			if (t === 'none' || t === 'transparent' || /^url\(/i.test(t)) {
				return `${prefix}${val}`;
			}
			return `${prefix}${toThemePaint(t)}`;
		},
	);
}

function rewriteCssText(css: string): string {
	return css.replace(/(fill|stroke)\s*:\s*([^;!}]+)/gi, (full, prop, val) => {
		const t = String(val).trim();
		if (t === 'none' || t === 'transparent' || /^url\(/i.test(t)) return full;
		if (!isThemeablePaint(t)) return full;
		return `${prop}:currentColor`;
	});
}

function stripColorLock(el: Element) {
	el.removeAttribute('color');
	const style = el.getAttribute('style');
	if (!style) return;
	const next = style
		.replace(/(?:^|;)\s*color\s*:\s*[^;]+/gi, '')
		.replace(/^;+|;+$/g, '')
		.trim();
	if (next) el.setAttribute('style', next);
	else el.removeAttribute('style');
}

/**
 * 无色 / 仅近黑灰白 → currentColor（跟侧栏选中色）；
 * 多色或品牌色 → original。
 */
function applyThemeCurrentColor(svg: Element): PluginIconTheme {
	const paints = collectPaintKeys(svg);
	if (paints.some((p) => p.startsWith('url:'))) return 'original';
	if (paints.length > 1) return 'original';
	if (paints.length === 1 && paints[0] !== 'currentcolor') return 'original';

	const rewriteEl = (el: Element) => {
		stripColorLock(el);
		for (const attr of ['fill', 'stroke'] as const) {
			const val = el.getAttribute(attr);
			if (
				val &&
				val !== 'none' &&
				val !== 'transparent' &&
				!/^url\(/i.test(val)
			) {
				el.setAttribute(attr, toThemePaint(val));
			}
		}
		const style = el.getAttribute('style');
		if (style) {
			el.setAttribute(
				'style',
				rewriteStylePaint(rewriteStylePaint(style, 'fill'), 'stroke'),
			);
		}
	};

	rewriteEl(svg);
	for (const el of svg.querySelectorAll(`${SHAPE_SEL},g`)) {
		rewriteEl(el);
	}
	for (const styleEl of svg.querySelectorAll('style')) {
		const css = styleEl.textContent ?? '';
		const next = rewriteCssText(css);
		if (next !== css) styleEl.textContent = next;
	}
	return 'current';
}

/** Lucide 根 fill="none"；iconfont 常不写或写深灰 fill → fill */
export function detectPluginIconKind(svg: Element): PluginIconKind {
	for (const el of svg.querySelectorAll(SHAPE_SEL)) {
		if (hasFillPaint(el)) return 'fill';
	}
	const rootFill = svg.getAttribute('fill');
	if (rootFill === 'none') return 'stroke';
	return 'fill';
}

function prepareStrokeDraw(svg: Element) {
	for (const el of svg.querySelectorAll(SHAPE_SEL)) {
		el.setAttribute('pathLength', '1');
	}
}

/**
 * 消毒；近黑灰单色 → currentColor（选中跟静态菜单）；
 * 描边稿 pathLength；填充稿不加描边；品牌色保留。
 */
export function normalizeSvgForHostIcon(svgText: string): HostSvgParts | null {
	const raw = svgText.trim();
	if (!raw || !/<svg[\s>]/i.test(raw)) return null;

	const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
	if (doc.querySelector('parsererror')) return null;

	const svg = doc.documentElement;
	if (!svg || svg.tagName.toLowerCase() !== 'svg') return null;

	for (const el of [
		...svg.querySelectorAll('script, foreignObject, iframe, object, embed'),
	]) {
		el.remove();
	}

	for (const el of [svg, ...svg.querySelectorAll('*')]) {
		for (const attr of [...el.attributes]) {
			const name = attr.name;
			const val = attr.value.trim();
			if (/^on/i.test(name)) {
				el.removeAttribute(name);
				continue;
			}
			if (
				(name === 'href' || name === 'xlink:href') &&
				/^javascript:/i.test(val)
			) {
				el.removeAttribute(name);
			}
		}
	}

	const theme = applyThemeCurrentColor(svg);
	const kind = detectPluginIconKind(svg);
	if (kind === 'stroke') {
		prepareStrokeDraw(svg);
	}

	const viewBox = svg.getAttribute('viewBox') || '0 0 24 24';
	const rootProps: SVGProps<SVGSVGElement> = {};
	for (const name of ROOT_PRESENTATION) {
		const val = svg.getAttribute(name);
		if (!val) continue;
		if (name === 'stroke-width') rootProps.strokeWidth = val;
		else if (name === 'stroke-linecap')
			rootProps.strokeLinecap = val as 'round';
		else if (name === 'stroke-linejoin')
			rootProps.strokeLinejoin = val as 'round';
		else if (name === 'stroke-opacity') rootProps.strokeOpacity = val;
		else if (name === 'fill-opacity') rootProps.fillOpacity = val;
		else if (name === 'fill') rootProps.fill = val;
		else if (name === 'stroke') rootProps.stroke = val;
		else if (name === 'opacity') rootProps.opacity = Number(val) || val;
	}

	if (theme === 'current') {
		if (kind === 'fill') {
			rootProps.fill = 'currentColor';
		} else {
			rootProps.stroke = 'currentColor';
			if (!rootProps.fill) rootProps.fill = 'none';
		}
	}

	const innerHTML = svg.innerHTML.trim();
	if (!innerHTML) return null;

	return { viewBox, kind, theme, rootProps, innerHTML };
}
