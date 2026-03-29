/**
 * 与后端 serper.service.ts 中 applyOrganicCitationAnchors 保持一致：
 * 流式阶段前端只收到原始文本，需在展示层把 【n】、[n](url)、裸 [n] 转为带样式的 <a>。
 */

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
		return `<a href="${escapeHrefForDoubleQuotedAttr(link)}" target="_blank" rel="noopener noreferrer" style="cursor: default;" class="__md-search-organic__">${idx}</a>`;
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
