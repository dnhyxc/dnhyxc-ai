import {
	Button,
	Label,
	Popover,
	PopoverContent,
	PopoverTrigger,
	ScrollArea,
} from '@ui/index';
import { Bolt, GalleryHorizontal, type LucideIcon, Scroll } from 'lucide-react';
import { useCallback } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	EPUB_BG_THEME_OPTIONS,
	EPUB_TEXT_COLOR_OPTIONS,
	type EpubReaderBgTheme,
	type EpubReaderPageFlow,
	type EpubReaderSettings,
	type EpubReaderTextColor,
	epubReaderSurfaceBgClass,
	epubReaderSurfaceMutedClass,
	getEpubReaderSurfaceCssVars,
	resolveEpubReaderSurfaceBackground,
} from '../utils/epubReaderSettings';

export type EpubReaderSettingsPopoverProps = {
	settings: EpubReaderSettings;
	onChange: (patch: Partial<EpubReaderSettings>) => void;
	onReset: () => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	disabled?: boolean;
};

function BgThemeSwatches({
	value,
	onChange,
}: {
	value: EpubReaderBgTheme;
	onChange: (id: EpubReaderBgTheme) => void;
}) {
	const { t } = useI18n();

	return (
		<div className="grid grid-cols-6 gap-2">
			{EPUB_BG_THEME_OPTIONS.map((opt) => {
				const selected = value === opt.id;
				const label = t(`ebook.read.settings.bgTheme.${opt.id}`);
				return (
					<button
						key={opt.id}
						type="button"
						title={label}
						aria-label={label}
						aria-pressed={selected}
						className={cn(
							'cursor-pointer ring-theme/25 relative w-auto h-9 rounded-lg ring-1 transition',
							selected && 'ring-teal-600 ring-2',
							opt.id === 'default' &&
								'bg-theme-background from-theme/8 to-theme/20 bg-linear-to-br',
							opt.id === 'night' && 'ring-theme/40',
						)}
						style={opt.bgColor ? { backgroundColor: opt.bgColor } : undefined}
						onClick={() => onChange(opt.id)}
					>
						{opt.id === 'default' ? (
							<span className="text-textcolor/45 absolute inset-0 flex items-center justify-center text-[10px] font-medium">
								Aa
							</span>
						) : null}
					</button>
				);
			})}
		</div>
	);
}

function TextColorSwatches({
	value,
	onChange,
}: {
	value: EpubReaderTextColor;
	onChange: (id: EpubReaderTextColor) => void;
}) {
	const { t } = useI18n();

	return (
		<div className="grid grid-cols-6 gap-2">
			{EPUB_TEXT_COLOR_OPTIONS.map((opt) => {
				const selected = value === opt.id;
				const label = t(`ebook.read.settings.textColor.${opt.id}`);
				const isAuto = opt.id === 'auto';
				return (
					<button
						key={opt.id}
						type="button"
						title={label}
						aria-label={label}
						aria-pressed={selected}
						className={cn(
							'cursor-pointer ring-theme/25 bg-theme-background relative flex w-auto h-9 items-center justify-center rounded-lg ring-1 transition',
							selected && 'ring-teal-600 ring-2',
							isAuto && 'from-theme/8 to-theme/20 bg-linear-to-br',
						)}
						onClick={() => onChange(opt.id)}
					>
						<span
							className={cn('text-sm font-medium', isAuto && 'text-textcolor')}
							style={opt.color ? { color: opt.color } : undefined}
						>
							Aa
						</span>
					</button>
				);
			})}
		</div>
	);
}

const PAGE_FLOW_OPTIONS: {
	id: EpubReaderPageFlow;
	Icon: LucideIcon;
}[] = [
	{ id: 'scrolled', Icon: Scroll },
	{ id: 'paginated', Icon: GalleryHorizontal },
];

function PageFlowToggle({
	value,
	onChange,
}: {
	value: EpubReaderPageFlow;
	onChange: (id: EpubReaderPageFlow) => void;
}) {
	const { t } = useI18n();

	return (
		<div
			className={cn(
				'ring-theme/15 flex rounded-lg p-0.5 ring-1',
				epubReaderSurfaceMutedClass,
			)}
			role="group"
			aria-label={t('ebook.read.settings.pageFlow')}
		>
			{PAGE_FLOW_OPTIONS.map(({ id, Icon }) => {
				const selected = value === id;
				const label = t(`ebook.read.settings.pageFlow.${id}`);
				return (
					<button
						key={id}
						type="button"
						aria-pressed={selected}
						title={label}
						onClick={() => onChange(id)}
						className={cn(
							'cursor-pointer flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs transition',
							selected
								? cn(epubReaderSurfaceBgClass, 'text-textcolor shadow-sm')
								: 'text-textcolor/55 hover:text-textcolor/80',
						)}
					>
						<Icon className="size-3.5 shrink-0" aria-hidden />
						<span className="leading-tight">{label}</span>
					</button>
				);
			})}
		</div>
	);
}

