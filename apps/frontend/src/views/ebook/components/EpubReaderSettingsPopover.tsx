import {
	Button,
	Label,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ui/index';
import { Bolt } from 'lucide-react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	type EpubReaderBgTheme,
	type EpubReaderPageFlow,
	type EpubReaderSettings,
	type EpubReaderTextColor,
} from '../utils/epubReaderSettings';

export type EpubReaderSettingsPopoverProps = {
	settings: EpubReaderSettings;
	onChange: (patch: Partial<EpubReaderSettings>) => void;
	onReset: () => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	disabled?: boolean;
};

export function EpubReaderSettingsPopover({
	settings,
	onChange,
	onReset,
	open,
	onOpenChange,
	disabled,
}: EpubReaderSettingsPopoverProps) {
	const { t } = useI18n();

	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className={cn(
						'text-textcolor/80',
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
				className="w-72 p-4"
			>
				<div className="flex flex-col gap-4">
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
							onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label className="text-xs">
							{t('ebook.read.settings.pageFlow')}
						</Label>
						<Select
							value={settings.pageFlow}
							onValueChange={(value) =>
								onChange({ pageFlow: value as EpubReaderPageFlow })
							}
						>
							<SelectTrigger size="sm" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="paginated">
									{t('ebook.read.settings.pageFlow.paginated')}
								</SelectItem>
								<SelectItem value="scrolled">
									{t('ebook.read.settings.pageFlow.scrolled')}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label className="text-xs">
							{t('ebook.read.settings.textColor')}
						</Label>
						<Select
							value={settings.textColor}
							onValueChange={(value) =>
								onChange({
									textColor: value as EpubReaderTextColor,
								})
							}
						>
							<SelectTrigger size="sm" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="auto">
									{t('ebook.read.settings.textColor.auto')}
								</SelectItem>
								<SelectItem value="dark">
									{t('ebook.read.settings.textColor.dark')}
								</SelectItem>
								<SelectItem value="light">
									{t('ebook.read.settings.textColor.light')}
								</SelectItem>
								<SelectItem value="sepia">
									{t('ebook.read.settings.textColor.sepia')}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label className="text-xs">
							{t('ebook.read.settings.bgTheme')}
						</Label>
						<Select
							value={settings.bgTheme}
							onValueChange={(value) =>
								onChange({ bgTheme: value as EpubReaderBgTheme })
							}
						>
							<SelectTrigger size="sm" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default">
									{t('ebook.read.settings.bgTheme.default')}
								</SelectItem>
								<SelectItem value="paper">
									{t('ebook.read.settings.bgTheme.paper')}
								</SelectItem>
								<SelectItem value="dark">
									{t('ebook.read.settings.bgTheme.dark')}
								</SelectItem>
								<SelectItem value="sepia">
									{t('ebook.read.settings.bgTheme.sepia')}
								</SelectItem>
								<SelectItem value="green">
									{t('ebook.read.settings.bgTheme.green')}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<Button
						type="button"
						variant="secondary"
						size="sm"
						className="w-full"
						onClick={onReset}
					>
						{t('ebook.read.settings.reset')}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
