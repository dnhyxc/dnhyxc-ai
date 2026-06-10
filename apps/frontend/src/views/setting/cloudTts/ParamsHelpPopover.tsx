/**
 * 朗读参数标题旁：点击展示各字段说明
 */
import { Popover, PopoverContent, PopoverTrigger } from '@ui/index';
import { ScrollArea } from '@ui/scroll-area';
import { CircleHelp } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';

const FIELD_HELP = [
	{ label: 'setting.cloudTts.model', help: 'setting.cloudTts.fieldHelp.model' },
	{
		label: 'setting.cloudTts.voiceId',
		help: 'setting.cloudTts.fieldHelp.voiceId',
	},
	{ label: 'setting.cloudTts.speed', help: 'setting.cloudTts.fieldHelp.speed' },
	{ label: 'setting.cloudTts.vol', help: 'setting.cloudTts.fieldHelp.vol' },
	{ label: 'setting.cloudTts.pitch', help: 'setting.cloudTts.fieldHelp.pitch' },
	{
		label: 'setting.cloudTts.emotion',
		help: 'setting.cloudTts.fieldHelp.emotionIntro',
	},
	{
		label: 'setting.cloudTts.format',
		help: 'setting.cloudTts.fieldHelp.format',
	},
	{
		label: 'setting.cloudTts.languageBoost',
		help: 'setting.cloudTts.fieldHelp.languageBoost',
	},
	{
		label: 'setting.cloudTts.sampleRate',
		help: 'setting.cloudTts.fieldHelp.sampleRate',
	},
	{
		label: 'setting.cloudTts.bitrate',
		help: 'setting.cloudTts.fieldHelp.bitrate',
	},
	{
		label: 'setting.cloudTts.channel',
		help: 'setting.cloudTts.fieldHelp.channel',
	},
] as const;

export function ParamsHelpPopover() {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);

	const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
		event.stopPropagation();
		event.currentTarget.scrollTop += event.deltaY;
	}, []);

	const handleWheelCapture = useCallback(
		(event: React.WheelEvent<HTMLDivElement>) => {
			event.stopPropagation();
		},
		[],
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						'inline-flex mt-px size-6 shrink-0 cursor-pointer items-center justify-center rounded-full',
						'text-textcolor/45 transition-colors hover:bg-theme/10 hover:text-textcolor/70',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/30',
						open && 'bg-theme/10 text-textcolor/70',
					)}
					aria-label={t('setting.cloudTts.paramsHelpAria')}
					aria-expanded={open}
				>
					<CircleHelp className="size-4" aria-hidden />
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				side="bottom"
				className="w-[min(100vw-2rem,29rem)] overflow-hidden p-0"
			>
				<ScrollArea
					className="max-h-80 w-full"
					viewportClassName="max-h-80 [&>div]:min-h-0!"
					onWheel={handleWheel}
					onWheelCapture={handleWheelCapture}
				>
					<div className="p-3">
						<p className="text-sm font-medium text-textcolor">
							{t('setting.cloudTts.paramsHelpTitle')}
						</p>
						<dl className="mt-2.5 space-y-3">
							{FIELD_HELP.map(({ label, help }) => (
								<div key={label}>
									<dt className="text-sm font-medium text-textcolor">
										{t(label)}
									</dt>
									<dd className="mt-1 ml-0 pl-0 text-xs leading-relaxed text-textcolor/65">
										<p>{t(help)}</p>
									</dd>
								</div>
							))}
						</dl>
					</div>
				</ScrollArea>
			</PopoverContent>
		</Popover>
	);
}