export function EpubReaderSettingsPopover({
	settings,
	onChange,
	onReset,
	open,
	onOpenChange,
	disabled,
}: EpubReaderSettingsPopoverProps) {
	const { t } = useI18n();

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
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className={cn(
						'text-textcolor/80 hover:text-teal-500',
						open && 'bg-theme/10 text-textcolor',
					)}
					disabled={disabled}
					aria-label={t('ebook.read.settings')}
					aria-expanded={open}
				>
					<Bolt className="size-4" aria-hidden />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				side="bottom"
				sideOffset={8}
				className={cn(
					'w-80 overflow-hidden p-0 border-theme/10',
					epubReaderSurfaceBgClass,
				)}
				style={{
					...getEpubReaderSurfaceCssVars(settings.bgTheme),
					backgroundColor: resolveEpubReaderSurfaceBackground(settings.bgTheme),
				}}
			>
				<ScrollArea
					className="max-h-[min(85vh,33.78rem)] w-full"
					viewportClassName="max-h-[min(85vh,33.78rem)] [&>div]:min-h-0!"
					onWheel={handleWheel}
					onWheelCapture={handleWheelCapture}
				>
					<div className="flex flex-col gap-4 p-4 pt-3 pb-5">
						<p className="text-textcolor text-sm font-medium">
							{t('ebook.read.settings')}
						</p>

						<div className="flex flex-col gap-2">
							<div className="flex items-center justify-between gap-2">
								<Label htmlFor="epub-font-size" className="text-xs">
									{t('ebook.read.settings.fontSize')}
								</Label>
								<span className="text-textcolor/55 tabular-nums text-xs">
									{settings.fontSize}%
								</span>
							</div>
							<input
								id="epub-font-size"
								type="range"
								min={80}
								max={160}
								step={5}
								value={settings.fontSize}
								className="accent-teal-600 w-full"
								onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
							/>
						</div>

						<div className="flex flex-col gap-2">
							<div className="flex items-center justify-between gap-2">
								<Label htmlFor="epub-line-height" className="text-xs">
									{t('ebook.read.settings.lineHeight')}
								</Label>
								<span className="text-textcolor/55 tabular-nums text-xs">
									{settings.lineHeight.toFixed(1)}
								</span>
							</div>
							<input
								id="epub-line-height"
								type="range"
								min={1.2}
								max={2.4}
								step={0.1}
								value={settings.lineHeight}
								className="accent-teal-600 w-full"
								onChange={(e) =>
									onChange({ lineHeight: Number(e.target.value) })
								}
							/>
						</div>

						<div className="flex flex-col gap-3">
							<Label className="text-xs">
								{t('ebook.read.settings.pageFlow')}
							</Label>
							<PageFlowToggle
								value={settings.pageFlow}
								onChange={(pageFlow) => onChange({ pageFlow })}
							/>
						</div>

						<div className="flex flex-col gap-3">
							<Label className="text-xs">
								{t('ebook.read.settings.bgTheme')}
							</Label>
							<BgThemeSwatches
								value={settings.bgTheme}
								onChange={(bgTheme) => onChange({ bgTheme })}
							/>
							<p className="text-textcolor/50 text-[11px] leading-snug">
								{t(`ebook.read.settings.bgTheme.${settings.bgTheme}`)}
							</p>
						</div>

						<div className="flex flex-col gap-3">
							<Label className="text-xs">
								{t('ebook.read.settings.textColor')}
							</Label>
							<TextColorSwatches
								value={settings.textColor}
								onChange={(textColor) => onChange({ textColor })}
							/>
							<p className="text-textcolor/50 text-[11px] leading-snug">
								{t(`ebook.read.settings.textColor.${settings.textColor}`)}
							</p>
						</div>

						<Button
							type="button"
							variant="secondary"
							size="sm"
							className="w-full mt-0.5 text-white bg-teal-600 hover:bg-teal-500"
							onClick={onReset}
						>
							{t('ebook.read.settings.reset')}
						</Button>
					</div>
				</ScrollArea>
			</PopoverContent>
		</Popover>
	);
}
