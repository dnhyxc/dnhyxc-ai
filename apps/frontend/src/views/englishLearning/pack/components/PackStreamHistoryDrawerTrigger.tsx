/**
 * 拉取结果页 / 侧栏：按 kind 打开单词或经典句历史抽屉
 */
import Confirm from '@design/Confirm';
import { Toast } from '@ui/index';
import { History } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type UIEventHandler,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
	HISTORY_PAGE_SIZE,
	SCROLL_LOAD_THRESHOLD_PX,
	VOCAB_HISTORY_PAGE_SIZE,
} from '@/constant';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type {
	EnglishClassicQuoteHistoryEntry,
	EnglishVocabularyHistoryEntry,
} from '@/service';
import {
	deleteEnglishClassicQuotesPackHistory,
	deleteEnglishVocabularyPackHistory,
	listEnglishClassicQuotesHistory,
	listEnglishVocabularyHistory,
} from '@/service';
import EnglishPackStore from '@/store/englishPack';
import { ClassicQuotesHistoryDrawer } from '../../sections/classic/ClassicQuotesHistoryDrawer';
import { VocabularyHistoryDrawer } from '../../sections/vocabulary/VocabularyHistoryDrawer';
import type { PackStreamKind } from '../types';

export type PackStreamHistoryDrawerTriggerProps = {
	kind: PackStreamKind;
	/** 当前结果页 streamId，用于抽屉内高亮 */
	loadedStreamId?: string | null;
	className?: string;
};

