/**
 * 无 EPUB 高亮的听当前同款播法：首句快出声，其后按段整包 TTS（cloudSingleUtterance）。
 */
import { buildSentenceOffsetSpans, stripMarkdownForTts } from '@/utils/speech';
import { buildParagraphUnits } from './epubListenParagraphs';
import { playListenUnitsFromCursor } from './epubListenPlayUnits';

export async function playListenPlainText(
	rawText: string,
	options?: {
		isActive?: () => boolean;
		getRate?: () => number;
		onAwaitingCurrentTts?: (waiting: boolean) => void;
		onSentence?: (
			si: number,
			info: { forceCenter?: boolean; early?: boolean },
		) => void;
		onAudioTime?: (info: {
			text: string;
			baseSi: number;
			currentTime: number;
			duration: number;
			/** 与听书同一套中英权重切句（相对本段 text） */
			sentenceIndex?: number;
		}) => void;
	},
): Promise<boolean> {
	const plain = stripMarkdownForTts(rawText).trim();
	if (!plain) return false;
	const sentences = buildSentenceOffsetSpans(plain);
	if (sentences.length === 0) return false;
	const units = buildParagraphUnits(plain, sentences);
	if (units.length === 0) return false;

	return playListenUnitsFromCursor({
		plain,
		sentences,
		units,
		startSi: 0,
		getRate: options?.getRate ?? (() => 1),
		isActive: options?.isActive ?? (() => true),
		onSentence: options?.onSentence ?? (() => {}),
		onAwaitingCurrentTts: options?.onAwaitingCurrentTts,
		onAudioTime: options?.onAudioTime,
	});
}
