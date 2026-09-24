/**
 * 今日记词设置：模式 / 每轮词数 / 报告保存（布局对齐练习 Setup）
 */
import { Button, RadioGroup, RadioGroupItem, Spinner } from '@ui/index';
import {
	Check,
	CloudUpload,
	Eye,
	Headphones,
	Languages,
	Save,
} from 'lucide-react';
import { observer } from 'mobx-react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { hasValidAuthToken } from '@/router/authPaths';
import { getEnglishDailyMemorizeSummary } from '@/service';
import englishDailyStore from '@/store/englishDaily';
import { Head } from '../../components/shell';
import { PRACTICE_PRIMARY_ACTION_BTN_CLASS } from '../../practice/constants';
import type { PracticeReportSaveMode } from '../../practice/types';
import { useDailyWordCount } from '../hooks/useDailyWordCount';
import type { DailyMemorizeMode } from '../types';
import {
	DAILY_WORD_COUNT_OPTIONS,
	type DailyWordCount,
} from '../utils/dailyWordCount';
import {
	countStarterLibraryEligible,
	countStarterMemorized,
} from '../utils/localSrs';

type DailyIntroPanelProps = {
	starting: boolean;
	onStart: (
		mode: DailyMemorizeMode,
		reportSaveMode: PracticeReportSaveMode,
	) => void;
};

const FIELD_LABEL = 'text-textcolor shrink-0 text-sm font-semibold';

const PICK =
	'relative flex max-h-35 cursor-pointer flex-col rounded-md border p-3 text-left transition-colors';
const PICK_ON = 'border-teal-500/40 bg-teal-500/15';
const PICK_OFF =
	'border-theme/10 bg-theme/5 hover:border-teal-500/35 hover:bg-teal-500/10';
const ICON_BOX = 'flex size-8 shrink-0 items-center justify-center rounded-md';
const ICON_BOX_ON = 'bg-teal-500/20 text-textcolor/70';
const ICON_BOX_OFF = 'bg-theme/10 text-textcolor/45';

