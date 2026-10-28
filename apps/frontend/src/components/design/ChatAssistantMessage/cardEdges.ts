export type CardPart =
	| { type: 'md'; text: string }
	| { type: 'card'; id: string };

export function splitCardAnchors(text: string): CardPart[] {
	const parts: CardPart[] = [];
	const re = /\[\[el:([^\]]+)\]\]/g;
	let last = 0;
	for (const match of text.matchAll(re)) {
		const index = match.index ?? 0;
		if (index > last) parts.push({ type: 'md', text: text.slice(last, index) });
		const id = match[1];
		if (id) parts.push({ type: 'card', id });
		last = index + match[0].length;
	}
	if (last < text.length || !parts.length) {
		parts.push({ type: 'md', text: text.slice(last) });
	}
	return parts;
}

function partHasContent(
	part: CardPart,
	resources: { artifactId: string }[] | null | undefined,
): boolean {
	if (part.type === 'md') return part.text.trim().length > 0;
	return Boolean(resources?.some((row) => row.artifactId === part.id));
}

/** 正文锚点上的卡：空白段不算内容；后面还有未锚点的卡也算下方有内容。 */
export function anchoredCardEdges(
	parts: CardPart[],
	index: number,
	resources: { artifactId: string }[] | null | undefined,
	looseAfter: number,
): { hasAbove: boolean; hasBelow: boolean } {
	const visible = (part: CardPart) => partHasContent(part, resources);
	return {
		hasAbove: parts.slice(0, index).some(visible),
		hasBelow: parts.slice(index + 1).some(visible) || looseAfter > 0,
	};
}

/** 落在正文后面的卡：前面有正文或更早的卡才留上边距。 */
export function looseCardEdges(
	index: number,
	count: number,
	bodyHasContent: boolean,
): { hasAbove: boolean; hasBelow: boolean } {
	return {
		hasAbove: index > 0 || bodyHasContent,
		hasBelow: index < count - 1,
	};
}

export function bodyHasContent(
	parts: CardPart[],
	resources: { artifactId: string }[] | null | undefined,
): boolean {
	return parts.some((part) => partHasContent(part, resources));
}
