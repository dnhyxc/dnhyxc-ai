/**
 * 英语学习：单词 / 经典句拉取结果（独立路由，MobX 实时同步；历史带 streamId 分页）
 */
import Loading from '@design/Loading';
import { ScrollArea } from '@ui/index';
import { observer } from 'mobx-react';
import { type UIEventHandler, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useI18n } from '@/hooks';
import {
	getEnglishClassicQuotesHistoryDetail,
	getEnglishVocabularyHistoryDetail,
} from '@/service';
import EnglishPackStore from '@/store/englishPack';
import type { SearchOrganicItem } from '@/types/chat';
import { mergeEnglishPackWebSearchOrganics } from '@/utils/englishPackWebSearchMerge';
import { MasterWebSearchResultsBar } from '../shared/WebSearchResultsBar';
import { ClassicQuotesPackList } from './ClassicQuotesPackList';
import type { PackStreamKind } from './PackStreamKindTabs';
import { PackStreamProgress } from './PackStreamProgress';
import { useClassicQuotesPackHistoryList } from './useClassicQuotesPackHistoryList';
import { useVocabularyPackHistoryList } from './useVocabularyPackHistoryList';
import { VocabularyPackList } from './VocabularyPackList';

function parseKind(raw: string | null): PackStreamKind {
	return raw === 'classic' ? 'classic' : 'vocab';
}

