/**
 * 练习会话轮次 ↔ 报告条目序列化
 */
import type { EnglishPracticeReportItem } from '@/service';
import type { PracticeAttemptResult, PracticeSessionRound } from '../types';
import { getPracticeAnswerText, isPracticeVocabItem } from './item';

/** 单次作答 → 报告 item 快照 */
export function attemptToReportItem(
	r: PracticeAttemptResult,
): EnglishPracticeReportItem {
	const base: EnglishPracticeReportItem = {
		itemKey: r.item.key,
		contentKind: r.item.contentKind,
		userInput: r.userInput,
		correct: r.correct,
		answerText: getPracticeAnswerText(r.item),
		translationZh: r.item.translationZh ?? '',
	};
	if (isPracticeVocabItem(r.item) && r.item.ipa?.trim()) {
		base.ipa = r.item.ipa.trim();
	}
	if (isPracticeVocabItem(r.item) && r.item.pos?.trim()) {
		base.pos = r.item.pos.trim();
	}
	return base;
}

/** 会话轮次 → 报告 rounds + 扁平 items */
export function serializeSessionRounds(rounds: PracticeSessionRound[]): {
	rounds: {
		roundIndex: number;
		completedAt?: string;
		items: EnglishPracticeReportItem[];
	}[];
	items: EnglishPracticeReportItem[];
} {
	const reportRounds = rounds.map((round) => ({
		roundIndex: round.roundIndex,
		completedAt: round.completedAt,
		items: round.results.map(attemptToReportItem),
	}));
	return {
		rounds: reportRounds,
		items: reportRounds.flatMap((r) => r.items),
	};
}
