/**
 * 英语学习：收藏记录（上下布局，顶栏标题 + 右侧分类切换）
 */
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useI18n } from '@/hooks';
import { EnglishLearningPanelHeader } from '../components/EnglishLearningPanelHeader';
import { ClassicQuotesFavoritesSection } from './classic';
import {
	type FavoritesKind,
	FavoritesKindTabs,
} from './components/FavoritesKindTabs';
import { VocabularyFavoritesSection } from './vocabulary';

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
					<EnglishLearningPanelHeader
						titleClassName="flex min-w-0 flex-1 items-center gap-2 overflow-hidden"
						title={
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
						}
						trailing={
							<FavoritesKindTabs kind={kind} onSelectKind={onSelectKind} />
						}
					/>
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