function PackStreamHistoryDrawerTriggerInner({
	kind,
	loadedStreamId = null,
	className,
}: PackStreamHistoryDrawerTriggerProps) {
	const { t } = useI18n();
	const navigate = useNavigate();
	const location = useLocation();
	const isVocab = kind === 'vocab';

	const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
	const [vocabEntries, setVocabEntries] = useState<
		EnglishVocabularyHistoryEntry[]
	>([]);
	const [classicEntries, setClassicEntries] = useState<
		EnglishClassicQuoteHistoryEntry[]
	>([]);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
	const [drawerLoadedStreamId, setDrawerLoadedStreamId] = useState<
		string | null
	>(null);
	const [historyDeleteTarget, setHistoryDeleteTarget] = useState<
		EnglishVocabularyHistoryEntry | EnglishClassicQuoteHistoryEntry | null
	>(null);
	const [historyDeleteConfirmOpen, setHistoryDeleteConfirmOpen] =
		useState(false);
	const [deletingHistoryStreamId, setDeletingHistoryStreamId] = useState<
		string | null
	>(null);

	const historyOffsetRef = useRef(0);
	const historyHasMoreRef = useRef(true);
	const historyFetchingMoreRef = useRef(false);

	const pageSize = isVocab ? VOCAB_HISTORY_PAGE_SIZE : HISTORY_PAGE_SIZE;
	const openDrawerLabel = isVocab
		? t('englishLearning.vocab.historyOpenDrawer')
		: t('englishLearning.classic.historyOpenDrawer');

	const fetchHistoryFirstPage = useCallback(async () => {
		historyFetchingMoreRef.current = false;
		setHistoryLoading(true);
		setHistoryLoadingMore(false);
		historyOffsetRef.current = 0;
		historyHasMoreRef.current = true;
		if (isVocab) {
			setVocabEntries([]);
		} else {
			setClassicEntries([]);
		}
		try {
			const res = isVocab
				? await listEnglishVocabularyHistory({ limit: pageSize, offset: 0 })
				: await listEnglishClassicQuotesHistory({ limit: pageSize, offset: 0 });
			const list = Array.isArray(res.data) ? res.data : [];
			if (isVocab) {
				setVocabEntries(list as EnglishVocabularyHistoryEntry[]);
			} else {
				setClassicEntries(list as EnglishClassicQuoteHistoryEntry[]);
			}
			historyOffsetRef.current = list.length;
			historyHasMoreRef.current = list.length >= pageSize;
		} catch {
			if (isVocab) {
				setVocabEntries([]);
			} else {
				setClassicEntries([]);
			}
			historyHasMoreRef.current = false;
		} finally {
			setHistoryLoading(false);
		}
	}, [isVocab, pageSize]);

	const fetchHistoryMore = useCallback(async () => {
		if (
			!historyHasMoreRef.current ||
			historyFetchingMoreRef.current ||
			historyLoading
		) {
			return;
		}
		historyFetchingMoreRef.current = true;
		setHistoryLoadingMore(true);
		const offset = historyOffsetRef.current;
		try {
			const res = isVocab
				? await listEnglishVocabularyHistory({ limit: pageSize, offset })
				: await listEnglishClassicQuotesHistory({ limit: pageSize, offset });
			const chunk = Array.isArray(res.data) ? res.data : [];
			if (chunk.length === 0) {
				historyHasMoreRef.current = false;
				return;
			}
			if (isVocab) {
				setVocabEntries((prev) => [
					...prev,
					...(chunk as EnglishVocabularyHistoryEntry[]),
				]);
			} else {
				setClassicEntries((prev) => [
					...prev,
					...(chunk as EnglishClassicQuoteHistoryEntry[]),
				]);
			}
			historyOffsetRef.current += chunk.length;
			historyHasMoreRef.current = chunk.length >= pageSize;
		} catch {
			historyHasMoreRef.current = false;
		} finally {
			historyFetchingMoreRef.current = false;
			setHistoryLoadingMore(false);
		}
	}, [historyLoading, isVocab, pageSize]);

	useEffect(() => {
		if (!historyDrawerOpen) return;
		void fetchHistoryFirstPage();
	}, [historyDrawerOpen, fetchHistoryFirstPage]);

	useEffect(() => {
		setDrawerLoadedStreamId(loadedStreamId?.trim() || null);
	}, [loadedStreamId]);

	const onHistoryViewportScroll = useCallback<UIEventHandler<HTMLDivElement>>(
		(e) => {
			const el = e.currentTarget;
			const rest = el.scrollHeight - el.scrollTop - el.clientHeight;
			if (rest < SCROLL_LOAD_THRESHOLD_PX) {
				void fetchHistoryMore();
			}
		},
		[fetchHistoryMore],
	);

	const openHistoryDetail = useCallback(
		(streamId: string) => {
			setDrawerLoadedStreamId(streamId);
			setHistoryDrawerOpen(false);
			navigate(
				`/english-learning/stream?kind=${kind}&streamId=${encodeURIComponent(streamId)}`,
			);
		},
		[kind, navigate],
	);

	const requestDeleteVocab = useCallback(
		(entry: EnglishVocabularyHistoryEntry) => {
			setHistoryDeleteTarget(entry);
			setHistoryDeleteConfirmOpen(true);
		},
		[],
	);

	const requestDeleteClassic = useCallback(
		(entry: EnglishClassicQuoteHistoryEntry) => {
			setHistoryDeleteTarget(entry);
			setHistoryDeleteConfirmOpen(true);
		},
		[],
	);

	const executeDeleteHistory = useCallback(async () => {
		const target = historyDeleteTarget;
		if (!target) {
			setHistoryDeleteConfirmOpen(false);
			return;
		}
		setDeletingHistoryStreamId(target.streamId);
		try {
			if (isVocab) {
				if (
					EnglishPackStore.vocabActiveStreamId === target.streamId &&
					EnglishPackStore.vocabLoading
				) {
					EnglishPackStore.vocabCancelByUser();
				}
				await deleteEnglishVocabularyPackHistory(target.streamId);
				EnglishPackStore.vocabClearSessionIfDeleted(target.streamId);
				setVocabEntries((prev) =>
					prev.filter((e) => e.streamId !== target.streamId),
				);
			} else {
				if (
					EnglishPackStore.classicActiveStreamId === target.streamId &&
					EnglishPackStore.classicLoading
				) {
					EnglishPackStore.classicCancelByUser();
				}
				await deleteEnglishClassicQuotesPackHistory(target.streamId);
				EnglishPackStore.classicClearSessionIfDeleted(target.streamId);
				setClassicEntries((prev) =>
					prev.filter((e) => e.streamId !== target.streamId),
				);
			}
			if (drawerLoadedStreamId === target.streamId) {
				setDrawerLoadedStreamId(null);
			}
			if (
				location.pathname.includes('/english-learning/stream') &&
				new URLSearchParams(location.search).get('streamId') === target.streamId
			) {
				navigate('/english-learning', { replace: true });
			}
			Toast({
				type: 'success',
				title: t('englishLearning.packHistory.deleteSuccess'),
			});
		} catch {
			// 错误由 http 层 Toast
		} finally {
			setDeletingHistoryStreamId(null);
			setHistoryDeleteConfirmOpen(false);
			setHistoryDeleteTarget(null);
		}
	}, [
		drawerLoadedStreamId,
		historyDeleteTarget,
		isVocab,
		location.pathname,
		location.search,
		navigate,
		t,
	]);

	const deleteDescription =
		historyDeleteTarget && isVocab
			? t('englishLearning.packHistory.deleteConfirmDesc', {
					topic:
						(historyDeleteTarget as EnglishVocabularyHistoryEntry).topic || '—',
					count: (historyDeleteTarget as EnglishVocabularyHistoryEntry)
						.wordCount,
				})
			: historyDeleteTarget
				? t('englishLearning.packHistory.deleteConfirmDescClassic', {
						topic:
							(historyDeleteTarget as EnglishClassicQuoteHistoryEntry).topic ||
							'—',
						count: (historyDeleteTarget as EnglishClassicQuoteHistoryEntry)
							.quoteCount,
					})
				: '\u00a0';

	return (
		<>
			<Confirm
				open={historyDeleteConfirmOpen}
				onOpenChange={(open) => {
					setHistoryDeleteConfirmOpen(open);
					if (!open) setHistoryDeleteTarget(null);
				}}
				title={t('englishLearning.packHistory.deleteConfirmTitle')}
				description={deleteDescription}
				descriptionClassName="text-left"
				confirmText={t('englishLearning.packHistory.deleteConfirmAction')}
				cancelText={t('common.cancel')}
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={() => void executeDeleteHistory()}
			/>
			<div
				className={cn(
					'cursor-pointer text-teal-500 hover:text-teal-400 flex items-center shrink-0 gap-1.5 whitespace-nowrap text-sm font-medium',
					className,
				)}
				onClick={() => setHistoryDrawerOpen(true)}
			>
				<History className="size-4 shrink-0 opacity-90" aria-hidden />
				<span>{openDrawerLabel}</span>
			</div>
			{isVocab ? (
				<VocabularyHistoryDrawer
					open={historyDrawerOpen}
					onOpenChange={setHistoryDrawerOpen}
					entries={vocabEntries}
					loading={historyLoading}
					loadingMore={historyLoadingMore}
					loadedStreamId={drawerLoadedStreamId}
					loadingDetailId={null}
					deletingStreamId={deletingHistoryStreamId}
					onViewportScroll={onHistoryViewportScroll}
					onSelectEntry={openHistoryDetail}
					onDeleteEntry={requestDeleteVocab}
				/>
			) : (
				<ClassicQuotesHistoryDrawer
					open={historyDrawerOpen}
					onOpenChange={setHistoryDrawerOpen}
					entries={classicEntries}
					loading={historyLoading}
					loadingMore={historyLoadingMore}
					loadedStreamId={drawerLoadedStreamId}
					loadingDetailId={null}
					deletingStreamId={deletingHistoryStreamId}
					onViewportScroll={onHistoryViewportScroll}
					onSelectEntry={openHistoryDetail}
					onDeleteEntry={requestDeleteClassic}
				/>
			)}
		</>
	);
}

export const PackStreamHistoryDrawerTrigger = observer(
	PackStreamHistoryDrawerTriggerInner,
);
