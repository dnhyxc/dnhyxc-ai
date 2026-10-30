import type { EnglishLearningService } from '../../../english-learning/english-learning.service';
import type { ElProposalKind, ElProposalPayload } from './proposal.store';
import { fillFavoriteFields } from './propose-bodies';

export type ApplyStats = {
	domain: 'favorites' | 'mistakes';
	created: number;
	existed: number;
	failed: number;
	pairedCounts?: {
		vocabCreated: number;
		vocabExisted: number;
		classicCreated: number;
		classicExisted: number;
	};
};

function rowsOf(payload: ElProposalPayload): Record<string, unknown>[] {
	return payload.items?.length ? payload.items : [payload.body];
}

/** 消费提案后的落库。单条失败计入 failed，不回滚已写入。 */
export async function applyElProposal(
	learning: EnglishLearningService,
	userId: number,
	payload: ElProposalPayload,
): Promise<ApplyStats> {
	if (payload.kind === 'mistake_add') {
		const rows = rowsOf(payload);
		try {
			const r =
				payload.contentKind === 'vocab'
					? await learning.batchAddVocabularyMistakes(
							userId,
							rows as never,
							'agent',
						)
					: await learning.batchAddClassicQuoteMistakes(userId, rows as never);
			return {
				domain: 'mistakes',
				created: r.added,
				existed: r.updated + r.skipped,
				failed: 0,
			};
		} catch {
			return {
				domain: 'mistakes',
				created: 0,
				existed: 0,
				failed: rows.length,
			};
		}
	}
	if (payload.kind === 'favorite_remove') {
		const ids = payload.ids?.length
			? payload.ids
			: payload.id
				? [payload.id]
				: [];
		const pairedIds = (payload.paired?.items ?? [])
			.map((row) => (typeof row.id === 'string' ? row.id : ''))
			.filter((id) => id.length > 0);
		if (
			payload.paired?.contentKind === 'vocab' &&
			pairedIds.length &&
			payload.contentKind === 'classic'
		) {
			const vocabR = await learning.removeVocabularyFavoritesBatch(
				userId,
				pairedIds,
			);
			const classicR = ids.length
				? await learning.removeClassicQuoteFavoritesBatch(userId, ids)
				: { removedCount: 0 };
			return {
				domain: 'favorites',
				created: vocabR.removedCount + classicR.removedCount,
				existed:
					Math.max(0, pairedIds.length - vocabR.removedCount) +
					Math.max(0, ids.length - classicR.removedCount),
				failed: 0,
				pairedCounts: {
					vocabCreated: vocabR.removedCount,
					vocabExisted: Math.max(0, pairedIds.length - vocabR.removedCount),
					classicCreated: classicR.removedCount,
					classicExisted: Math.max(0, ids.length - classicR.removedCount),
				},
			};
		}
		if (!ids.length) {
			return { domain: 'favorites', created: 0, existed: 0, failed: 1 };
		}
		const r =
			payload.contentKind === 'vocab'
				? await learning.removeVocabularyFavoritesBatch(userId, ids)
				: await learning.removeClassicQuoteFavoritesBatch(userId, ids);
		return {
			domain: 'favorites',
			created: r.removedCount,
			existed: Math.max(0, ids.length - r.removedCount),
			failed: 0,
		};
	}
	if (payload.kind !== 'favorite_add') {
		return { domain: 'favorites', created: 0, existed: 0, failed: 1 };
	}
	const stats: ApplyStats = {
		domain: 'favorites',
		created: 0,
		existed: 0,
		failed: 0,
	};
	let vocabCreated = 0;
	let vocabExisted = 0;
	if (payload.paired?.items?.length && payload.paired.contentKind === 'vocab') {
		let vocabRows = payload.paired.items;
		const hints = new Map<string, string>();
		for (const row of vocabRows) {
			const key = String(row.word ?? '')
				.trim()
				.toLowerCase();
			const zh =
				typeof row.translationZh === 'string' ? row.translationZh.trim() : '';
			if (key && zh) hints.set(key, zh);
		}
		const snaps = await learning.lookupVocabularyLibrarySnapshots(
			userId,
			vocabRows.map((row) => String(row.word ?? '')),
			hints,
		);
		vocabRows = vocabRows.map((row) =>
			fillFavoriteFields(
				row,
				snaps.get(
					String(row.word ?? '')
						.trim()
						.toLowerCase(),
				),
			),
		);
		try {
			const r = await learning.batchAddVocabularyFavorites(
				userId,
				vocabRows as never,
			);
			vocabCreated = r.created;
			vocabExisted = r.existed;
			stats.created += r.created;
			stats.existed += r.existed;
		} catch {
			stats.failed += vocabRows.length;
		}
	}
	let rows = rowsOf(payload);
	if (payload.contentKind === 'vocab') {
		const hints = new Map<string, string>();
		for (const row of rows) {
			const key = String(row.word ?? '')
				.trim()
				.toLowerCase();
			const zh =
				typeof row.translationZh === 'string' ? row.translationZh.trim() : '';
			if (key && zh) hints.set(key, zh);
		}
		const snaps = await learning.lookupVocabularyLibrarySnapshots(
			userId,
			rows.map((row) => String(row.word ?? '')),
			hints,
		);
		rows = rows.map((row) =>
			fillFavoriteFields(
				row,
				snaps.get(
					String(row.word ?? '')
						.trim()
						.toLowerCase(),
				),
			),
		);
		try {
			const r = await learning.batchAddVocabularyFavorites(
				userId,
				rows as never,
			);
			stats.created = r.created;
			stats.existed = r.existed;
		} catch {
			stats.failed = rows.length;
		}
		return stats;
	}
	for (const row of rows) {
		try {
			const r = await learning.addClassicQuoteFavorite(userId, row as never);
			if (r.created) stats.created += 1;
			else stats.existed += 1;
		} catch {
			stats.failed += 1;
		}
	}
	if (payload.paired?.items?.length) {
		stats.pairedCounts = {
			vocabCreated,
			vocabExisted,
			classicCreated: stats.created - vocabCreated,
			classicExisted: stats.existed - vocabExisted,
		};
	}
	return stats;
}

