import { displayIpaWrapped } from '@/utils';
import { DictationPlayButton } from '../../practice/components/prompt/DictationPrompt';

type DailyQuizWordBarProps = {
	word: string;
	ipa?: string;
	pos?: string;
	playing: boolean;
	playLabel: string;
	onPlay: () => void;
};

export function DailyQuizWordBar({
	word,
	ipa,
	pos,
	playing,
	playLabel,
	onPlay,
}: DailyQuizWordBarProps) {
	const posText = pos?.trim();
	const ipaText = ipa?.trim();

	return (
		<div className="flex w-full min-w-0 items-center gap-3 text-left">
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
					<span className="text-textcolor text-2xl font-semibold leading-snug">
						{word}
					</span>
					{posText ? (
						<span className="text-textcolor/50 text-sm leading-snug">
							{posText}
						</span>
					) : null}
				</div>
				{ipaText ? (
					<p className="font-mono text-sm leading-snug text-teal-600/85 dark:text-teal-400/85">
						{displayIpaWrapped(ipaText)}
					</p>
				) : null}
			</div>
			<div className="shrink-0 self-center">
				<DictationPlayButton
					playing={playing}
					playLabel={playLabel}
					onPlay={onPlay}
					size="strip"
				/>
			</div>
		</div>
	);
}
