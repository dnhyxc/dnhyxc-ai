import Tooltip from '@design/Tooltip';
import { Button } from '@ui/index';
import { ChevronLeft, ChevronRight, Pause, Play, Square } from 'lucide-react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	CHAPTER_LISTEN_RATES,
	type ChapterListenStatus,
} from '../hooks/useEpubChapterListen';

type Props = {
	status: ChapterListenStatus;
	spineIndex: number;
	sentenceIndex: number;
	sentenceCount: number;
	rate: number;
	onTogglePlay: () => void;
	onStop: () => void;
	onPrevSentence: () => void;
	onNextSentence: () => void;
	onRateChange: (rate: number) => void;
};

/** 听书底部播放条 */
export function EpubListenPlayerBar({
	status,
	spineIndex,
	sentenceIndex,
	sentenceCount,
	rate,
	onTogglePlay,
	onStop,
	onPrevSentence,
	onNextSentence,
	onRateChange,
}: Props) {
	const { t } = useI18n();

	if (status === 'idle') return null;

	const playing = status === 'playing';
	const loading = status === 'loading';
	const progressLabel =
		sentenceCount > 0
			? t('ebook.read.listenBook.progress', {
					chapter: spineIndex + 1,
					current: sentenceIndex + 1,
					total: sentenceCount,
				})
			: t('ebook.read.listenBook.loading');

	return (
		<div
			className={cn(
				'border-theme/10 bg-theme/5 flex shrink-0 items-center gap-2 overflow-x-hidden border-t px-3 py-2',
				'backdrop-blur-[2px]',
			)}
			role="region"
			aria-label={t('ebook.read.listenBook.barAria')}
		>
			<Tooltip
				content={
					playing
						? t('ebook.read.listenBook.pause')
						: t('ebook.read.listenBook.resume')
				}
			>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="text-textcolor/80 shrink-0"
					disabled={loading}
					aria-label={
						playing
							? t('ebook.read.listenBook.pause')
							: t('ebook.read.listenBook.resume')
					}
					onClick={onTogglePlay}
				>
					{playing ? (
						<Pause className="size-4" aria-hidden />
					) : (
						<Play className="size-4" aria-hidden />
					)}
				</Button>
			</Tooltip>

			<Tooltip content={t('ebook.read.listenBook.stop')}>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="text-textcolor/80 shrink-0"
					aria-label={t('ebook.read.listenBook.stop')}
					onClick={onStop}
				>
					<Square className="size-3.5 fill-current" aria-hidden />
				</Button>
			</Tooltip>

			<span className="text-textcolor/70 min-w-0 flex-1 truncate text-xs">
				{progressLabel}
			</span>

			<Tooltip content={t('ebook.read.listenBook.prevSentence')}>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="text-textcolor/80 shrink-0"
					disabled={loading || sentenceIndex <= 0}
					aria-label={t('ebook.read.listenBook.prevSentence')}
					onClick={onPrevSentence}
				>
					<ChevronLeft className="size-4" aria-hidden />
				</Button>
			</Tooltip>

			<Tooltip content={t('ebook.read.listenBook.nextSentence')}>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="text-textcolor/80 shrink-0"
					disabled={loading || sentenceIndex >= sentenceCount - 1}
					aria-label={t('ebook.read.listenBook.nextSentence')}
					onClick={onNextSentence}
				>
					<ChevronRight className="size-4" aria-hidden />
				</Button>
			</Tooltip>

			<label className="text-textcolor/55 flex shrink-0 items-center gap-1 text-xs">
				<span className="sr-only">{t('ebook.read.listenBook.speed')}</span>
				<select
					className="border-theme/15 bg-theme/10 text-textcolor/80 rounded border px-1.5 py-0.5 text-xs"
					value={rate}
					disabled={loading}
					aria-label={t('ebook.read.listenBook.speed')}
					onChange={(e) => onRateChange(Number(e.target.value))}
				>
					{CHAPTER_LISTEN_RATES.map((r) => (
						<option key={r} value={r}>
							{r}x
						</option>
					))}
				</select>
			</label>
		</div>
	);
}
