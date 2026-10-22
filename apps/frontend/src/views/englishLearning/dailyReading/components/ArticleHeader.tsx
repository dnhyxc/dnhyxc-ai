import Tooltip from '@design/Tooltip';
import { Button } from '@ui/index';
import { PanelLeftClose, PanelLeftOpen, WandSparkles } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import type { EnglishDailyReadingItem } from '@/service';
import { DailyPlayIconButton } from '../../daily/components/DailyPlayIconButton';

export function ArticleHeader({
	row,
	playing,
	listOpen,
	onPlay,
	onToggleList,
}: {
	row: EnglishDailyReadingItem;
	playing: boolean;
	listOpen: boolean;
	onPlay: () => void;
	onToggleList: () => void;
}) {
	const { t } = useI18n();
	const navigate = useNavigate();
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-3">
				<h1 className="min-w-0 flex-1 text-xl font-semibold leading-snug">
					{row.titleEn}
				</h1>
				<div className="flex shrink-0 items-center -mr-[9px]">
					{row.bodyEn ? (
						<DailyPlayIconButton
							playing={playing}
							playLabel={
								playing
									? t('englishLearning.tts.stop')
									: t('englishLearning.dailyReading.play')
							}
							onPlay={onPlay}
						/>
					) : null}
					<Tooltip
						side="top"
						content={t('englishLearning.dailyReading.continueGenerate')}
					>
						<Button
							type="button"
							variant="link"
							size="sm"
							tabIndex={-1}
							aria-label={t('englishLearning.dailyReading.continueGenerate')}
							className="h-8 w-8 shrink-0 cursor-pointer rounded-md border-0 p-0 text-teal-500 shadow-none transition-colors hover:text-teal-400 focus-visible:border-transparent focus-visible:ring-0 focus-visible:shadow-none"
							onClick={(event) => {
								navigate('/english-learning/daily-reading/settings');
								event.currentTarget.blur();
							}}
						>
							<WandSparkles className="size-4" aria-hidden />
						</Button>
					</Tooltip>
					<Tooltip
						side="top"
						content={t(
							listOpen
								? 'englishLearning.dailyReading.listHide'
								: 'englishLearning.dailyReading.listShow',
						)}
					>
						<Button
							type="button"
							variant="link"
							size="sm"
							tabIndex={-1}
							aria-pressed={listOpen}
							aria-label={t(
								listOpen
									? 'englishLearning.dailyReading.listHide'
									: 'englishLearning.dailyReading.listShow',
							)}
							className="h-8 w-8 shrink-0 cursor-pointer rounded-md border-0 p-0 text-teal-500 shadow-none transition-colors hover:text-teal-400 focus-visible:border-transparent focus-visible:ring-0 focus-visible:shadow-none"
							onClick={(event) => {
								onToggleList();
								event.currentTarget.blur();
							}}
						>
							{listOpen ? (
								<PanelLeftClose className="size-4" aria-hidden />
							) : (
								<PanelLeftOpen className="size-4" aria-hidden />
							)}
						</Button>
					</Tooltip>
				</div>
			</div>
			<div className="flex items-center text-sm text-textcolor/80">
				<span className="-mb-0.5 text-base">{row.publishDate}</span>
				<span>
					{' · '}
					{t(
						row.origin === 'manual'
							? 'englishLearning.dailyReading.manual'
							: 'englishLearning.dailyReading.originDay',
					)}
					{row.extras ? ` · ${row.extras.level}` : ''}
					{row.extras?.length
						? ` · ${t(
								row.extras.length === 'short'
									? 'englishLearning.dailyReading.lengthShort'
									: row.extras.length === 'long'
										? 'englishLearning.dailyReading.lengthLong'
										: 'englishLearning.dailyReading.lengthMedium',
							)}`
						: ''}
					{row.extras?.focus
						? ` · ${
								row.extras.focus === 'both'
									? `${t('englishLearning.dailyReading.focusVocab')} · ${t('englishLearning.dailyReading.focusGrammar')}`
									: t(
											row.extras.focus === 'vocab'
												? 'englishLearning.dailyReading.focusVocab'
												: row.extras.focus === 'grammar'
													? 'englishLearning.dailyReading.focusGrammar'
													: 'englishLearning.dailyReading.focusReading',
										)
							}`
						: ''}
					{row.extras
						? ` · ${t(
								(row.extras.questions?.length ?? 0) >= 3
									? 'englishLearning.dailyReading.questions3'
									: row.extras.questions?.length === 2
										? 'englishLearning.dailyReading.questions2'
										: row.extras.questions?.length === 1
											? 'englishLearning.dailyReading.questions1'
											: 'englishLearning.dailyReading.questions0',
							)}`
						: ''}
				</span>
			</div>
		</div>
	);
}