function EnglishLearningPackStreamPageInner() {
	const { t } = useI18n();
	const [searchParams] = useSearchParams();
	const kind = useMemo(
		() => parseKind(searchParams.get('kind')),
		[searchParams],
	);
	const historyStreamId = useMemo(
		() => searchParams.get('streamId')?.trim() || null,
		[searchParams],
	);
	const [historyItemCount, setHistoryItemCount] = useState<number | null>(null);
	const [historyHeader, setHistoryHeader] = useState<{
		topic: string;
		organic: SearchOrganicItem[];
	} | null>(null);

	useEffect(() => {
		const sid = historyStreamId;
		if (!sid) {
			setHistoryItemCount(null);
			setHistoryHeader(null);
			return;
		}
		let cancelled = false;
		if (kind === 'vocab') {
			EnglishPackStore.vocabEnterHistoryView(sid);
		} else {
			EnglishPackStore.classicEnterHistoryView(sid);
		}
		void (async () => {
			try {
				const res =
					kind === 'vocab'
						? await getEnglishVocabularyHistoryDetail(sid)
						: await getEnglishClassicQuotesHistoryDetail(sid);
				if (cancelled) return;
				const d = res.data;
				if (!d) {
					setHistoryItemCount(0);
					setHistoryHeader({ topic: '', organic: [] });
					return;
				}
				setHistoryHeader({
					topic: d.topic?.trim() ?? '',
					organic: mergeEnglishPackWebSearchOrganics(d.webSearchRounds),
				});
				setHistoryItemCount(d.itemCount ?? 0);
			} catch {
				if (!cancelled) {
					setHistoryItemCount(0);
					setHistoryHeader({ topic: '', organic: [] });
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [historyStreamId, kind]);

	const loading =
		kind === 'vocab'
			? EnglishPackStore.vocabLoading
			: EnglishPackStore.classicLoading;
	const liveItemCount =
		kind === 'vocab'
			? EnglishPackStore.vocabItems.length
			: EnglishPackStore.classicItems.length;
	const isHistoryView = Boolean(historyStreamId);
	const isLiveStreamView =
		kind === 'vocab'
			? EnglishPackStore.isVocabLiveStreamView(historyStreamId)
			: EnglishPackStore.isClassicLiveStreamView(historyStreamId);
	const useHistoryPagination = isHistoryView && !isLiveStreamView;
	const vocabHistory = useVocabularyPackHistoryList(
		useHistoryPagination && kind === 'vocab' ? historyStreamId : null,
	);
	const classicHistory = useClassicQuotesPackHistoryList(
		useHistoryPagination && kind === 'classic' ? historyStreamId : null,
	);
	const onHistoryViewportScroll: UIEventHandler<HTMLDivElement> | undefined =
		useHistoryPagination
			? kind === 'vocab'
				? vocabHistory.onViewportScroll
				: classicHistory.onViewportScroll
			: undefined;
	const itemCount =
		isLiveStreamView || !isHistoryView
			? liveItemCount
			: (historyItemCount ?? liveItemCount);
	const historyMetaPending = useHistoryPagination && historyItemCount === null;

	const title =
		kind === 'vocab'
			? t('englishLearning.stream.vocab.pageTitle')
			: t('englishLearning.stream.classic.pageTitle');

	const emptyHint =
		kind === 'vocab'
			? t('englishLearning.stream.vocab.empty')
			: t('englishLearning.stream.classic.empty');

	const activeHistory = kind === 'vocab' ? vocabHistory : classicHistory;
	const historyListLoading =
		useHistoryPagination &&
		activeHistory.loading &&
		activeHistory.items.length === 0;
	const showPageLoading =
		useHistoryPagination && (historyMetaPending || historyListLoading);
	const historyLoadingText =
		kind === 'vocab'
			? t('englishLearning.vocab.historyLoading')
			: t('englishLearning.classic.historyLoading');

	const showEmpty =
		!showPageLoading &&
		!loading &&
		!(useHistoryPagination && activeHistory.loading) &&
		itemCount === 0 &&
		(!useHistoryPagination || historyItemCount === 0);

	const topic =
		isLiveStreamView || !isHistoryView
			? kind === 'vocab'
				? EnglishPackStore.vocabTopic.trim()
				: EnglishPackStore.classicTopic.trim()
			: (historyHeader?.topic ?? '');
	const masterSearchOrganic =
		isLiveStreamView || !isHistoryView
			? kind === 'vocab'
				? EnglishPackStore.vocabMasterSearchOrganic
				: EnglishPackStore.classicMasterSearchOrganic
			: (historyHeader?.organic ?? []);

	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
					<header className="h-13.5 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-theme/10 px-4.5 py-3.5">
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
						{topic || masterSearchOrganic.length > 0 ? (
							<div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-textcolor/45 text-sm font-medium">
								{masterSearchOrganic.length > 0 ? (
									<MasterWebSearchResultsBar
										items={masterSearchOrganic}
										t={t}
									/>
								) : null}
								{topic ? (
									<p className="text-textcolor/80 max-w-md truncate leading-snug">
										{t('englishLearning.stream.topicLabel')}: {topic}
									</p>
								) : null}
							</div>
						) : null}
					</header>

					{showPageLoading ? (
						<div className="text-textcolor/60 flex min-h-0 flex-1 items-center justify-center px-4 text-center text-sm">
							<Loading text={historyLoadingText} />
						</div>
					) : (
						<ScrollArea
							className="min-h-0 flex-1 pb-4"
							onScroll={onHistoryViewportScroll}
						>
							<div className="space-y-5 px-4 pt-4">
								{isLiveStreamView || !isHistoryView ? (
									<PackStreamProgress kind={kind} />
								) : null}

								{kind === 'vocab' ? (
									<VocabularyPackList
										history={useHistoryPagination ? vocabHistory : null}
									/>
								) : (
									<ClassicQuotesPackList
										history={useHistoryPagination ? classicHistory : null}
									/>
								)}

								{showEmpty ? (
									<div className="text-textcolor/45 rounded-md border border-dashed border-theme/15 bg-theme/5 px-4 py-10 text-center text-sm leading-relaxed">
										{emptyHint}
									</div>
								) : null}
							</div>
						</ScrollArea>
					)}
				</div>
			</div>
		</div>
	);
}

const EnglishLearningPackStreamPage = observer(
	EnglishLearningPackStreamPageInner,
);
export default EnglishLearningPackStreamPage;
