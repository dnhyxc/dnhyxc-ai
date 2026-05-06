/**
 * 与后端 apps/backend/src/services/web-search/organic-citation.ts 中 applyOrganicCitationAnchors 语义对齐：
 * 流式阶段把 【n】、[n](url)、裸 [n] 转为 Markdown 安全占位符（避免 markdown-it html:false 把 <a> 当纯文本转义）。
 * 占位符在 Markdown 渲染后再替换为真实 <a>（见 injectOrganicCitationAnchorsIntoMarkdownHtml）。
 */

import type { SearchOrganicItem } from '@/types/chat';

export interface OrganicLinkItem {
	link: string;
}

/** 落库正文中由后端写入的引用锚点 → 占位符或 【n】（无 organic 时退化为纯文本角标） */
const PERSISTED_ORGANIC_ANCHOR_RE =
	/<a\b[^>]*\bdata-organic-cite="(\d+)"[^>]*>[\s\S]*?<\/a>/gi;

function escapeHtmlText(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function escapeHrefForDoubleQuotedAttr(url: string): string {
	return url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** 内部占位符，极少与用户正文冲突 */
export function organicCitationMarker(index: number): string {
	return `〔cite:${index}〕`;
}

/** 展示用短域名（去掉 www.） */
export function shortHostnameFromUrl(link: string): string {
	const t = link.trim();
	if (!t) {
		return '?';
	}
	try {
		const u = new URL(t);
		let h = u.hostname;
		if (h.startsWith('www.')) {
			h = h.slice(4);
		}
		return h || t.slice(0, 32);
	} catch {
		return t.slice(0, 32);
	}
}

/**
 * 将后端落库的引用 <a> 还原为占位符（有 organic 时）或 【n】（无 organic 时），以便再走 Markdown 渲染。
 */
export function normalizePersistedOrganicAnchorsInMarkdown(
	text: string,
	organic: Pick<OrganicLinkItem, 'link'>[] | null | undefined,
): string {
	return text.replace(PERSISTED_ORGANIC_ANCHOR_RE, (_, raw: string) => {
		if (organic?.length) {
			return organicCitationMarker(Number.parseInt(raw, 10));
		}
		return `【${raw}】`;
	});
}

const PRE_BLOCK_SPLIT_RE = /(<pre\b[\s\S]*?<\/pre>)/gi;

/**
 * 合并引用胶囊（data-organic-cite-group）：按当前预览索引刷新正文内域名、favicon 与「域名 +N」角标（N 为本胶囊合并条数减一）。
 * 需在关闭预览或切换到其它锚点前对 index 0 调用一次以恢复默认文案。
 */
export function syncOrganicMergedAnchorDom(
	anchor: HTMLAnchorElement,
	items: SearchOrganicItem[],
	index: number,
): void {
	if (!anchor.getAttribute('data-organic-cite-group')?.trim()) {
		return;
	}
	if (!items.length) {
		return;
	}
	const i = Math.min(Math.max(0, index), items.length - 1);
	const item = items[i];
	const link = item.link?.trim();
	if (!link) {
		return;
	}
	anchor.setAttribute('href', link);
	const host = shortHostnameFromUrl(link);
	anchor.replaceChildren();
	const iconUrl = item.icon?.trim();
	if (iconUrl) {
		const img = document.createElement('img');
		img.className = '__md-search-organic-favicon__';
		img.width = 12;
		img.height = 12;
		img.alt = '';
		img.referrerPolicy = 'no-referrer';
		img.src = iconUrl;
		img.onerror = () => {
			img.style.visibility = 'hidden';
		};
		anchor.appendChild(img);
	}
	const label = items.length > 1 ? `${host} +${items.length - 1}` : host;
	anchor.appendChild(document.createTextNode(label));
}

/**
 * 在 markdown-it 渲染后的 HTML 上，将占位符替换为可点击胶囊链接。
 * 同一连续占位符串合并为一颗胶囊；多条时文案均为「首条短域名 +额外条数」（与预览切换后 syncOrganicMergedAnchorDom 一致）。
 */
export function injectOrganicCitationAnchorsIntoMarkdownHtml(
	html: string,
	organic: SearchOrganicItem[],
): string {
	if (!organic?.length || !html.includes('〔cite:')) {
		return html;
	}

	const injectChunk = (chunk: string): string =>
		chunk.replace(/(?:〔cite:\d+〕)+/g, (full) => {
			const ids = [...full.matchAll(/〔cite:(\d+)〕/g)].map((m) =>
				Number.parseInt(m[1], 10),
			);
			const valid = [...new Set(ids)].filter(
				(id) =>
					id >= 1 && id <= organic.length && organic[id - 1]?.link?.trim(),
			);
			if (valid.length === 0) {
				return full;
			}
			const citeIds = valid;
			const id = citeIds[0];
			const item = organic[id - 1];
			const link = item.link.trim();
			const hosts = citeIds.map((cid) =>
				shortHostnameFromUrl(organic[cid - 1].link.trim()),
			);
			const count = citeIds.length;
			/** 当前胶囊的标签文案（单条为域名，多条为「域名 +N」） */
			const label = count === 1 ? hosts[0] : `${hosts[0]} +${count - 1}`;
			const groupAttr =
				count > 1 ? ` data-organic-cite-group="${citeIds.join(',')}"` : '';
			const iconUrl = item.icon?.trim();
			const iconHtml = iconUrl
				? `<img src="${escapeHrefForDoubleQuotedAttr(iconUrl)}" alt="" class="__md-search-organic-favicon__" width="12" height="12" referrerpolicy="no-referrer" />`
				: '';
			return `<a href="${escapeHrefForDoubleQuotedAttr(link)}" data-organic-cite="${id}"${groupAttr} target="_blank" rel="noopener noreferrer" style="cursor: pointer;" class="__md-search-organic__">${iconHtml}${escapeHtmlText(label)}</a>`;
		});

	return html
		.split(PRE_BLOCK_SPLIT_RE)
		.map((part) => {
			if (/^<pre\b/i.test(part)) {
				return part;
			}
			return injectChunk(part);
		})
		.join('');
}

function urlsMatchForOrganic(dest: string, organicLink: string): boolean {
	const norm = (u: string) => {
		let s = u.trim();
		try {
			s = decodeURIComponent(s);
		} catch {
			// 非法百分号序列时保持原样
		}
		return s;
	};
	return norm(dest) === norm(organicLink);
}

/** 将 Serper 引用转为可点击的 <a>（与后端落库前处理一致） */
export function applyOrganicCitationAnchors(
	text: string,
	organic: Pick<OrganicLinkItem, 'link'>[],
): string {
	if (!text || !organic?.length) {
		return text;
	}
	const max = organic.length;
	const toMarker = (idx: number): string | null => {
		if (idx < 1 || idx > max) {
			return null;
		}
		const link = organic[idx - 1]?.link?.trim();
		if (!link) {
			return null;
		}
		return organicCitationMarker(idx);
	};

	let out = text.replace(
		/\[(\d+)\]\(\s*(?:<([^>\n]+)>|([^)\n]+))\s*\)/g,
		(full, raw: string, angled?: string, plain?: string) => {
			const i = Number.parseInt(raw, 10);
			if (Number.isNaN(i)) {
				return full;
			}
			const destRaw = (angled ?? plain ?? '').trim();
			if (!destRaw) {
				return full;
			}
			const expected = organic[i - 1]?.link?.trim();
			if (!expected || !urlsMatchForOrganic(destRaw, expected)) {
				return full;
			}
			return toMarker(i) ?? full;
		},
	);

	out = out.replace(/【(\d+)】/g, (full, raw: string) => {
		const i = Number.parseInt(raw, 10);
		if (Number.isNaN(i)) {
			return full;
		}
		return toMarker(i) ?? full;
	});

	out = out.replace(/\[(\d+)\](?!\()/g, (full, raw: string) => {
		const i = Number.parseInt(raw, 10);
		if (Number.isNaN(i)) {
			return full;
		}
		return toMarker(i) ?? full;
	});
	return out;
}

/** 由正文中的引用锚点解析对应的 Serper 条目（优先 data-organic-cite，否则按 href 匹配） */
export function resolveSearchOrganicFromCitationAnchor(
	anchor: HTMLAnchorElement,
	organics: SearchOrganicItem[],
): SearchOrganicItem | undefined {
	const cite = anchor.getAttribute('data-organic-cite');
	if (cite) {
		const n = Number.parseInt(cite, 10);
		if (!Number.isNaN(n) && n >= 1 && n <= organics.length) {
			return organics[n - 1];
		}
	}
	const href = anchor.getAttribute('href');
	if (!href?.trim()) {
		return undefined;
	}
	return organics.find((o) => urlsMatchForOrganic(href.trim(), o.link.trim()));
}

/**
 * 悬浮预览用的条目列表：合并胶囊带 data-organic-cite-group（逗号分隔序号）。
 */
export function resolveOrganicCitationPreviewItems(
	anchor: HTMLAnchorElement,
	organics: SearchOrganicItem[],
): SearchOrganicItem[] {
	const group = anchor.getAttribute('data-organic-cite-group')?.trim();
	if (group) {
		const ids = [
			...new Set(
				group
					.split(',')
					.map((s) => Number.parseInt(s.trim(), 10))
					.filter((n) => !Number.isNaN(n) && n >= 1 && n <= organics.length),
			),
		];
		return ids.map((id) => organics[id - 1]).filter(Boolean);
	}
	const one = resolveSearchOrganicFromCitationAnchor(anchor, organics);
	return one ? [one] : [];
}

/** 净化摘要：去掉 HTML / 常见 Markdown，避免悬浮层出现裸标签或 ### */
export function sanitizeOrganicSnippetForPreview(
	raw: string | undefined,
): string {
	if (!raw?.trim()) {
		return '';
	}
	let s = raw.trim();
	s = s.replace(/<script\b[\s\S]*?<\/script>/gi, '');
	s = s.replace(/<style\b[\s\S]*?<\/style>/gi, '');
	s = s.replace(/<[^>]+>/g, ' ');
	s = s
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#(\d+);/g, (_, n) => {
			try {
				const c = Number.parseInt(n, 10);
				if (c < 0 || c > 0x10ffff) return '';
				return String.fromCodePoint(c);
			} catch {
				return '';
			}
		})
		.replace(/&#x([\da-f]+);/gi, (_, h) => {
			try {
				const c = Number.parseInt(h, 16);
				if (c < 0 || c > 0x10ffff) return '';
				return String.fromCodePoint(c);
			} catch {
				return '';
			}
		});
	s = s.replace(/^#{1,6}\s+/gm, '');
	s = s.replace(/\*\*([^*]*)\*\*/g, '$1');
	s = s.replace(/__([^_]*)__/g, '$1');
	s = s.replace(/`{1,3}[^`]*`{1,3}/g, ' ');
	s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
	s = s.replace(/\s+/g, ' ').trim();
	return s.length > 480 ? `${s.slice(0, 477)}…` : s;
}

function previewItemsKey(items: SearchOrganicItem[]): string {
	return items.map((x) => x.link).join('\u0001');
}

/** 判定两组预览条目是否同一引用（用于 pointermove 防抖） */
export function areOrganicPreviewItemsSame(
	a: SearchOrganicItem[],
	b: SearchOrganicItem[],
): boolean {
	return previewItemsKey(a) === previewItemsKey(b);
}

function anchorRectsHitPoint(
	a: HTMLAnchorElement,
	x: number,
	y: number,
	pad: number,
): boolean {
	const br = a.getBoundingClientRect();
	const rects =
		br.width > 0.5 && br.height > 0.5
			? [br]
			: a.getClientRects().length > 0
				? Array.from(a.getClientRects())
				: [br];
	for (const r of rects) {
		if (
			x >= r.left - pad &&
			x <= r.right + pad &&
			y >= r.top - pad &&
			y <= r.bottom + pad
		) {
			return true;
		}
	}
	return false;
}

/** 指针到角标可见矩形的最短距离平方（在矩形内为 0），用于多角标同时落在 pad 内时选最近者 */
function pointToOrganicAnchorDistSq(
	a: HTMLAnchorElement,
	x: number,
	y: number,
): number {
	const br = a.getBoundingClientRect();
	const rects =
		br.width > 0.5 && br.height > 0.5
			? [br]
			: a.getClientRects().length > 0
				? Array.from(a.getClientRects())
				: [br];
	let min = Infinity;
	for (const r of rects) {
		const cx = Math.max(r.left, Math.min(x, r.right));
		const cy = Math.max(r.top, Math.min(y, r.bottom));
		const dx = x - cx;
		const dy = y - cy;
		const d = dx * dx + dy * dy;
		if (d < min) {
			min = d;
		}
	}
	return min;
}

/**
 * a 被 pointer-events:none 时 target 不会是 <a>，用指针坐标在 root 内命中 Serper 引用角标。
 */
export function findOrganicCitationAnchorAtPoint(
	root: HTMLElement,
	organics: SearchOrganicItem[],
	clientX: number,
	clientY: number,
): HTMLAnchorElement | null {
	if (!organics.length) return null;
	const pad = 4;
	const candidates: HTMLAnchorElement[] = [];
	for (const node of root.querySelectorAll('a')) {
		const a = node as HTMLAnchorElement;
		if (a.closest('pre')) continue;
		if (!resolveSearchOrganicFromCitationAnchor(a, organics)) continue;
		if (!root.contains(a)) continue;
		if (anchorRectsHitPoint(a, clientX, clientY, pad)) {
			candidates.push(a);
		}
	}
	if (candidates.length === 0) return null;
	if (candidates.length === 1) return candidates[0];
	return candidates.reduce((best, cur) => {
		const db = pointToOrganicAnchorDistSq(best, clientX, clientY);
		const dc = pointToOrganicAnchorDistSq(cur, clientX, clientY);
		if (dc < db) {
			return cur;
		}
		if (dc > db) {
			return best;
		}
		const br = best.getBoundingClientRect();
		const cr = cur.getBoundingClientRect();
		return cr.width * cr.height <= br.width * br.height ? cur : best;
	});
}

/**
 * 从事件目标向上查找：位于 root 内、且能对应到 searchOrganic 的引用 <a>。
 * 不依赖 __md-search-organic__（Markdown 可能剥掉 class）；兼容 target 为文本节点。
 */
export function findClosestOrganicCitationAnchor(
	start: EventTarget | null,
	root: HTMLElement,
	organics: SearchOrganicItem[],
): HTMLAnchorElement | null {
	if (!organics.length) {
		return null;
	}
	const el =
		start instanceof Element
			? start
			: start instanceof Text
				? start.parentElement
				: null;
	if (!el) {
		return null;
	}
	const a = el.closest('a');
	if (!a || !root.contains(a)) {
		return null;
	}
	const anchor = a as HTMLAnchorElement;
	return resolveSearchOrganicFromCitationAnchor(anchor, organics)
		? anchor
		: null;
}
