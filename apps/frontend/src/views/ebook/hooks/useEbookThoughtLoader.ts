import type { Rendition } from 'epubjs';
import {
	startTransition,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { fetchEbookThoughts } from '@/service';
import type { EbookThought } from '../types';
import {
	collectLoadedSpineHints,
	normalizeCfiSpineHint,
} from '../utils/epub/mark/epubMarkShared';

type Options = {
	bookId: string | undefined;
	bookFmt: 'epub' | 'pdf' | undefined;
	epubNavReady: boolean;
	getRendition: () => Rendition | null;
	onLoadError?: (error: unknown) => void;
};

function mergeThoughtLists(
	prev: EbookThought[],
	incoming: EbookThought[],
): EbookThought[] {
	if (incoming.length === 0) return prev;
	const byId = new Map(prev.map((thought) => [thought.id, thought]));
	let changed = false;
	for (const thought of incoming) {
		const existing = byId.get(thought.id);
		if (!existing || existing !== thought) {
			byId.set(thought.id, thought);
			changed = true;
		}
	}
	return changed ? [...byId.values()] : prev;
}

export function useEbookThoughtLoader({
	bookId,
	bookFmt,
	epubNavReady,
	getRendition,
	onLoadError,
}: Options) {
	const [thoughts, setThoughts] = useState<EbookThought[]>([]);
	const fetchedSpineHintsRef = useRef(new Set<string>());
	const inFlightRef = useRef(new Map<string, Promise<void>>());
	const onLoadErrorRef = useRef(onLoadError);
	onLoadErrorRef.current = onLoadError;

	const mergeThoughts = useCallback((incoming: EbookThought[]) => {
		if (incoming.length === 0) return;
		startTransition(() => {
			setThoughts((prev) => mergeThoughtLists(prev, incoming));
		});
	}, []);

	const ensureSpineThoughtsLoaded = useCallback(
		async (spineHint: string) => {
			if (!bookId || bookFmt !== 'epub') return;
			const hint = normalizeCfiSpineHint(spineHint);
			if (!hint || fetchedSpineHintsRef.current.has(hint)) return;

			const pending = inFlightRef.current.get(hint);
			if (pending) return pending;

			const run = (async () => {
				try {
					const list = await fetchEbookThoughts(bookId, {
						spineHints: [hint],
					});
					fetchedSpineHintsRef.current.add(hint);
					mergeThoughts(list);
				} catch (error) {
					onLoadErrorRef.current?.(error);
				} finally {
					inFlightRef.current.delete(hint);
				}
			})();
			inFlightRef.current.set(hint, run);
			return run;
		},
		[bookId, bookFmt, mergeThoughts],
	);

	const ensureLoadedSpineThoughts = useCallback(
		(rend: Rendition) => {
			for (const hint of collectLoadedSpineHints(rend)) {
				void ensureSpineThoughtsLoaded(hint);
			}
		},
		[ensureSpineThoughtsLoaded],
	);

	useEffect(() => {
		fetchedSpineHintsRef.current.clear();
		inFlightRef.current.clear();
		setThoughts([]);
	}, [bookId]);

	useEffect(() => {
		if (!bookId || bookFmt === 'epub') return;
		let cancelled = false;
		void fetchEbookThoughts(bookId)
			.then((list) => {
				if (!cancelled) setThoughts(list);
			})
			.catch((error) => {
				if (!cancelled) onLoadErrorRef.current?.(error);
			});
		return () => {
			cancelled = true;
		};
	}, [bookId, bookFmt]);

	useEffect(() => {
		if (!bookId || bookFmt !== 'epub' || !epubNavReady) return;
		const rend = getRendition();
		if (!rend) return;
		ensureLoadedSpineThoughts(rend);
	}, [bookId, bookFmt, epubNavReady, getRendition, ensureLoadedSpineThoughts]);

	return {
		thoughts,
		setThoughts,
		mergeThoughts,
		ensureLoadedSpineThoughts,
	};
}
