/** mp-html / rich-text 友好标签白名单 */
const ALLOWED_TAGS =
	/^(div|p|span|h[1-6]|img|a|br|strong|em|b|i|u|blockquote|ul|ol|li|table|thead|tbody|tr|td|th)$/i;

export function extractBodyHtml(html: string): string {
	const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
	return (m?.[1] ?? html).trim();
}

export function sanitizeEpubHtml(html: string): string {
	let out = html
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
		.replace(/<style[\s\S]*?<\/style>/gi, '')
		.replace(/\son\w+="[^"]*"/gi, '')
		.replace(/\son\w+='[^']*'/gi, '');

	out = out.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (tag, name: string) => {
		if (!ALLOWED_TAGS.test(name)) return '';
		if (tag.startsWith('</')) return `</${name.toLowerCase()}>`;
		if (name.toLowerCase() === 'img') {
			const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1];
			const alt = tag.match(/\salt=["']([^"']*)["']/i)?.[1];
			if (!src) return '';
			return `<img src="${src}"${alt != null ? ` alt="${alt}"` : ''} loading="lazy" />`;
		}
		if (name.toLowerCase() === 'br') return '<br />';
		if (name.toLowerCase() === 'a') {
			const href = tag.match(/\shref=["']([^"']+)["']/i)?.[1];
			return href ? `<a href="${href}">` : '<a>';
		}
		return `<${name.toLowerCase()}>`;
	});

	return out.trim();
}

export function countWords(html: string): number {
	const text = html.replace(/<[^>]*>/g, '');
	const chinese = text.match(/[\u4e00-\u9fa5]/g)?.length ?? 0;
	const english = text.match(/[a-zA-Z]+/g)?.length ?? 0;
	const numbers = text.match(/\d+/g)?.length ?? 0;
	return chinese + english + numbers;
}
