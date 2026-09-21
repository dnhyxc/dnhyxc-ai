/**
 * 英语学习：今日复习列表（单词 / 语句）
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useI18n } from '@/hooks';
import {
	englishPracticePoolKeys,
	setEnglishPracticePoolMeta,
} from '@/store/englishPracticePool';
import { ClassicQuoteMistakesPanel } from '../mistakes/classic/ClassicQuoteMistakesPanel';
import {
	type MistakesKind,
	MistakesKindTabs,
} from '../mistakes/components/MistakesKindTabs';
import { VocabularyMistakesPanel } from '../mistakes/vocabulary/VocabularyMistakesPanel';

export type ReviewListCounts = {
	loaded: number;
	total: number;
};

function parseKind(raw: string | null): MistakesKind {
	return raw === 'classic' ? 'classic' : 'vocab';
}

function reviewPagePath(kind: MistakesKind): string {
	return kind === 'classic'
		? '/english-learning/review?kind=classic'
		: '/english-learning/review?kind=vocab';
}

export default function EnglishLearningReviewPage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const kind = useMemo(
		() => parseKind(searchParams.get('kind')),
		[searchParams],
	);

	const [vocabCounts, setVocabCounts] = useState<ReviewListCounts>({
		loaded: 0,
		total: 0,
	});
	const [classicCounts, setClassicCounts] = useState<ReviewListCounts>({
		loaded: 0,
		total: 0,
	});

	const onSelectKind = useCallback(
		(next: MistakesKind) => {
			navigate(reviewPagePath(next), { replace: true });
		},
		[navigate],
	);

	const title =
		kind === 'vocab'
			? t('englishLearning.review.vocabTab')
			: t('englishLearning.review.classicTab');
	const counts = kind === 'vocab' ? vocabCounts : classicCounts;
	const countType = kind === 'vocab' ? t('common.type-1') : t('common.type-2');

	const headerTitle = (
		<>
			<span className="min-w-0 truncate" title={title}>
				{title}
			</span>
			<span className="text-textcolor/50 shrink-0 whitespace-nowrap text-sm font-normal">
				{t('englishLearning.library.listCount', {
					count: counts.total,
					type: countType,
				})}{' '}
				/{' '}
				{t('common.loaded', {
					count: counts.loaded,
					type: countType,
				})}
			</span>
		</>
	);

	const headerTrailing = (
		<MistakesKindTabs
			kind={kind}
			onSelectKind={onSelectKind}
			vocabLabel={t('englishLearning.review.vocabTab')}
			classicLabel={t('englishLearning.review.classicTab')}
			ariaLabel={t('route.englishLearning.review.title')}
		/>
	);

	useEffect(() => {
		if (counts.total <= 0) return;
		setEnglishPracticePoolMeta(englishPracticePoolKeys.review(kind), {
			total: counts.total,
			title:
				kind === 'classic'
					? t('englishLearning.practice.sourceClassicReview')
					: t('englishLearning.practice.sourceReview'),
		});
	}, [counts.total, kind, t]);

	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5.5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
					{kind === 'vocab' ? (
						<VocabularyMistakesPanel
							active
							listMode="review"
							headerTitle={headerTitle}
							headerTrailing={headerTrailing}
							onCountsChange={setVocabCounts}
						/>
					) : (
						<ClassicQuoteMistakesPanel
							active
							listMode="review"
							headerTitle={headerTitle}
							headerTrailing={headerTrailing}
							onCountsChange={setClassicCounts}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
