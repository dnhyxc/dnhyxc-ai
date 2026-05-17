/**
 * 英语学习：单词 / 经典句拉取结果（独立路由，MobX 实时同步）
 */
import { ScrollArea } from '@ui/index';
import { observer } from 'mobx-react';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useI18n } from '@/hooks';
import EnglishPackStore from '@/store/englishPack';
import { ClassicQuotesPackList } from './ClassicQuotesPackList';
import { type PackStreamKind, PackStreamKindTabs } from './PackStreamKindTabs';
import { PackStreamProgress } from './PackStreamProgress';
import { VocabularyPackList } from './VocabularyPackList';

function parseKind(raw: string | null): PackStreamKind {
	return raw === 'classic' ? 'classic' : 'vocab';
}

function EnglishLearningPackStreamPageInner() {
	const { t } = useI18n();
	const [searchParams, setSearchParams] = useSearchParams();
	const kind = useMemo(
		() => parseKind(searchParams.get('kind')),
		[searchParams],
	);

	const onSelectKind = useCallback(
		(next: PackStreamKind) => {
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

	const loading =
		kind === 'vocab'
			? EnglishPackStore.vocabLoading
			: EnglishPackStore.classicLoading;
	const itemCount =
		kind === 'vocab'
			? EnglishPackStore.vocabItems.length
			: EnglishPackStore.classicItems.length;

	const title =
		kind === 'vocab'
			? t('englishLearning.stream.vocab.pageTitle')
			: t('englishLearning.stream.classic.pageTitle');

	const emptyHint =
		kind === 'vocab'
			? t('englishLearning.stream.vocab.empty')
			: t('englishLearning.stream.classic.empty');

	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
					<header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-theme/10 px-4.5 py-2">
						<div className="flex min-w-0 items-center gap-2">
							<h1 className="text-textcolor min-w-0 truncate text-base font-semibold">
								{title}
								{itemCount > 0 ? (
									<span className="text-textcolor/50 ml-1.5 text-sm font-medium">
										（{itemCount}）
									</span>
								) : null}
							</h1>
						</div>
						<PackStreamKindTabs kind={kind} onSelectKind={onSelectKind} />
					</header>

					<ScrollArea className="min-h-0 flex-1 pb-4">
						<div className="space-y-5 px-4 pt-2.5">
							<PackStreamProgress kind={kind} />

							{kind === 'vocab' ? (
								<VocabularyPackList />
							) : (
								<ClassicQuotesPackList />
							)}

							{!loading && itemCount === 0 ? (
								<div className="text-textcolor/45 rounded-md border border-dashed border-theme/15 bg-theme/5 px-4 py-10 text-center text-sm leading-relaxed">
									{emptyHint}
								</div>
							) : null}
						</div>
					</ScrollArea>
				</div>
			</div>
		</div>
	);
}

const EnglishLearningPackStreamPage = observer(
	EnglishLearningPackStreamPageInner,
);
export default EnglishLearningPackStreamPage;
