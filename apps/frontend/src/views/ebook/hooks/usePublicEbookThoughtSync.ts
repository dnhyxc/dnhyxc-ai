import { useCallback, useEffect, useRef } from 'react';
import { fetchEbookThoughtSync } from '@/service';
import type { Book, EbookPublicSource, EbookThought } from '../types';
import { ephemeralPinThoughtCfis } from '../utils/epub/mark/epubThoughtAnnotations';
import {
	applyEbookThoughtSync,
	ebookThoughtSyncSinceParam,
	isSharedEbookThoughtContext,
	maxEbookThoughtUpdatedAt,
} from '../utils/epub/mark/epubThoughtSync';

/** 滚动停稳后再探测（与进度保存同量级，避免短停触发 sync→全量 mark）；两次探测至少间隔 5s */
const RELOC_DEBOUNCE_MS = 2_000;
const MIN_SYNC_INTERVAL_MS = 5_000;

type SyncOptions = {
	/** 打开想法列表等交互：跳过节流 */
	force?: boolean;
};

type Options = {
	bookId: string;
	book?: Book | null;
	publicSource?: EbookPublicSource | null;
	thoughts: EbookThought[];
	setThoughts: React.Dispatch<React.SetStateAction<EbookThought[]>>;
	onMerged?: () => void;
};

export function usePublicEbookThoughtSync({
	bookId,
	book,
	publicSource,
	thoughts,
	setThoughts,
	onMerged,
}: Options) {
	const thoughtsRef = useRef(thoughts);
	thoughtsRef.current = thoughts;

	const onMergedRef = useRef(onMerged);
	onMergedRef.current = onMerged;

	const enabled =
		Boolean(bookId) &&
		Boolean(book) &&
		isSharedEbookThoughtContext(book, publicSource);

	const lastSyncAtRef = useRef(0);
	const inFlightRef = useRef<Promise<EbookThought[] | null> | null>(null);
	const relocTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const syncThoughts = useCallback(
		async (options?: SyncOptions): Promise<EbookThought[] | null> => {
			if (!enabled || !bookId) return null;
			if (inFlightRef.current) return inFlightRef.current;

			const now = Date.now();
			if (
				!options?.force &&
				now - lastSyncAtRef.current < MIN_SYNC_INTERVAL_MS
			) {
				return thoughtsRef.current;
			}

			const run = async (): Promise<EbookThought[] | null> => {
				try {
					const local = thoughtsRef.current;
					const since = ebookThoughtSyncSinceParam(
						maxEbookThoughtUpdatedAt(local),
					);
					const sync = await fetchEbookThoughtSync(bookId, since);
					const { next } = applyEbookThoughtSync(local, sync);

					if (next !== local) {
						if (sync.changes.length > 0) {
							ephemeralPinThoughtCfis(
								sync.changes.map((thought) => thought.cfiRange),
							);
						}
						setThoughts(next);
						onMergedRef.current?.();
					}
					lastSyncAtRef.current = Date.now();
					return next;
				} catch {
					return thoughtsRef.current;
				} finally {
					inFlightRef.current = null;
				}
			};

			inFlightRef.current = run();
			return inFlightRef.current;
		},
		[bookId, enabled, setThoughts],
	);

	const refreshThoughtsNow = useCallback(
		() => syncThoughts({ force: true }),
		[syncThoughts],
	);

	const scheduleSync = useCallback(() => {
		if (!enabled) return;
		if (relocTimerRef.current) clearTimeout(relocTimerRef.current);
		relocTimerRef.current = setTimeout(() => {
			relocTimerRef.current = null;
			void syncThoughts();
		}, RELOC_DEBOUNCE_MS);
	}, [enabled, syncThoughts]);

	useEffect(() => {
		if (!enabled) return;
		const onVisibility = () => {
			if (document.visibilityState === 'visible') {
				lastSyncAtRef.current = 0;
				void syncThoughts();
			}
		};
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			document.removeEventListener('visibilitychange', onVisibility);
			if (relocTimerRef.current) clearTimeout(relocTimerRef.current);
		};
	}, [enabled, syncThoughts]);

	return { scheduleSync, refreshThoughtsNow };
}