/**
 * 确认回执。措辞与前端 `englishLearning.proposal.*` 一致，刷新后仍是这句话。
 */
export function proposalReceipt(
	lang: 'zh-CN' | 'en-US',
	kind: ElProposalKind,
	stats: ApplyStats,
	truncated: boolean,
	gaps?: Array<'cap' | 'list' | 'judge'>,
	contentKind?: 'vocab' | 'classic',
): string {
	const en = lang === 'en-US';
	let text: string;
	if (kind === 'favorite_remove') {
		text =
			stats.created > 0
				? en
					? `Removed ${stats.created} from favorites.`
					: `已取消收藏 ${stats.created} 个。`
				: en
					? 'That favorite was not found.'
					: '没有找到这条收藏。';
		if (stats.created > 0 && stats.existed > 0) {
			text += en
				? ` Not found: ${stats.existed}.`
				: `未找到 ${stats.existed} 个。`;
		}
	} else if (kind === 'mistake_add') {
		text = en
			? `Added ${stats.created} to mistakes. Already there: ${stats.existed}.`
			: `已加入错题 ${stats.created} 条，已在错题中 ${stats.existed} 条。`;
	} else {
		const unit =
			!en && contentKind === 'classic' && kind === 'favorite_add' ? '条' : '个';
		text = en
			? `Saved ${stats.created}. Already in favorites: ${stats.existed}.`
			: `已收藏 ${stats.created} ${unit}，已存在 ${stats.existed} ${unit}。`;
	}
	if (stats.failed > 0) {
		text += en ? ` Failed: ${stats.failed}.` : `失败 ${stats.failed} 个。`;
	}
	const reasons: Array<'cap' | 'list' | 'judge'> = gaps?.length
		? gaps
		: truncated
			? ['cap']
			: [];
	if (reasons.includes('cap')) {
		text += en ? ' The proposal was capped at 400.' : '提案已截断至 400 条。';
	}
	if (reasons.includes('list')) {
		text += en ? ' The list was not fully loaded.' : '清单未取尽。';
	}
	if (reasons.includes('judge')) {
		text += en ? ' Some batches were not judged.' : '有批未能判断。';
	}
	return text;
}

/** 词句同一条确认的回执。单类收藏仍走 proposalReceipt。 */
export function pairedFavoriteReceipt(
	lang: 'zh-CN' | 'en-US',
	counts: NonNullable<ApplyStats['pairedCounts']>,
	failed: number,
): string {
	const en = lang === 'en-US';
	let text = en
		? `Saved ${counts.vocabCreated} words and ${counts.classicCreated} sentences.`
		: `已收藏 ${counts.vocabCreated} 个词、${counts.classicCreated} 条语句。`;
	if (counts.vocabExisted > 0 || counts.classicExisted > 0) {
		text += en
			? ` Already in favorites: ${counts.vocabExisted} words, ${counts.classicExisted} sentences.`
			: `已存在 ${counts.vocabExisted} 个词、${counts.classicExisted} 条语句。`;
	}
	if (failed > 0) {
		text += en ? ` Failed: ${failed}.` : `失败 ${failed} 个。`;
	}
	return text;
}

/** 一条确认同时取消单词和语句。created 在这里是取消成功的条数。 */
export function pairedRemoveReceipt(
	lang: 'zh-CN' | 'en-US',
	counts: NonNullable<ApplyStats['pairedCounts']>,
): string {
	if (lang === 'en-US') {
		return `Removed ${counts.vocabCreated} words and ${counts.classicCreated} sentences from favorites.`;
	}
	return `已取消收藏 ${counts.vocabCreated} 个词、${counts.classicCreated} 条语句。`;
}
