/**
 * 与后端 serper.service.ts 中 applyOrganicCitationAnchors 保持一致：
 * 流式阶段前端只收到原始文本，需在展示层把 【n】、[n](url)、裸 [n] 转为带样式的 <a>。
 */

import type { SearchOrganicItem } from '@/types/chat';

export interface OrganicLinkItem {
	link: string;
}

function escapeHrefForDoubleQuotedAttr(url: string): string {
	return url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
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
	const toAnchor = (idx: number): string | null => {
		if (idx < 1 || idx > max) {
			return null;
		}
		const link = organic[idx - 1]?.link?.trim();
		if (!link) {
			return null;
		}
		return `<a href="${escapeHrefForDoubleQuotedAttr(link)}" data-organic-cite="${idx}" target="_blank" rel="noopener noreferrer" style="cursor: pointer;" class="__md-search-organic__">${idx}</a>`;
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
			return toAnchor(i) ?? full;
		},
	);

	out = out.replace(/【(\d+)】/g, (full, raw: string) => {
		const i = Number.parseInt(raw, 10);
		if (Number.isNaN(i)) {
			return full;
		}
		return toAnchor(i) ?? full;
	});

	out = out.replace(/\[(\d+)\](?!\()/g, (full, raw: string) => {
		const i = Number.parseInt(raw, 10);
		if (Number.isNaN(i)) {
			return full;
		}
		return toAnchor(i) ?? full;
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
