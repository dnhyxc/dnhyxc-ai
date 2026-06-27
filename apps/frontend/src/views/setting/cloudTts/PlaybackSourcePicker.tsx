import { Label } from '@ui/label';
import { RadioGroup, RadioGroupItem } from '@ui/radio-group';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { TtsPlaybackSource } from '@/service/cloudTtsSettings';

const SOURCES: TtsPlaybackSource[] = ['local', 'cloud', 'xfyun'];

export function PlaybackSourcePicker({
	value,
	onChange,
	disabled,
}: {
	value: TtsPlaybackSource;
	onChange: (source: TtsPlaybackSource) => void;
	disabled?: boolean;
}) {
	const { t } = useI18n();

	return (
		<div className={cn('w-full', disabled && 'pointer-events-none opacity-50')}>
			<div className="text-md font-bold">
				{t('setting.cloudTts.playbackSourceTitle')}
			</div>
			<div className="my-2 px-8.5 text-xs text-textcolor/55">
				{t('setting.cloudTts.playbackSourceHelp')}
			</div>
			<RadioGroup
				value={value}
				onValueChange={(next) => onChange(next as TtsPlaybackSource)}
				className="mt-3.5 flex flex-col gap-3 px-8.5 text-sm"
			>
				{SOURCES.map((source) => {
					const id = `tts-playback-${source}`;
					return (
						<div key={source} className="flex items-start gap-2">
							<RadioGroupItem id={id} value={source} className="mt-0.5" />
							<div className="min-w-0 flex-1">
								<Label
									htmlFor={id}
									className="cursor-pointer text-sm font-medium"
								>
									{t(`setting.cloudTts.playbackSource.${source}`)}
								</Label>
								<p className="mt-1 text-xs text-textcolor/55">
									{t(`setting.cloudTts.playbackSourceHelp.${source}`)}
								</p>
							</div>
						</div>
					);
				})}
			</RadioGroup>
		</div>
	);
}
