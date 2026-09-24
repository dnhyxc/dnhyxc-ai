import type { EnglishPracticeReportDetail } from '@/service';
import type {
	PracticeCountOption,
	PracticeItem,
	PracticeSessionRound,
	PracticeSetupConfig,
	PracticeSource,
} from '../types';
import { reportItemToPracticeItem } from './reportItem';

export type PracticeResumeIntent = 'continue' | 'retryWrong' | 'setup';

export type PracticeResumeState = {
	intent: PracticeResumeIntent;
	config: PracticeSetupConfig;
	excludeKeys: string[];
	retryItems?: PracticeItem[];
	/** continue / retryWrong：报告历轮 → 会话 */
	priorRounds?: PracticeSessionRound[];
	/** continue / retryWrong：沿用原报告 id，覆盖写入 */
	reportId?: string;
};

const COUNT_OPTIONS: readonly PracticeCountOption[] = [
	10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
];

function parseSource(raw: string): PracticeSource {
	if (
		raw === 'library' ||
		raw === 'pack' ||
		raw === 'live' ||
		raw === 'mistakes' ||
		raw === 'dailyMemorize' ||
		raw === 'review' ||
		raw === 'favorites'
	) {
		return raw;
	}
	return 'favorites';
}

function allReportItems(detail: EnglishPracticeReportDetail) {
	if (detail.rounds && detail.rounds.length > 0) {
		return detail.rounds.flatMap((r) => r.items);
	}
	return detail.items ?? [];
}

function toCountOption(n: number): PracticeCountOption {
	return COUNT_OPTIONS.includes(n as PracticeCountOption)
		? (n as PracticeCountOption)
		: 20;
}

/** 把报告还原成可续练配置与队列线索 */
export function resumeFromReport(
	detail: EnglishPracticeReportDetail,
	intent: PracticeResumeIntent,
): PracticeResumeState {
	const meta = detail.sourceMeta;
	const config: PracticeSetupConfig = {
		contentKind: detail.contentKind,
		// ponytail: 认读报告续练落到听写；今日记词结算页才走 recognition 会话
		mode: detail.mode === 'spelling' ? 'spelling' : 'dictation',
		source: parseSource(detail.source),
		order: detail.order,
		count: toCountOption(detail.count),
		sourceTitle: detail.sourceTitle || undefined,
		reportSaveMode: detail.saveMode,
		libraryId: meta?.libraryId,
		streamId: meta?.streamId,
		poolTotal: meta?.poolTotal,
		isRetryWrong: intent === 'retryWrong',
	};

	const flat = allReportItems(detail);
	const excludeKeys = [
		...new Set(flat.map((it) => it.itemKey).filter(Boolean)),
	];

	if (intent === 'retryWrong') {
		const seen = new Set<string>();
		const retryItems: PracticeItem[] = [];
		for (const it of flat) {
			if (it.correct || seen.has(it.itemKey)) continue;
			seen.add(it.itemKey);
			retryItems.push(reportItemToPracticeItem(it));
		}
		return {
			intent,
			config,
			excludeKeys,
			retryItems,
			// 与继续练习一样带回历轮/报告 id，重练就地改对后覆盖保存
			priorRounds: reportRoundsToSessionRounds(detail),
			reportId: detail.id,
		};
	}

	if (intent === 'continue') {
		return {
			intent,
			config,
			excludeKeys,
			priorRounds: reportRoundsToSessionRounds(detail),
			reportId: detail.id,
		};
	}

	return { intent, config, excludeKeys };
}

/** 报告 rounds → 会话 rounds（升序，便于接第 N+1 轮） */
export function reportRoundsToSessionRounds(
	detail: EnglishPracticeReportDetail,
): PracticeSessionRound[] {
	const fallbackAt = detail.createdAt || new Date().toISOString();
	const raw =
		detail.rounds && detail.rounds.length > 0
			? [...detail.rounds].sort((a, b) => a.roundIndex - b.roundIndex)
			: [
					{
						roundIndex: 1,
						completedAt: fallbackAt,
						items: detail.items ?? [],
					},
				];
	return raw.map((r) => ({
		roundIndex: r.roundIndex,
		completedAt: r.completedAt || fallbackAt,
		results: r.items.map((it) => ({
			item: reportItemToPracticeItem(it),
			userInput: it.userInput,
			correct: it.correct,
		})),
	}));
}

/** 旧报告无 rounds 时包成单轮，便于详情统一渲染 */
export function normalizeReportRounds(detail: EnglishPracticeReportDetail): {
	roundIndex: number;
	completedAt?: string;
	items: EnglishPracticeReportDetail['items'];
}[] {
	if (detail.rounds && detail.rounds.length > 0) {
		return [...detail.rounds].sort((a, b) => b.roundIndex - a.roundIndex);
	}
	return [
		{
			roundIndex: 1,
			completedAt: detail.createdAt,
			items: detail.items ?? [],
		},
	];
}
