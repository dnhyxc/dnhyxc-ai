/**
 * 英语学习：错题集（单词 / 语句）
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useI18n } from '@/hooks';
import { flushElFixedListResume } from '@/store/englishLearningResume';
import {
	englishPracticePoolKeys,
	setEnglishPracticePoolMeta,
} from '@/store/englishPracticePool';
import { ClassicQuoteMistakesPanel } from './classic/ClassicQuoteMistakesPanel';
import {
	type MistakesKind,
	MistakesKindTabs,
} from './components/MistakesKindTabs';
import { VocabularyMistakesPanel } from './vocabulary/VocabularyMistakesPanel';

export type MistakesListCounts = {
	loaded: number;
	total: number;
};

function parseKind(pathname: string, raw: string | null): MistakesKind {
	if (pathname.endsWith('/mistakes/classic')) return 'classic';
	return raw === 'classic' ? 'classic' : 'vocab';
}

function mistakesPagePath(kind: MistakesKind): string {
	return kind === 'classic'
		? '/english-learning/mistakes?kind=classic'
		: '/english-learning/mistakes?kind=vocab';
}

export default function EnglishLearningMistakesPage() {
	const { t } = useI18n();
	const location = useLocation();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const kind = useMemo(
		() => parseKind(location.pathname, searchParams.get('kind')),
		[location.pathname, searchParams],
	);

	const [vocabCounts, setVocabCounts] = useState<MistakesListCounts>({
		loaded: 0,
		total: 0,
	});
	const [classicCounts, setClassicCounts] = useState<MistakesListCounts>({
		loaded: 0,
		total: 0,
	});

	useEffect(() => {
		if (!location.pathname.endsWith('/mistakes/classic')) return;
		navigate(mistakesPagePath('classic'), { replace: true });
	}, [location.pathname, navigate]);

	const onSelectKind = useCallback(
		(next: MistakesKind) => {
			navigate(mistakesPagePath(next), { replace: true });
		},
		[navigate],
	);

	const title =
		kind === 'vocab'
			? t('englishLearning.mistakes.vocabNav')
			: t('englishLearning.mistakes.classicNav');
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
		<MistakesKindTabs kind={kind} onSelectKind={onSelectKind} />
	);

	useEffect(() => {
		if (counts.total <= 0) return;
		setEnglishPracticePoolMeta(englishPracticePoolKeys.mistakes(kind), {
			total: counts.total,
			title:
				kind === 'classic'
					? t('englishLearning.practice.sourceClassicMistakes')
					: t('englishLearning.practice.sourceMistakes'),
		});
	}, [counts.total, kind, t]);

	useEffect(() => {
		const flushAll = () => {
			flushElFixedListResume('vocab-mistakes', {
				keepalive: true,
			});
			flushElFixedListResume('classic-mistakes', {
				keepalive: true,
			});
		};
		const onPageHide = () => flushAll();
		const onVisibility = () => {
			if (document.visibilityState === 'hidden') flushAll();
		};
		window.addEventListener('pagehide', onPageHide);
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			window.removeEventListener('pagehide', onPageHide);
			document.removeEventListener('visibilitychange', onVisibility);
			flushAll();
		};
	}, []);

	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5.5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
					{kind === 'vocab' ? (
						<VocabularyMistakesPanel
							active
							headerTitle={headerTitle}
							headerTrailing={headerTrailing}
							onCountsChange={setVocabCounts}
						/>
					) : (
						<ClassicQuoteMistakesPanel
							active
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
