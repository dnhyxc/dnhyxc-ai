/**
 * 听书/听当前：首句（及切句后首包）逐句合成快出声；
 * 同段剩余与后续单元按段合成。
 * 预取错开到「当前段真正出声之后」，避免与首包 HTTP 并行抢带宽。
 */
import {
	playEnglishPreferred,
	prefetchCloudEnglishTts,
	stripMarkdownForTts,
} from '@/utils/englishTts';
import {
	type ParagraphUnit,
	paragraphIndexForSentence,
	sliceParagraphFromSentence,
} from './epubListenParagraphs';

type SentenceSpan = { start: number; end: number };

export type PlayListenUnitsArgs = {
	plain: string;
	sentences: SentenceSpan[];
	units: ParagraphUnit[];
	startSi: number;
	/** 每次起播时取当前倍速（勿在段循环外快照，否则中途调速会丢） */
	getRate: () => number;
	isActive: () => boolean;
	onSentence: (si: number, info: { forceCenter?: boolean }) => void;
	onUnitIdle?: () => void;
	scrollCenterOnFirst?: boolean;
	/**
	 * 当前正要播放的单元 TTS 等待中（true）/ 已出声或结束（false）。
	 * 仅阻塞播放的请求；prefetchCloudEnglishTts 不触发。
	 */
	onAwaitingCurrentTts?: (waiting: boolean) => void;
};

function sentenceRaw(
	plain: string,
	sentences: SentenceSpan[],
	si: number,
): string {
	const sent = sentences[si];
	if (!sent) return '';
	return stripMarkdownForTts(plain.slice(sent.start, sent.end)).trim();
}

/** 只触发一次的预取调度（出声回调 + await 后兜底） */
function oncePrefetch(run: () => void): () => void {
	let done = false;
	return () => {
		if (done) return;
		done = true;
		run();
	};
}

/**
 * @returns true = 播完且仍 active；false = 中断/暂停
 * @throws playEnglishPreferred 失败时原样抛出
 */
export async function playListenUnitsFromCursor(
	args: PlayListenUnitsArgs,
): Promise<boolean> {
	const {
		plain,
		sentences,
		units,
		getRate,
		isActive,
		onSentence,
		onUnitIdle,
		scrollCenterOnFirst,
		onAwaitingCurrentTts,
	} = args;
	const loopStartSi = args.startSi;

	if (units.length === 0 || sentences.length === 0) return false;

	const prefetchedByText = new Map<
		string,
		ReturnType<typeof prefetchCloudEnglishTts>
	>();

	const schedulePrefetch = (paraIndex: number, fromSi: number) => {
		if (!isActive()) return;
		if (paraIndex >= units.length) return;
		const unit = units[paraIndex]!;
		const raw = sliceParagraphFromSentence(plain, unit, sentences, fromSi);
		if (!raw || prefetchedByText.has(raw)) return;
		prefetchedByText.set(raw, prefetchCloudEnglishTts(raw, { whole: true }));
	};

	/** 当前播放路径的 TTS 等待；预取勿走这里 */
	const playCurrent = async (
		raw: string,
		opts: Parameters<typeof playEnglishPreferred>[1],
	) => {
		onAwaitingCurrentTts?.(true);
		try {
			const notifyStart = opts?.onPlaybackStart;
			await playEnglishPreferred(raw, {
				...opts,
				onPlaybackStart: () => {
					onAwaitingCurrentTts?.(false);
					notifyStart?.();
				},
			});
		} finally {
			onAwaitingCurrentTts?.(false);
		}
	};

	let si = Math.max(0, Math.min(args.startSi, sentences.length - 1));
	let pi = paragraphIndexForSentence(units, si);
	if (pi < 0) return false;

	/** 本轮需逐句首包；单句段（章标题等）不消耗，留给下一段正文 */
	let kickSentence = true;

	for (; pi < units.length; pi += 1) {
		if (!isActive()) return false;

		const unit = units[pi]!;
		const startSi = Math.max(si, unit.siStart);
		if (startSi >= unit.siEnd) continue;

		// —— 首包：只合成当前句（1 路 HTTP）；出声后再预取，避免与首包抢带宽 ——
		if (kickSentence) {
			const kickRaw = sentenceRaw(plain, sentences, startSi);
			if (!kickRaw) {
				si = startSi + 1;
				continue;
			}

			onSentence(startSi, {
				forceCenter: !!scrollCenterOnFirst && startSi === loopStartSi,
			});

			const prefetchAfterKickStart = oncePrefetch(() => {
				if (startSi + 1 < unit.siEnd) {
					schedulePrefetch(pi, startSi + 1);
				} else if (pi + 1 < units.length) {
					schedulePrefetch(pi + 1, units[pi + 1]!.siStart);
				}
			});

			await playCurrent(kickRaw, {
				speak: { rate: getRate() },
				cloudSingleUtterance: true,
				onPlaybackStart: prefetchAfterKickStart,
			});
			// 本机无 onPlaybackStart 时仍兜底预取，保证后续等待不被拉长
			prefetchAfterKickStart();

			if (!isActive()) return false;
			onUnitIdle?.();
			si = startSi + 1;

			// 单句合成单元（目录切章后常见标题）：不消耗 kick，下一段正文仍逐句首包
			if (si >= unit.siEnd) {
				continue;
			}

			kickSentence = false;

			const restRaw = sliceParagraphFromSentence(plain, unit, sentences, si);
			if (!restRaw) {
				si = unit.siEnd;
				continue;
			}

			const restStartSi = si;
			onSentence(restStartSi, {});

			const prefetchAfterRestStart = oncePrefetch(() => {
				if (pi + 1 < units.length) {
					schedulePrefetch(pi + 1, units[pi + 1]!.siStart);
				}
			});

			await playCurrent(restRaw, {
				speak: { rate: getRate() },
				prefetchedCloud: prefetchedByText.get(restRaw) ?? null,
				cloudSingleUtterance: true,
				onPlaybackStart: prefetchAfterRestStart,
				onCadenceChunk: (event) => {
					if (event.phase !== 'start') return;
					if (!isActive()) return;
					const globalSi = restStartSi + event.sentenceIndex;
					if (globalSi < unit.siStart || globalSi >= unit.siEnd) return;
					onSentence(globalSi, {});
				},
			});
			prefetchAfterRestStart();

			if (!isActive()) return false;
			onUnitIdle?.();
			si = unit.siEnd;
			continue;
		}

		// —— 后续单元：整段合成；出声后再预取下一段 ——
		const spokenRaw = sliceParagraphFromSentence(
			plain,
			unit,
			sentences,
			startSi,
		);
		if (!spokenRaw) {
			si = unit.siEnd;
			continue;
		}

		onSentence(startSi, {});

		const prefetchAfterUnitStart = oncePrefetch(() => {
			if (pi + 1 < units.length) {
				schedulePrefetch(pi + 1, units[pi + 1]!.siStart);
			}
		});

		await playCurrent(spokenRaw, {
			speak: { rate: getRate() },
			prefetchedCloud: prefetchedByText.get(spokenRaw) ?? null,
			cloudSingleUtterance: true,
			onPlaybackStart: prefetchAfterUnitStart,
			onCadenceChunk: (event) => {
				if (event.phase !== 'start') return;
				if (!isActive()) return;
				const globalSi = startSi + event.sentenceIndex;
				if (globalSi < unit.siStart || globalSi >= unit.siEnd) return;
				onSentence(globalSi, {});
			},
		});
		prefetchAfterUnitStart();

		if (!isActive()) return false;
		onUnitIdle?.();
		si = unit.siEnd;
	}

	return isActive();
}
