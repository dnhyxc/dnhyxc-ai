/**
 * 练习设置面板
 */
import { Button, Spinner, Toast } from '@ui/index';
import {
	BookMarked,
	ClipboardList,
	Headphones,
	Languages,
	Library,
	Package,
	Radio,
} from 'lucide-react';
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import EnglishPackStore from '@/store/englishPack';
import {
	getEnglishPracticePoolTotal,
	resolveEnglishPracticePoolKey,
} from '@/store/englishPracticePool';
import { PracticeCard, PracticeSegmented } from './components/shell';
import { PRACTICE_PAGE_CONTENT_CLASS } from './constants';
import type {
	PracticeCountOption,
	PracticeMode,
	PracticeOrder,
	PracticeSetupConfig,
	PracticeSource,
	SetupProps,
} from './types';
import { fetchPracticeSessionQueue } from './utils/fetchWords';
import { resolvePracticeSourceTitle } from './utils/resolveTitle';

const COUNT_OPTIONS: PracticeCountOption[] = [10, 20, 30, 40, 50];

const SETUP_SEGMENTED_PANEL_CLASS =
	'border-theme/10 bg-theme-background rounded-lg border p-1 shadow-sm';

function SetupSection({
	label,
	children,
	className,
}: {
	label: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn('flex flex-col gap-2', className)}>
			<span className="text-textcolor text-sm font-semibold">{label}</span>
			{children}
		</div>
	);
}

function SourceIcon({ source }: { source: PracticeSource }) {
	const className = 'text-teal-600 size-4 dark:text-teal-400';
	if (source === 'library') return <Library className={className} />;
	if (source === 'pack') return <Package className={className} />;
	if (source === 'live') return <Radio className={className} />;
	if (source === 'mistakes') return <ClipboardList className={className} />;
	return <BookMarked className={className} />;
}

