/**
 * 英语学习：单词 / 经典句拉取结果（独立路由，MobX 实时同步；历史带 streamId 分页）
 */
import Loading from '@design/Loading';
import { ScrollArea } from '@ui/index';
import { observer } from 'mobx-react';
import {
	type UIEventHandler,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useSearchParams } from 'react-router';
import { useI18n } from '@/hooks';
import {
	getEnglishClassicQuotesHistoryDetail,
	getEnglishVocabularyHistoryDetail,
} from '@/service';
import EnglishPackStore from '@/store/englishPack';
import {
	englishPracticePoolKeys,
	setEnglishPracticePoolMeta,
} from '@/store/englishPracticePool';
import type { SearchOrganicItem } from '@/types/chat';
import { mergeEnglishPackWebSearchOrganics } from '@/utils/englishPackWebSearchMerge';
import { EnglishPracticeEntry } from '../shared/practiceEntry';
import { MasterWebSearchResultsBar } from '../shared/WebSearchResultsBar';
import { ClassicQuotesPackList } from './ClassicQuotesPackList';
import { PackStreamHistoryDrawerTrigger } from './PackStreamHistoryDrawerTrigger';
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

	const fetchHistoryMeta = useCallback(
		async (sid: string) => {
			const res =
				kind === 'vocab'
					? await getEnglishVocabularyHistoryDetail(sid)
					: await getEnglishClassicQuotesHistoryDetail(sid);
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
		},
		[kind],
	);

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
				await fetchHistoryMeta(sid);
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
	}, [historyStreamId, fetchHistoryMeta, kind]);

	const loading =
		kind === 'vocab'
			? EnglishPackStore.vocabLoading
			: EnglishPackStore.classicLoading;
	const prevLoadingRef = useRef(loading);

	// 拉取从 true→false 时刷新 meta（web_search 已落库），避免页头仍用空的 historyHeader
	useEffect(() => {
		const wasLoading = prevLoadingRef.current;
		prevLoadingRef.current = loading;
		const sid = historyStreamId;
		if (!sid || !wasLoading || loading) return;
		let cancelled = false;
		void (async () => {
			try {
				await fetchHistoryMeta(sid);
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
	}, [historyStreamId, fetchHistoryMeta, loading]);

	const liveItemCount =
		kind === 'vocab'
			? EnglishPackStore.vocabItems.length
			: EnglishPackStore.classicItems.length;
	const isHistoryView = Boolean(historyStreamId);
	const isLiveStreamView =
		kind === 'vocab'
			? EnglishPackStore.isVocabLiveStreamView(historyStreamId)
			: EnglishPackStore.isClassicLiveStreamView(historyStreamId);
	// 停止后 Store 无词条但服务端已落库时，仍走历史分页（避免仅因 organic 占住「直播」却不拉列表）
	const useHistoryPagination =
		isHistoryView && (!isLiveStreamView || (liveItemCount === 0 && !loading));
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
	const activeHistory = kind === 'vocab' ? vocabHistory : classicHistory;
	const itemCount = useHistoryPagination
		? (historyItemCount ?? activeHistory.itemCount ?? 0)
		: liveItemCount;
	const loadedCount = useHistoryPagination
		? activeHistory.items.length
		: liveItemCount;
	const loadedCountType =
		kind === 'vocab' ? t('common.type-1') : t('common.type-2');
	const historyMetaPending = useHistoryPagination && historyItemCount === null;

	const emptyHint =
		kind === 'vocab'
			? t('englishLearning.stream.vocab.empty')
			: t('englishLearning.stream.classic.empty');

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

	const liveTopic =
		kind === 'vocab'
			? EnglishPackStore.vocabTopic.trim()
			: EnglishPackStore.classicTopic.trim();
	const liveOrganic =
		kind === 'vocab'
			? EnglishPackStore.vocabMasterSearchOrganic
			: EnglishPackStore.classicMasterSearchOrganic;
	const historyTopic = historyHeader?.topic ?? '';
	const historyOrganic = historyHeader?.organic ?? [];
	const sameActiveSession = Boolean(
		historyStreamId &&
			(kind === 'vocab'
				? EnglishPackStore.vocabActiveStreamId === historyStreamId
				: EnglishPackStore.classicActiveStreamId === historyStreamId),
	);
	// 停止拉取后 Store 仍可能保留本轮 organic；与 isLiveStreamView 一起决定页头数据源
	const preferStoreHeader =
		isLiveStreamView ||
		!isHistoryView ||
		(sameActiveSession && (liveOrganic.length > 0 || liveTopic.length > 0));
	const topic = preferStoreHeader ? liveTopic : historyTopic;
	const masterSearchOrganic = preferStoreHeader ? liveOrganic : historyOrganic;
	const practiceSourceTitle = topic.trim() || undefined;

	useEffect(() => {
		if (itemCount <= 0) return;
		if (isHistoryView && historyStreamId) {
			setEnglishPracticePoolMeta(
				englishPracticePoolKeys.pack(historyStreamId, kind),
				{
					total: itemCount,
					title: practiceSourceTitle,
				},
			);
		} else if (!isHistoryView) {
			setEnglishPracticePoolMeta(englishPracticePoolKeys.live(kind), {
				total: itemCount,
				title: practiceSourceTitle,
			});
		}
	}, [kind, itemCount, isHistoryView, historyStreamId, practiceSourceTitle]);

	const packPracticeParams = useMemo(() => {
		if (loadedCount <= 0) return null;
		if (isHistoryView && historyStreamId) {
			return {
				contentKind: kind,
				source: 'pack' as const,
				streamId: historyStreamId,
				sourceTitle: practiceSourceTitle,
				poolTotal: itemCount > 0 ? itemCount : undefined,
			};
		}
		return {
			contentKind: kind,
			source: 'live' as const,
			sourceTitle: practiceSourceTitle,
			poolTotal: itemCount > 0 ? itemCount : undefined,
		};
	}, [
		historyStreamId,
		isHistoryView,
		itemCount,
		kind,
		loadedCount,
		practiceSourceTitle,
	]);

	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5.5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
					<header className="h-12 flex shrink-0 items-center justify-between gap-3 border-b border-theme/10 px-4.5 py-3.5">
						<div className="flex min-w-0 flex-1 flex-wrap items-center gap-4 text-textcolor/45 font-medium">
							{topic ? (
								<p className="text-textcolor/80 max-w-md truncate leading-snug flex items-center gap-2">
									{t('englishLearning.stream.topicLabel')}: {topic}
									<span className="text-textcolor/50 text-sm">
										{t('englishLearning.library.listCount', {
											count: itemCount,
											type:
												kind === 'vocab'
													? t('common.type-1')
													: t('common.type-2'),
										})}{' '}
										/{' '}
										{t('common.loaded', {
											count: loadedCount,
											type: loadedCountType,
										})}
									</span>
								</p>
							) : null}
						</div>
						<div className="flex items-center gap-3">
							{masterSearchOrganic.length > 0 ? (
								<MasterWebSearchResultsBar items={masterSearchOrganic} t={t} />
							) : null}
							<div className="flex shrink-0 items-center gap-3">
								{packPracticeParams ? (
									<EnglishPracticeEntry
										variant="text"
										className="shrink-0 gap-1.5 whitespace-nowrap font-medium"
										practice={packPracticeParams}
									/>
								) : null}
								<PackStreamHistoryDrawerTrigger
									kind={kind}
									loadedStreamId={historyStreamId}
								/>
							</div>
						</div>
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
