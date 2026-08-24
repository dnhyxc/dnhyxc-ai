/**
 * 学习笔记 HTML → notes/ COS 附件引用（抽 key，供附件表同步）。
 */

const IMG_SRC_RE = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

/** 与 uploadService.buildCosObjectKey 一致：notes/{uuid}_… */
const NOTES_KEY_RE = /^notes\/[0-9a-f-]{36}_[^/]+$/i;

export type NoteImageRef = { key: string; url: string };

function decodeHtmlEntities(s: string): string {
	return s
		.replace(/&amp;/gi, '&')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>');
}

function decodePathKey(raw: string): string {
	return raw
		.replace(/^\//, '')
		.split('/')
		.map((seg) => {
			try {
				return decodeURIComponent(seg);
			} catch {
				return seg;
			}
		})
		.join('/');
}

function normalizeNotesKey(key: string): string | null {
	const cleaned = decodePathKey(key.replace(/^\//, '').trim());
	return NOTES_KEY_RE.test(cleaned) ? cleaned : null;
}

/** 从 img src（完整 URL / /ext-cos/ 代理 / 裸 key）抽出 notes/… 对象键 */
export function extractNoteCosKeyFromSrc(src: string): string | null {
	const trimmed = decodeHtmlEntities(src?.trim() ?? '');
	if (!trimmed || /^data:/i.test(trimmed)) return null;

	const bare = normalizeNotesKey(trimmed);
	if (bare) return bare;

	try {
		const asUrl = /^https?:\/\//i.test(trimmed)
			? new URL(trimmed)
			: new URL(
					trimmed.startsWith('/') ? trimmed : `/${trimmed}`,
					'http://local.invalid',
				);
		const path = decodePathKey(asUrl.pathname);
		const idx = path.indexOf('notes/');
		if (idx < 0) return null;
		return normalizeNotesKey(path.slice(idx));
	} catch {
		return null;
	}
}

/** 从 TipTap HTML 抽出本笔记域图片附件（按 key 去重） */
export function extractNoteImageRefsFromHtml(html: string): NoteImageRef[] {
	if (!html?.trim()) return [];
	const byKey = new Map<string, NoteImageRef>();
	IMG_SRC_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = IMG_SRC_RE.exec(html)) !== null) {
		const rawSrc = (m[1] ?? m[2] ?? m[3] ?? '').trim();
		const src = decodeHtmlEntities(rawSrc);
		const key = extractNoteCosKeyFromSrc(src);
		if (!key || byKey.has(key)) continue;
		byKey.set(key, {
			key,
			url: /^https?:\/\//i.test(src) ? src : '',
		});
	}
	return [...byKey.values()];
}
