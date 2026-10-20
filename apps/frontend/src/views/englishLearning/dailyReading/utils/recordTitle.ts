/** 短文 JSON 后面还会接释义。只取第一段已闭合的对象，避免整段解析失败后退回时间。 */
function firstJsonObject(text: string): string | null {
	const start = text.indexOf('{');
	if (start < 0) return null;
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = start; i < text.length; i += 1) {
		const ch = text[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (ch === '\\') escaped = true;
			else if (ch === '"') inString = false;
			continue;
		}
		if (ch === '"') {
			inString = true;
			continue;
		}
		if (ch === '{') depth += 1;
		else if (ch === '}') {
			depth -= 1;
			if (depth === 0) return text.slice(start, i + 1);
		}
	}
	return null;
}

export function recordTitle(text: string, startedAt: number): string {
	const slice = firstJsonObject(text);
	if (slice) {
		try {
			const data = JSON.parse(slice) as {
				titleZh?: unknown;
				titleEn?: unknown;
				answer?: { titleZh?: unknown; titleEn?: unknown };
			};
			const title =
				data.titleZh ??
				data.answer?.titleZh ??
				data.titleEn ??
				data.answer?.titleEn;
			if (typeof title === 'string' && title.trim()) return title.trim();
		} catch {
			// 第一段还不是完整 JSON 时，列表用开始时间。
		}
	}
	return new Date(startedAt).toLocaleString();
}