function SetupPickCard({
	id,
	value,
	active,
	title,
	desc,
	tip,
	Icon,
}: {
	id: string;
	value: string;
	active: boolean;
	title: string;
	desc: string;
	tip: string;
	Icon: typeof Eye;
}) {
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

export const DailyIntroPanel = observer(function DailyIntroPanel({
	starting,
	onStart,
}: DailyIntroPanelProps) {
	const { t } = useI18n();
	const isLoggedIn = hasValidAuthToken();
	const [wordsPerRound, setWordsPerRound] = useDailyWordCount();
	const pendingCount = englishDailyStore.libraryCount;
	const [mode, setMode] = useState<DailyMemorizeMode>('recognition');
	const [reportSaveMode, setReportSaveMode] =
		useState<PracticeReportSaveMode>('manual');

	useEffect(() => {
		if (
			englishDailyStore.libraryCount != null ||
			englishDailyStore.libraryCountLoading
		) {
			return;
		}
		if (!hasValidAuthToken()) {
			englishDailyStore.setLibraryCount(countStarterLibraryEligible());
			englishDailyStore.setMemorizedCount(countStarterMemorized());
			return;
		}
		englishDailyStore.beginLibraryCount();
		void getEnglishDailyMemorizeSummary({ silent: true })
			.then((res) => {
				englishDailyStore.setLibraryCount(res.data?.libraryCount ?? 0);
				englishDailyStore.setMemorizedCount(res.data?.memorizedCount ?? 0);
			})
			.catch(() => {
				englishDailyStore.setLibraryCount(0);
				englishDailyStore.setMemorizedCount(0);
			});
	}, []);

	const modes = useMemo(
		() => [
			{
				value: 'recognition' as const,
				title: t('englishLearning.daily.modeRecognition'),
				desc: t('englishLearning.daily.introDesc', { count: wordsPerRound }),
				tip: t('englishLearning.daily.introHint'),
				Icon: Eye,
			},
			{
				value: 'dictation' as const,
				title: t('englishLearning.daily.modeDictation'),
				desc: t('englishLearning.daily.introDescDictation', {
					count: wordsPerRound,
				}),
				tip: t('englishLearning.daily.introHintDictation'),
				Icon: Headphones,
			},
			{
				value: 'spelling' as const,
				title: t('englishLearning.daily.modeSpelling'),
				desc: t('englishLearning.daily.introDescSpelling', {
					count: wordsPerRound,
				}),
				tip: t('englishLearning.daily.introHintSpelling'),
				Icon: Languages,
			},
		],
		[t, wordsPerRound],
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

	const startLabel =
		mode === 'recognition'
			? t('englishLearning.daily.startLibrary')
			: mode === 'dictation'
				? t('englishLearning.daily.startDictation')
				: t('englishLearning.daily.startSpelling');

	return (
		<div className="flex h-full min-h-0 w-full flex-1 flex-col">
			<Head className="pl-4 pr-2">
				<span className="min-w-0 truncate">
					{t('route.englishLearning.daily.title')}
				</span>
				<span className="text-textcolor/45 shrink-0 text-sm font-normal tabular-nums">
					{t('englishLearning.daily.pendingCount', {
						count: pendingCount ?? '…',
					})}
				</span>
			</Head>

			<div className="flex min-h-0 flex-1 flex-col items-center overflow-hidden p-4">
				<div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-5">
					<section className="flex shrink-0 flex-col gap-3">
						<h2 className={FIELD_LABEL}>
							{t('englishLearning.practice.setupPickMode')}
						</h2>
						<RadioGroup
							value={mode}
							onValueChange={(v) => setMode(v as DailyMemorizeMode)}
							className="grid grid-cols-1 gap-4 sm:grid-cols-3"
						>
							{modes.map(({ value, title, desc, tip, Icon }) => (
								<SetupPickCard
									key={value}
									id={`el-daily-mode-${value}`}
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
							{t('englishLearning.daily.wordsPerRoundTitle')}
						</h2>
						<RadioGroup
							value={String(wordsPerRound)}
							onValueChange={(v) =>
								setWordsPerRound(Number(v) as DailyWordCount)
							}
							className="grid grid-cols-5 gap-4"
						>
							{DAILY_WORD_COUNT_OPTIONS.map((n) => {
								const active = wordsPerRound === n;
								const id = `el-daily-count-${n}`;
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

					<section className="flex shrink-0 flex-col gap-3">
						<h2 className={FIELD_LABEL}>
							{t('englishLearning.practice.reportSaveLabel')}
						</h2>
						<RadioGroup
							value={reportSaveMode}
							onValueChange={(v) =>
								setReportSaveMode(v as PracticeReportSaveMode)
							}
							className="grid grid-cols-1 gap-4 sm:grid-cols-2"
						>
							{reportSaveModes.map(({ value, title, desc, tip, Icon }) => (
								<SetupPickCard
									key={value}
									id={`el-daily-report-save-${value}`}
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

					{!isLoggedIn ? (
						<p className="text-textcolor/45 shrink-0 text-xs leading-snug">
							{t('englishLearning.daily.guestHint')}
						</p>
					) : null}
				</div>

				<div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-end gap-3">
					<h2 className={FIELD_LABEL}>
						{t('englishLearning.practice.startLabel')}
					</h2>
					<Button
						type="button"
						className={cn(
							'h-10 w-full shrink-0 gap-2',
							PRACTICE_PRIMARY_ACTION_BTN_CLASS,
						)}
						disabled={starting}
						onClick={() => onStart(mode, reportSaveMode)}
					>
						{starting ? (
							<>
								<Spinner className="size-4 text-white" />
								{t('englishLearning.daily.loading')}
							</>
						) : (
							startLabel
						)}
					</Button>
				</div>
			</div>
		</div>
	);
});
