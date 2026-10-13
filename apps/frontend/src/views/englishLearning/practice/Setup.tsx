/**
 * 练习设置：模式 / 题量 / 顺序卡片；卡内顶栏说明 + 底栏短要点
 */
import Confirm from '@design/Confirm';
import { Button, RadioGroup, RadioGroupItem, Spinner, Toast } from '@ui/index';
import {
	Check,
	CloudUpload,
	Headphones,
	Languages,
	ListOrdered,
	Save,
	Shuffle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import EnglishPackStore from '@/store/englishPack';
import {
	getEnglishPracticePoolTotal,
	resolveEnglishPracticePoolKey,
} from '@/store/englishPracticePool';
import { Banner as ResumeBanner } from '../components/resume';
import { Head } from '../components/shell';
import { PRACTICE_PRIMARY_ACTION_BTN_CLASS } from './constants';
import type {
	PracticeCountOption,
	PracticeMode,
	PracticeOrder,
	PracticeReportSaveMode,
	PracticeSetupConfig,
	SetupProps,
} from './types';
import { fetchPracticeSessionQueue } from './utils/fetchWords';
import { resolvePracticeSourceTitle } from './utils/resolveTitle';

const COUNT_OPTIONS: PracticeCountOption[] = [
	10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
];

const FIELD_LABEL = 'text-textcolor shrink-0 text-sm font-semibold';

/** 不用 @ui Label：其默认 items-center/leading-none 会打乱竖排说明 */
const PICK =
	'relative flex max-h-35 cursor-pointer flex-col rounded-md border p-3 text-left transition-colors';
const PICK_ON = 'border-teal-500/40 bg-teal-500/15';
const PICK_OFF =
	'border-theme/10 bg-theme/5 hover:border-teal-500/35 hover:bg-teal-500/10';

const ICON_BOX = 'flex size-8 shrink-0 items-center justify-center rounded-md';
const ICON_BOX_ON = 'bg-teal-500/20 text-textcolor/70';
const ICON_BOX_OFF = 'bg-theme/10 text-textcolor/45';

type SetupPick = {
	id: string;
	active: boolean;
	/** 做法说明 */
	desc: string;
	/** 适用场景（分隔线下方） */
	tip: string;
	title: string;
	Icon: typeof Headphones;
	value: string;
};

/** 图2 结构：图标+标题 → 做法 → 分隔线 → 适用；高度跟内容，不超过 max-h-32 */
function SetupPickCard({
	id,
	active,
	title,
	desc,
	tip,
	Icon,
	value,
}: SetupPick) {
	return (
		<label htmlFor={id} className={cn(PICK, active ? PICK_ON : PICK_OFF)}>
			<RadioGroupItem value={value} id={id} className="sr-only" />
			<span className="flex shrink-0 items-center gap-2.5 pr-8">
				<span
					className={cn(ICON_BOX, active ? ICON_BOX_ON : ICON_BOX_OFF)}
					aria-hidden
				>
					<Icon className="size-4" />
				</span>
				<span className="text-textcolor min-w-0 truncate text-base font-semibold">
					{title}
				</span>
			</span>
			<p
				className="text-textcolor/65 mt-2.5 truncate text-xs leading-snug whitespace-nowrap"
				title={desc}
			>
				{desc}
			</p>
			<p
				className="border-theme/10 text-textcolor/65 mt-2.5 truncate border-t pt-2.5 text-xs leading-snug whitespace-nowrap"
				title={tip}
			>
				{tip}
			</p>
			{active ? (
				<span
					className="bg-teal-600 absolute top-3 right-3 flex size-5 items-center justify-center rounded-full text-white"
					aria-hidden
				>
					<Check className="size-3" strokeWidth={2.5} />
				</span>
			) : null}
		</label>
	);
}

export function Setup({
	initialContentKind,
	initialSource,
	initialMode,
	initialLibraryId,
	initialStreamId,
	initialSourceTitle,
	initialPoolTotal,
	headerExtra,
	resume = null,
	replaceUnfinished = false,
	onContinueResume,
	onDiscardResume,
	onStarted,
}: SetupProps) {
	const { t } = useI18n();
	const source = initialSource;
	const [mode, setMode] = useState<PracticeMode>(
		() => resume?.mode ?? initialMode,
	);
	const [order, setOrder] = useState<PracticeOrder>(
		() => resume?.order ?? 'random',
	);
	const [count, setCount] = useState<PracticeCountOption>(
		() => resume?.count ?? 20,
	);
	const [reportSaveMode, setReportSaveMode] = useState<PracticeReportSaveMode>(
		() => resume?.reportSaveMode ?? 'manual',
	);
	const [loading, setLoading] = useState(false);
	const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
	const [resumeQueueConfirmOpen, setResumeQueueConfirmOpen] = useState(false);
	const [pendingQueueChange, setPendingQueueChange] = useState<
		| { type: 'count'; value: PracticeCountOption }
		| { type: 'order'; value: PracticeOrder }
		| null
	>(null);
	const [sourceDisplayTitle, setSourceDisplayTitle] = useState<string | null>(
		() => initialSourceTitle?.trim() || null,
	);
	const startInFlightRef = useRef(false);
	const syncedResumeSidRef = useRef<string | null>(null);
	const hideOrderPicker = source === 'review';

	/** 有续练：进入/刷新回显草稿配置（按 sid 同步一次） */
	useEffect(() => {
		if (!resume) return;
		if (syncedResumeSidRef.current === resume.sid) return;
		syncedResumeSidRef.current = resume.sid;
		setMode(resume.mode);
		setOrder(resume.order);
		setCount(resume.count);
		setReportSaveMode(resume.reportSaveMode);
	}, [resume]);

	const resetSetupDefaults = useCallback(() => {
		setMode(initialMode);
		setOrder('random');
		setCount(20);
		setReportSaveMode('manual');
	}, [initialMode]);

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

	const poolCountLabel =
		poolTotalDisplay == null
			? null
			: initialContentKind === 'classic'
				? t('englishLearning.classic.historySentences', {
						count: poolTotalDisplay,
					})
				: t('englishLearning.vocab.historyWords', {
						count: poolTotalDisplay,
					});

	const modes = useMemo(() => {
		const isClassic = initialContentKind === 'classic';
		return [
			{
				value: 'dictation' as const,
				title: isClassic
					? t('englishLearning.practice.modeDictationClassic')
					: t('englishLearning.practice.modeDictationVocab'),
				desc: t('englishLearning.practice.setupModeDictationHint'),
				tip: t('englishLearning.practice.modeDictationFit'),
				Icon: Headphones,
			},
			{
				value: 'spelling' as const,
				title: isClassic
					? t('englishLearning.practice.modeSpellingClassic')
					: t('englishLearning.practice.modeSpellingVocab'),
				desc: t('englishLearning.practice.setupModeSpellingHint'),
				tip: t('englishLearning.practice.modeSpellingFit'),
				Icon: Languages,
			},
		];
	}, [initialContentKind, t]);

	const orders = useMemo(
		() => [
			{
				value: 'random' as const,
				title: t('englishLearning.practice.orderRandom'),
				desc: t('englishLearning.practice.orderRandomHint'),
				tip: t('englishLearning.practice.orderRandomFit'),
				Icon: Shuffle,
			},
			{
				value: 'sequential' as const,
				title: t('englishLearning.practice.orderSequential'),
				desc: t('englishLearning.practice.orderSequentialHint'),
				tip: t('englishLearning.practice.orderSequentialFit'),
				Icon: ListOrdered,
			},
		],
		[t],
	);

	const reportSaveModes = useMemo(
		() => [
			{
				value: 'manual' as const,
				title: t('englishLearning.practice.reportSaveManual'),
				desc: t('englishLearning.practice.reportSaveManualHint'),
				tip: t('englishLearning.practice.reportSaveManualFit'),
				Icon: Save,
			},
			{
				value: 'auto' as const,
				title: t('englishLearning.practice.reportSaveAuto'),
				desc: t('englishLearning.practice.reportSaveAutoHint'),
				tip: t('englishLearning.practice.reportSaveAutoFit'),
				Icon: CloudUpload,
			},
		],
		[t],
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

	const runStart = useCallback(async () => {
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
				sourceTitle: sourceDisplayTitle?.trim() || undefined,
				reportSaveMode,
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
		sourceDisplayTitle,
		onStarted,
		order,
		reportSaveMode,
		source,
		t,
	]);

	const onStartClick = useCallback(() => {
		if (replaceUnfinished) {
			setReplaceConfirmOpen(true);
			return;
		}
		void runStart();
	}, [replaceUnfinished, runStart]);

	const requestCountChange = useCallback(
		(next: PracticeCountOption) => {
			if (next === count) return;
			if (resume) {
				setPendingQueueChange({ type: 'count', value: next });
				setResumeQueueConfirmOpen(true);
				return;
			}
			setCount(next);
		},
		[count, resume],
	);

	const requestOrderChange = useCallback(
		(next: PracticeOrder) => {
			if (next === order) return;
			if (resume) {
				setPendingQueueChange({ type: 'order', value: next });
				setResumeQueueConfirmOpen(true);
				return;
			}
			setOrder(next);
		},
		[order, resume],
	);

	const onConfirmResumeQueueChange = useCallback(() => {
		if (!pendingQueueChange) return;
		if (pendingQueueChange.type === 'count') {
			setCount(pendingQueueChange.value);
		} else {
			setOrder(pendingQueueChange.value);
		}
		setPendingQueueChange(null);
		syncedResumeSidRef.current = null;
		onDiscardResume?.();
	}, [onDiscardResume, pendingQueueChange]);

	const onDiscardClick = useCallback(() => {
		syncedResumeSidRef.current = null;
		resetSetupDefaults();
		onDiscardResume?.();
	}, [onDiscardResume, resetSetupDefaults]);

	const onContinueClick = useCallback(() => {
		onContinueResume?.(mode);
	}, [mode, onContinueResume]);

	return (
		<div className="flex h-full min-h-0 w-full flex-1 flex-col">
			<Head className="pl-4 pr-2" trailing={headerExtra}>
				<span className="min-w-0 truncate">
					{sourceDisplayTitle ?? t('common.loadingEllipsis')}
				</span>
				{poolCountLabel ? (
					<span className="text-textcolor/45 shrink-0 text-sm font-normal tabular-nums">
						{poolCountLabel}
					</span>
				) : null}
			</Head>

			<div className="flex min-h-0 flex-1 flex-col items-center overflow-hidden p-4">
				{/* 卡片按内容高度（max-h-33），多余空间由底部弹性区吸收，一屏无滚动 */}
				<div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-5">
					<section className="flex shrink-0 flex-col gap-3">
						<h2 className={FIELD_LABEL}>
							{t('englishLearning.practice.setupPickMode')}
						</h2>
						<RadioGroup
							value={mode}
							onValueChange={(v) => setMode(v as PracticeMode)}
							className="grid grid-cols-1 gap-4 sm:grid-cols-2"
						>
							{modes.map(({ value, title, desc, tip, Icon }) => (
								<SetupPickCard
									key={value}
									id={`el-setup-mode-${value}`}
									value={value}
									active={mode === value}
									title={title}
									desc={desc}
									tip={tip}
									Icon={Icon}
								/>
							))}
						</RadioGroup>
					</section>

					<section className="flex shrink-0 flex-col gap-3">
						<h2 className={FIELD_LABEL}>
							{t('englishLearning.practice.countLabel')}
						</h2>
						<RadioGroup
							value={String(count)}
							onValueChange={(v) =>
								requestCountChange(Number(v) as PracticeCountOption)
							}
							className="grid grid-cols-10 gap-4"
						>
							{COUNT_OPTIONS.map((n) => {
								const active = count === n;
								const id = `el-setup-count-${n}`;
								return (
									<label
										key={n}
										htmlFor={id}
										className={cn(
											'flex h-10 min-w-0 cursor-pointer items-center justify-center rounded-md border text-base font-semibold tabular-nums transition-colors',
											active
												? 'border-teal-500/40 bg-teal-500/15 text-textcolor'
												: 'border-theme/10 bg-theme/5 text-textcolor hover:border-teal-500/35 hover:bg-teal-500/10',
										)}
									>
										<RadioGroupItem
											value={String(n)}
											id={id}
											className="sr-only"
										/>
										{n}
									</label>
								);
							})}
						</RadioGroup>
					</section>

					{/* 出题顺序 | 报告保存：同一行，共四张卡 */}
					<div
						className={cn(
							'grid shrink-0 gap-4',
							hideOrderPicker ? 'grid-cols-1' : 'grid-cols-2',
						)}
					>
						{hideOrderPicker ? null : (
							<section className="flex flex-col gap-3">
								<h2 className={FIELD_LABEL}>
									{t('englishLearning.practice.orderLabel')}
								</h2>
								<RadioGroup
									value={order}
									onValueChange={(v) => requestOrderChange(v as PracticeOrder)}
									className="grid grid-cols-2 gap-4"
								>
									{orders.map(({ value, title, desc, tip, Icon }) => (
										<SetupPickCard
											key={value}
											id={`el-setup-order-${value}`}
											value={value}
											active={order === value}
											title={title}
											desc={desc}
											tip={tip}
											Icon={Icon}
										/>
									))}
								</RadioGroup>
							</section>
						)}

						<section className="flex flex-col gap-3">
							<h2 className={FIELD_LABEL}>
								{t('englishLearning.practice.reportSaveLabel')}
							</h2>
							<RadioGroup
								value={reportSaveMode}
								onValueChange={(v) =>
									setReportSaveMode(v as PracticeReportSaveMode)
								}
								className="grid grid-cols-2 gap-4"
							>
								{reportSaveModes.map(({ value, title, desc, tip, Icon }) => (
									<SetupPickCard
										key={value}
										id={`el-setup-report-save-${value}`}
										value={value}
										active={reportSaveMode === value}
										title={title}
										desc={desc}
										tip={tip}
										Icon={Icon}
									/>
								))}
							</RadioGroup>
						</section>
					</div>
				</div>
				<div className="mx-auto flex w-full max-w-5xl flex-1 items-end justify-end gap-4">
					<div className="flex min-w-0 flex-1 flex-col gap-3">
						<h2 className={FIELD_LABEL}>
							{t('englishLearning.practice.startLabel')}
						</h2>
						<Button
							type="button"
							className={cn(
								'h-10 w-full shrink-0 gap-2',
								PRACTICE_PRIMARY_ACTION_BTN_CLASS,
							)}
							disabled={loading}
							onClick={onStartClick}
						>
							{loading ? (
								<>
									<Spinner className="size-4 text-white" />
									{t('englishLearning.practice.loadingWords')}
								</>
							) : (
								t('englishLearning.practice.start')
							)}
						</Button>
					</div>
					{resume ? (
						<ResumeBanner
							description={resume.description}
							continueLabel={resume.continueLabel}
							discardLabel={resume.discardLabel}
							onContinue={onContinueClick}
							onDiscard={onDiscardClick}
						/>
					) : null}
				</div>
			</div>
			<Confirm
				open={replaceConfirmOpen}
				onOpenChange={setReplaceConfirmOpen}
				title={t('englishLearning.sessionDraft.replacePracticeTitle')}
				description={t('englishLearning.sessionDraft.replacePracticeDesc')}
				confirmText={t('englishLearning.sessionDraft.replaceConfirm')}
				cancelText={t('englishLearning.practice.back')}
				confirmVariant="destructive"
				onConfirm={() => void runStart()}
			/>
			<Confirm
				open={resumeQueueConfirmOpen}
				onOpenChange={(open) => {
					setResumeQueueConfirmOpen(open);
					if (!open) setPendingQueueChange(null);
				}}
				title={t(
					pendingQueueChange?.type === 'order'
						? 'englishLearning.sessionDraft.resumeOrderTitle'
						: 'englishLearning.sessionDraft.resumeCountTitle',
				)}
				description={t(
					pendingQueueChange?.type === 'order'
						? 'englishLearning.sessionDraft.resumeOrderDesc'
						: 'englishLearning.sessionDraft.resumeCountDesc',
				)}
				confirmText={t('englishLearning.sessionDraft.resumeQueueConfirm')}
				cancelText={t('englishLearning.practice.back')}
				confirmVariant="destructive"
				onConfirm={onConfirmResumeQueueChange}
			/>
		</div>
	);
}
