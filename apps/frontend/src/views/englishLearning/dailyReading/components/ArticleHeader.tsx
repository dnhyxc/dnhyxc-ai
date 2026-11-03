import Tooltip from '@design/Tooltip';
import { Button } from '@ui/index';
import {
	Ban,
	Circle,
	Globe,
	GlobeOff,
	PanelLeftClose,
	PanelLeftOpen,
	WandSparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import type { EnglishDailyReadingItem } from '@/service';
import { DailyPlayIconButton } from '../../daily/components/DailyPlayIconButton';

const HEADER_ICON_BTN =
	'h-8 w-8 shrink-0 cursor-pointer rounded-md border-0 p-0 text-teal-500 shadow-none transition-colors hover:text-teal-400 focus-visible:border-transparent focus-visible:ring-0 focus-visible:shadow-none';

export function ArticleHeader({
	row,
	playing,
	paused = false,
	listOpen,
	hasSentenceZh = false,
	sentenceZhOpen = false,
	playSentenceZhOpen = true,
	onPlay,
	onToggleList,
	onToggleSentenceZh,
	onTogglePlaySentenceZh,
}: {
	row: EnglishDailyReadingItem;
	playing: boolean;
	paused?: boolean;
	listOpen: boolean;
	/** 有逐句中文数据时才渲染相关开关 */
	hasSentenceZh?: boolean;
	sentenceZhOpen?: boolean;
	/** 朗读时展示当前句中文；默认开 */
	playSentenceZhOpen?: boolean;
	onPlay: () => void;
	onToggleList: () => void;
	onToggleSentenceZh?: () => void;
	onTogglePlaySentenceZh?: () => void;
}) {
	const { t } = useI18n();
	const navigate = useNavigate();
	const playLabel = playing
		? paused
			? t('englishLearning.tts.resume')
			: t('englishLearning.tts.pause')
		: t('englishLearning.dailyReading.play');
	const sentenceZhLabel = sentenceZhOpen
		? t('englishLearning.dailyReading.hideSentenceZh')
		: t('englishLearning.dailyReading.showSentenceZh');
	const playSentenceZhLabel = playSentenceZhOpen
		? t('englishLearning.dailyReading.hidePlaySentenceZh')
		: t('englishLearning.dailyReading.showPlaySentenceZh');
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-3">
				<h1 className="min-w-0 flex-1 text-xl font-semibold leading-snug">
					{row.titleEn}
				</h1>
				<div className="flex shrink-0 items-center -mr-[9px]">
					{row.bodyEn ? (
						<DailyPlayIconButton
							mode="pause"
							playing={playing}
							paused={paused}
							playLabel={playLabel}
							onPlay={onPlay}
						/>
					) : null}
					{hasSentenceZh && onTogglePlaySentenceZh ? (
						<Tooltip side="top" content={playSentenceZhLabel}>
							<Button
								type="button"
								variant="link"
								size="sm"
								tabIndex={-1}
								aria-pressed={playSentenceZhOpen}
								aria-label={playSentenceZhLabel}
								className={HEADER_ICON_BTN}
								onClick={(event) => {
									onTogglePlaySentenceZh();
									event.currentTarget.blur();
								}}
							>
								{playSentenceZhOpen ? (
									<Ban className="size-4" aria-hidden />
								) : (
									<Circle className="size-4" aria-hidden />
								)}
							</Button>
						</Tooltip>
					) : null}
					{hasSentenceZh && onToggleSentenceZh ? (
						<Tooltip side="top" content={sentenceZhLabel}>
							<Button
								type="button"
								variant="link"
								size="sm"
								tabIndex={-1}
								aria-pressed={sentenceZhOpen}
								aria-label={sentenceZhLabel}
								className={HEADER_ICON_BTN}
								onClick={(event) => {
									onToggleSentenceZh();
									event.currentTarget.blur();
								}}
							>
								{sentenceZhOpen ? (
									<GlobeOff className="size-4" aria-hidden />
								) : (
									<Globe className="size-4" aria-hidden />
								)}
							</Button>
						</Tooltip>
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
							className={HEADER_ICON_BTN}
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
							className={HEADER_ICON_BTN}
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
