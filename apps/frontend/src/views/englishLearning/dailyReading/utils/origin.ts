export type ReadingOrigin = 'day' | 'manual';

export function parseOrigin(raw: string | null): ReadingOrigin {
	return raw === 'manual' ? 'manual' : 'day';
}
