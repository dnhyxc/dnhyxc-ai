/**
 * 英语学习：收藏记录（上下布局，顶栏标题 + 右侧分类切换）
 */
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useI18n } from '@/hooks';
import { ClassicQuotesFavoritesSection } from './ClassicQuotesFavoritesSection';
import { type FavoritesKind, FavoritesKindTabs } from './FavoritesKindTabs';
import { VocabularyFavoritesSection } from './VocabularyFavoritesSection';

function parseKind(raw: string | null): FavoritesKind {
	return raw === 'classic' ? 'classic' : 'vocab';
}

export default function EnglishLearningFavoritesPage() {
	const { t } = useI18n();
	const [searchParams, setSearchParams] = useSearchParams();
	const kind = useMemo(
		() => parseKind(searchParams.get('kind')),
		[searchParams],
	);
	const [vocabCounts, setVocabCounts] = useState<{
		loaded: number;
		total: number;
	}>({ loaded: 0, total: 0 });
	const [classicCounts, setClassicCounts] = useState<{
		loaded: number;
		total: number;
	}>({ loaded: 0, total: 0 });

	const onSelectKind = useCallback(
		(next: FavoritesKind) => {
			setSearchParams(
				(prev) => {
					const params = new URLSearchParams(prev);
					params.set('kind', next);
					return params;
				},
				{ replace: true },
			);
		},
		[setSearchParams],
	);

	const title =
		kind === 'vocab'
			? t('englishLearning.vocab.favoritesTitle')
			: t('englishLearning.classic.favoritesTitle');
	const counts = kind === 'vocab' ? vocabCounts : classicCounts;
	const countType = kind === 'vocab' ? t('common.type-1') : t('common.type-2');

	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5.5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
					<header className="h-12 flex shrink-0 items-center justify-between gap-4 px-4.5 py-2">
						<h2 className="text-textcolor min-w-0 text-base font-semibold flex items-center gap-2">
							{title}
							<span className="text-textcolor/50 ml-1 text-sm font-normal">
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
						</h2>
						<FavoritesKindTabs kind={kind} onSelectKind={onSelectKind} />
					</header>
					<section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
						{kind === 'vocab' ? (
							<VocabularyFavoritesSection
								active
								onCountsChange={setVocabCounts}
							/>
						) : (
							<ClassicQuotesFavoritesSection
								active
								onCountsChange={setClassicCounts}
							/>
						)}
					</section>
				</div>
			</div>
		</div>
	);
}
