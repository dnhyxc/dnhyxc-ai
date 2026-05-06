import type { WebSearchOrganicItem } from './web-search.types';

/** 转义 href 属性中的引号与 &，避免破坏 HTML */
function escapeHrefForDoubleQuotedAttr(url: string): string {
	return url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** 与 organic 条目的 URL 比对（trim + 尽力 decodeURIComponent 归一化） */
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

/**
 * 将模型常用的【n】、以及非 Markdown 链接形式的 [n] 转为指向 organic[n-1].link 的 <a>。
 * 与提示词配合使用：即使模型不输出 HTML，前端与落库仍可得可点击引用。
 */
export function applyOrganicCitationAnchors(
	text: string,
	organic: Pick<WebSearchOrganicItem, 'link'>[],
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

	// 模型按提示输出 Markdown [n](url) 时，转为与【n】相同属性的 <a>（href 以 organic 为准，防篡改）
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
	// 排除 Markdown 链接 [text](url) 中的 [数字]
	out = out.replace(/\[(\d+)\](?!\()/g, (full, raw: string) => {
		const i = Number.parseInt(raw, 10);
		if (Number.isNaN(i)) {
			return full;
		}
		return toAnchor(i) ?? full;
	});
	return out;
}
