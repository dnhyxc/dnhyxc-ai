import { Check, Palette } from 'lucide-react';
import type { ReactNode } from 'react';
import { ColorPicker } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { EpubHighlightColorId, EpubHighlightStyle } from '../../types';
import {
	customHighlightFillAlpha,
	customHighlightStroke,
	EPUB_HIGHLIGHT_COLOR_OPTIONS,
	formatCustomHighlightColor,
	isCustomHighlightColor,
	loadEpubHighlightCustomColor,
	saveEpubHighlightCustomColor,
} from '../../utils/epub/mark/epubUserHighlights';
import { epubReaderChromeBorderColorClass } from '../../utils/epub/reader/epubReaderSettings';

export type EpubHighlightStyleBarLabels = {
	styleHighlight: string;
	styleUnderline: string;
	styleWavy: string;
	colorPrefix: string;
	customColor: string;
};

type Props = {
	style: EpubHighlightStyle;
	color: EpubHighlightColorId;
	onStyleChange: (style: EpubHighlightStyle) => void;
	onColorChange: (color: EpubHighlightColorId) => void;
	labels: EpubHighlightStyleBarLabels;
};

const STYLE_OPTIONS: {
	id: EpubHighlightStyle;
	labelKey: Exclude<
		keyof EpubHighlightStyleBarLabels,
		'colorPrefix' | 'customColor'
	>;
	render: (active: boolean) => ReactNode;
}[] = [
	{
		id: 'highlight',
		labelKey: 'styleHighlight',
		render: (active) => (
			<span
				className={cn(
					'flex size-5 items-center justify-center rounded-[3px] text-[11px] font-bold leading-none',
					active
						? 'bg-pink-400/80 text-white'
						: 'bg-textcolor/15 text-textcolor/80',
				)}
			>
				A
			</span>
		),
	},
	{
		id: 'underline',
		labelKey: 'styleUnderline',
		render: (active) => (
			<span
				className={cn(
					'flex flex-col items-center text-[11px] font-bold leading-none',
					active ? 'text-teal-500' : 'text-textcolor/80',
				)}
			>
				A
				<span
					className={cn(
						'mt-0.5 h-px w-3.5',
						active ? 'bg-teal-500' : 'bg-textcolor/50',
					)}
				/>
			</span>
		),
	},
	{
		id: 'wavy',
		labelKey: 'styleWavy',
		render: (active) => (
			<span
				className={cn(
					'flex flex-col items-center text-[11px] font-bold leading-none',
					active ? 'text-teal-500' : 'text-textcolor/80',
				)}
			>
				A
				<svg
					aria-hidden
					className={cn(
						'mt-0.5',
						active ? 'text-teal-500' : 'text-textcolor/50',
					)}
					width="16"
					height="5"
					viewBox="0 0 16 5"
				>
					<title>Wavy underline</title>
					<path
						d="M0 2.5 C2 1.6 6 3.4 8 2.5 S14 1.6 16 2.5"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.2"
					/>
				</svg>
			</span>
		),
	},
];

/** PopBar 顶栏：左侧划线样式、右侧颜色 */
export function EpubHighlightStyleBar({
	style,
	color,
	onStyleChange,
	onColorChange,
	labels,
}: Props) {
	const lastCustom = loadEpubHighlightCustomColor();
	const customSwatch = isCustomHighlightColor(color)
		? customHighlightStroke(color)
		: customHighlightStroke(lastCustom);
	const pickerAlpha = isCustomHighlightColor(color)
		? customHighlightFillAlpha(color)
		: customHighlightFillAlpha(lastCustom);
	const customActive = isCustomHighlightColor(color);

	return (
		<div
			className={cn(
				'flex items-center justify-between gap-3 border-b px-2 py-1.5',
				epubReaderChromeBorderColorClass,
			)}
		>
			<div className="flex items-center gap-1">
				{STYLE_OPTIONS.map((option) => {
					const active = style === option.id;
					return (
						<button
							key={option.id}
							type="button"
							aria-label={labels[option.labelKey]}
							title={labels[option.labelKey]}
							onClick={() => onStyleChange(option.id)}
							className={cn(
								'flex size-7 items-center justify-center rounded-md transition-colors',
								active
									? 'bg-textcolor/10 ring-1 ring-teal-500/40'
									: 'hover:bg-textcolor/8',
							)}
						>
							{option.render(active)}
						</button>
					);
				})}
			</div>
			<div className="flex items-center gap-1.5">
				{EPUB_HIGHLIGHT_COLOR_OPTIONS.map((option) => {
					const active = color === option.id;
					return (
						<button
							key={option.id}
							type="button"
							aria-label={`${labels.colorPrefix} ${option.id}`}
							title={`${labels.colorPrefix} ${option.id}`}
							onClick={() => onColorChange(option.id)}
							className={cn(
								'relative flex size-5 items-center justify-center rounded-full transition-transform',
								active &&
									'scale-110 ring-2 ring-teal-500/50 ring-offset-1 ring-offset-transparent',
							)}
							style={{ backgroundColor: option.stroke }}
						>
							{active ? (
								<Check
									className="size-3 text-white"
									strokeWidth={3}
									aria-hidden
								/>
							) : null}
						</button>
					);
				})}
				<ColorPicker
					value={customSwatch}
					alpha={pickerAlpha}
					size="sm"
					onChange={(hex, { alpha }) => {
						const next = formatCustomHighlightColor(hex, alpha);
						saveEpubHighlightCustomColor(next);
						if (next !== color.toLowerCase()) {
							onColorChange(next);
						}
					}}
				>
					<button
						type="button"
						aria-label={labels.customColor}
						title={labels.customColor}
						className={cn(
							'relative flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full border-0 p-0 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50',
							customActive &&
								'scale-110 ring-2 ring-teal-500/50 ring-offset-1 ring-offset-transparent',
						)}
						style={
							customActive
								? { backgroundColor: customHighlightStroke(color) }
								: {
										backgroundColor: 'transparent',
										backgroundImage:
											'conic-gradient(from 0deg, #ff6b81, #9b59b6, #78bfff, #96c24e, #ffdc6a, #ff6b81)',
									}
						}
					>
						{customActive ? (
							<Check
								className="size-3 text-white"
								strokeWidth={3}
								aria-hidden
							/>
						) : (
							<Palette
								className="size-3 text-white drop-shadow-sm"
								aria-hidden
							/>
						)}
					</button>
				</ColorPicker>
			</div>
		</div>
	);
}