export function Setup({
	initialContentKind,
	initialSource,
	initialMode,
	initialLibraryId,
	initialStreamId,
	initialSourceTitle,
	initialPoolTotal,
	onStarted,
}: SetupProps) {
	const { t } = useI18n();
	const [mode, setMode] = useState<PracticeMode>(initialMode);
	const source = initialSource;
	const [order, setOrder] = useState<PracticeOrder>('random');
	const [count, setCount] = useState<PracticeCountOption>(20);
	const [loading, setLoading] = useState(false);
	const [sourceDisplayTitle, setSourceDisplayTitle] = useState<string | null>(
		() => initialSourceTitle?.trim() || null,
	);
	const startInFlightRef = useRef(false);

	const sourceLocked = useMemo(
		() =>
			initialSource === 'library' ||
			initialSource === 'pack' ||
			initialSource === 'live' ||
			initialSource === 'mistakes',
		[initialSource],
	);

	const poolTotalDisplay = useMemo(() => {
		if (initialPoolTotal != null && initialPoolTotal > 0) {
			return initialPoolTotal;
		}
		const key = resolveEnglishPracticePoolKey({
			contentKind: initialContentKind,
			source,
			libraryId: initialLibraryId,
			streamId: initialStreamId,
		});
		if (key) {
			const cached = getEnglishPracticePoolTotal(key);
			if (cached != null) return cached;
		}
		if (source === 'live') {
			const n =
				initialContentKind === 'classic'
					? EnglishPackStore.classicItems.length
					: EnglishPackStore.vocabItems.length;
			return n > 0 ? n : undefined;
		}
		return undefined;
	}, [
		initialContentKind,
		initialPoolTotal,
		source,
		initialLibraryId,
		initialStreamId,
	]);

	const sourceHeaderBody = (
		<div className="flex min-w-0 flex-1 items-center justify-between gap-3">
			<div className="min-w-0 flex-1">
				<p className="text-textcolor/50 text-xs font-medium">
					{t('englishLearning.practice.sourceLabel')}
				</p>
				<p className="text-textcolor truncate text-sm mt-1 font-semibold">
					{sourceDisplayTitle ?? t('englishLearning.practice.sourceResolving')}
				</p>
			</div>
			{poolTotalDisplay != null ? (
				<span className="text-textcolor/75 shrink-0 text-sm font-medium tabular-nums">
					{initialContentKind === 'classic'
						? t('englishLearning.classic.historySentences', {
								count: poolTotalDisplay,
							})
						: t('englishLearning.vocab.historyWords', {
								count: poolTotalDisplay,
							})}
				</span>
			) : null}
		</div>
	);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const title = await resolvePracticeSourceTitle({
				contentKind: initialContentKind,
				source,
				libraryId: initialLibraryId,
				streamId: initialStreamId,
				sourceTitleFromUrl: initialSourceTitle,
				t,
			});
			if (!cancelled) setSourceDisplayTitle(title);
		})();
		return () => {
			cancelled = true;
		};
	}, [
		initialContentKind,
		source,
		initialLibraryId,
		initialStreamId,
		initialSourceTitle,
		t,
	]);

	const onStart = useCallback(async () => {
		if (startInFlightRef.current) return;
		startInFlightRef.current = true;
		setLoading(true);
		try {
			const config: PracticeSetupConfig = {
				contentKind: initialContentKind,
				mode,
				source,
				order,
				count,
				libraryId: initialLibraryId,
				streamId: initialStreamId,
				poolTotal: initialPoolTotal,
			};
			const { items, cursor } = await fetchPracticeSessionQueue({
				contentKind: initialContentKind,
				source,
				count,
				order,
				libraryId: initialLibraryId,
				streamId: initialStreamId,
				poolTotal: initialPoolTotal,
			});
			if (items.length === 0) {
				Toast({
					type: 'warning',
					title: t('englishLearning.practice.emptyTitle'),
					message: t('englishLearning.practice.emptyPool'),
				});
				return;
			}
			onStarted(items, config, cursor);
		} catch (e) {
			Toast({
				type: 'error',
				title:
					e instanceof Error
						? e.message
						: t('englishLearning.practice.loadFailed'),
			});
		} finally {
			startInFlightRef.current = false;
			setLoading(false);
		}
	}, [
		count,
		initialContentKind,
		initialLibraryId,
		initialPoolTotal,
		initialStreamId,
		mode,
		onStarted,
		order,
		source,
		t,
	]);

	return (
		<div className={PRACTICE_PAGE_CONTENT_CLASS}>
			<PracticeCard className="border-theme/10 overflow-hidden p-0 shadow-sm">
				{sourceLocked ? (
					<div className="border-theme/10 bg-teal-500/10 flex items-center gap-3 border-b px-4 py-3">
						<div className="bg-teal-500/15 flex size-10 shrink-0 items-center justify-center rounded-md">
							<SourceIcon source={source} />
						</div>
						{sourceHeaderBody}
					</div>
				) : (
					<div className="border-theme/10 bg-teal-500/6 flex items-center gap-3 border-b px-4 py-3">
						<div className="bg-teal-500/15 flex size-9 shrink-0 items-center justify-center rounded-md">
							<SourceIcon source={source} />
						</div>
						{sourceHeaderBody}
					</div>
				)}

				<div className="flex flex-col gap-5 px-4 py-5">
					<div className="flex flex-col gap-2">
						<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
							<span className="text-textcolor shrink-0 text-sm font-semibold">
								{t('englishLearning.practice.modeLabel')}
							</span>
							<p className="text-textcolor/50 flex min-w-0 items-center gap-1.5 text-xs">
								{mode === 'dictation' ? (
									<>
										<Headphones className="size-3.5 shrink-0 text-teal-600/80 dark:text-teal-400/80" />
										<span className="min-w-0 leading-snug">
											{t('englishLearning.practice.dictationHint')}
										</span>
									</>
								) : (
									<>
										<Languages className="size-3.5 shrink-0 text-teal-600/80 dark:text-teal-400/80" />
										<span className="min-w-0 leading-snug">
											{t('englishLearning.practice.spellingPrompt')}
										</span>
									</>
								)}
							</p>
						</div>
						<div className={SETUP_SEGMENTED_PANEL_CLASS}>
							<PracticeSegmented
								value={mode}
								options={[
									{
										value: 'dictation',
										label: t('englishLearning.practice.modeDictation'),
									},
									{
										value: 'spelling',
										label: t('englishLearning.practice.modeSpelling'),
									},
								]}
								onChange={setMode}
							/>
						</div>
					</div>

					<div className="grid gap-5 sm:grid-cols-2">
						<SetupSection label={t('englishLearning.practice.countLabel')}>
							<div className={SETUP_SEGMENTED_PANEL_CLASS}>
								<PracticeSegmented
									value={String(count)}
									options={COUNT_OPTIONS.map((n) => ({
										value: String(n),
										label: String(n),
									}))}
									onChange={(v) => setCount(Number(v) as PracticeCountOption)}
								/>
							</div>
						</SetupSection>
						<SetupSection label={t('englishLearning.practice.orderLabel')}>
							<div className={SETUP_SEGMENTED_PANEL_CLASS}>
								<PracticeSegmented
									value={order}
									options={[
										{
											value: 'random',
											label: t('englishLearning.practice.orderRandom'),
										},
										{
											value: 'sequential',
											label: t('englishLearning.practice.orderSequential'),
										},
									]}
									onChange={setOrder}
								/>
							</div>
						</SetupSection>
					</div>
				</div>

				<div className="border-theme/10 border-t px-4 py-4">
					<div className={SETUP_SEGMENTED_PANEL_CLASS}>
						<Button
							type="button"
							className="h-10 w-full gap-2"
							disabled={loading}
							onClick={() => void onStart()}
						>
							{loading ? (
								<>
									<Spinner className="size-4" />
									{t('englishLearning.practice.loadingWords')}
								</>
							) : (
								t('englishLearning.practice.start')
							)}
						</Button>
					</div>
				</div>
			</PracticeCard>
		</div>
	);
}
