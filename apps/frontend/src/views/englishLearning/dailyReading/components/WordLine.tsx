import { Button } from '@ui/index';
import { CheckCircle, Copy, Square, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/utils/clipboard';

/** 正文点词和文末单词列表共用：词、朗读、释义。 */
export function WordLine({
	word,
	zh,
	playing,
	onPlay,
	playLabel,
	stopLabel,
	copy = false,
}: {
	word: string;
	zh: string;
	playing: boolean;
	onPlay: () => void;
	playLabel: string;
	stopLabel: string;
	copy?: boolean;
}) {
	const { t } = useI18n();
	const [copied, setCopied] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	const onCopy = () => {
		void copyToClipboard(word);
		setCopied(true);
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => setCopied(false), 1000);
	};

	return (
		<div className="flex flex-col">
			<div className="flex items-center gap-1.5">
				<span className="text-textcolor text-lg leading-7">{word}</span>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className={cn(
						'size-6 shrink-0 rounded-md p-0 shadow-none',
						'focus-visible:border-transparent focus-visible:ring-0',
						playing ? 'text-teal-500' : 'text-textcolor/55 hover:text-teal-400',
					)}
					aria-label={playing ? stopLabel : playLabel}
					onClick={onPlay}
				>
					{playing ? (
						<Square className="size-3.5 fill-current" aria-hidden />
					) : (
						<Volume2 className="size-3.5" aria-hidden />
					)}
				</Button>
				{copy ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className={cn(
							'size-6 shrink-0 rounded-md p-0 shadow-none',
							'focus-visible:border-transparent focus-visible:ring-0',
							copied
								? 'text-teal-400'
								: 'text-textcolor/55 hover:text-textcolor',
						)}
						aria-label={copied ? t('common.copied') : t('common.copy')}
						onClick={onCopy}
					>
						{copied ? (
							<CheckCircle className="size-3.5" aria-hidden />
						) : (
							<Copy className="size-3.5" aria-hidden />
						)}
					</Button>
				) : null}
			</div>
			<span className="text-textcolor/80 text-sm leading-7">{zh}</span>
		</div>
	);
}
