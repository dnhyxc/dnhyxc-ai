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
	useState,
} from 'react';
import { useSearchParams } from 'react-router';
import { useI18n } from '@/hooks';
import {
	getEnglishClassicQuotesHistoryDetail,
	getEnglishVocabularyHistoryDetail,
} from '@/service';
import EnglishPackStore from '@/store/englishPack';
import { mergeEnglishPackWebSearchOrganics } from '@/utils/englishPackWebSearchMerge';
import { ClassicQuotesPackList } from './ClassicQuotesPackList';
import { type PackStreamKind, PackStreamKindTabs } from './PackStreamKindTabs';
import { PackStreamProgress } from './PackStreamProgress';
import { useClassicQuotesPackHistoryList } from './useClassicQuotesPackHistoryList';
import { useVocabularyPackHistoryList } from './useVocabularyPackHistoryList';
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
	const historyStreamId = useMemo(
		() => searchParams.get('streamId')?.trim() || null,
		[searchParams],
	);
	const [historyItemCount, setHistoryItemCount] = useState<number | null>(null);

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

	useEffect(() => {
		const sid = historyStreamId;
		if (!sid) {
			setHistoryItemCount(null);
			return;
		}
		let cancelled = false;
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
					return;
				}
				const organic = mergeEnglishPackWebSearchOrganics(d.webSearchRounds);
				if (kind === 'vocab') {
					EnglishPackStore.vocabPrepareHistoryView(d.topic, organic);
				} else {
					EnglishPackStore.classicPrepareHistoryView(d.topic, organic);
				}
				setHistoryItemCount(d.itemCount ?? 0);
			} catch {
				if (!cancelled) setHistoryItemCount(0);
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
	const vocabHistory = useVocabularyPackHistoryList(
		isHistoryView && kind === 'vocab' ? historyStreamId : null,
	);
	const classicHistory = useClassicQuotesPackHistoryList(
		isHistoryView && kind === 'classic' ? historyStreamId : null,
	);
	const onHistoryViewportScroll: UIEventHandler<HTMLDivElement> | undefined =
		isHistoryView
			? kind === 'vocab'
				? vocabHistory.onViewportScroll
				: classicHistory.onViewportScroll
			: undefined;
	const itemCount = isHistoryView
		? (historyItemCount ?? liveItemCount)
		: liveItemCount;
	const historyMetaPending = isHistoryView && historyItemCount === null;

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
		isHistoryView && activeHistory.loading && activeHistory.items.length === 0;
	const showPageLoading =
		isHistoryView && (historyMetaPending || historyListLoading);
	const historyLoadingText =
		kind === 'vocab'
			? t('englishLearning.vocab.historyLoading')
			: t('englishLearning.classic.historyLoading');

	const showEmpty =
		!showPageLoading &&
		!loading &&
		!activeHistory.loading &&
		itemCount === 0 &&
		(!isHistoryView || historyItemCount === 0);

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

					{showPageLoading ? (
						<div className="text-textcolor/60 flex min-h-0 flex-1 items-center justify-center px-4 text-center text-sm">
							<Loading text={historyLoadingText} />
						</div>
					) : (
						<ScrollArea
							className="min-h-0 flex-1 pb-4"
							onScroll={onHistoryViewportScroll}
						>
							<div className="space-y-5 px-4 pt-2.5">
								{!isHistoryView ? <PackStreamProgress kind={kind} /> : null}

								{kind === 'vocab' ? (
									<VocabularyPackList
										history={isHistoryView ? vocabHistory : null}
									/>
								) : (
									<ClassicQuotesPackList
										history={isHistoryView ? classicHistory : null}
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
