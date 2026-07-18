import {
	type CSSProperties,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from './select';

export type Rgb = { r: number; g: number; b: number };

type Hsv = { h: number; s: number; v: number };

function clamp(n: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, n));
}

export function hexToRgb(hex: string): Rgb | null {
	const m = /^#?([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?$/.exec(hex.trim());
	if (!m) return null;
	const n = Number.parseInt(m[1]!, 16);
	return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function parseRgbaString(value: string): { rgb: Rgb; alpha: number } | null {
	const m =
		/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(
			value.trim(),
		);
	if (!m) return null;
	return {
		rgb: {
			r: clamp(Number.parseInt(m[1]!, 10), 0, 255),
			g: clamp(Number.parseInt(m[2]!, 10), 0, 255),
			b: clamp(Number.parseInt(m[3]!, 10), 0, 255),
		},
		alpha: Math.round(clamp(Number.parseFloat(m[4] ?? '1'), 0, 1) * 100),
	};
}

function parseColorString(value: string): { rgb: Rgb; alpha: number } | null {
	const rgba = parseRgbaString(value);
	if (rgba) return rgba;
	const hex = hexToRgb(value);
	if (!hex) return null;
	const m = /^#?([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/i.exec(value.trim());
	const alpha = m ? Math.round((Number.parseInt(m[2]!, 16) / 255) * 100) : 100;
	return { rgb: hex, alpha };
}

export function rgbToHex({ r, g, b }: Rgb): string {
	return `#${[r, g, b]
		.map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, '0'))
		.join('')}`;
}

function rgbToHsv(r: number, g: number, b: number): Hsv {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const d = max - min;
	let h = 0;
	if (d !== 0) {
		if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
		else if (max === gn) h = ((bn - rn) / d + 2) * 60;
		else h = ((rn - gn) / d + 4) * 60;
	}
	const s = max === 0 ? 0 : d / max;
	return { h, s: s * 100, v: max * 100 };
}

function hsvToRgb(h: number, s: number, v: number): Rgb {
	const sn = clamp(s, 0, 100) / 100;
	const vn = clamp(v, 0, 100) / 100;
	const c = vn * sn;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = vn - c;
	let rp = 0;
	let gp = 0;
	let bp = 0;
	if (h < 60) {
		rp = c;
		gp = x;
	} else if (h < 120) {
		rp = x;
		gp = c;
	} else if (h < 180) {
		gp = c;
		bp = x;
	} else if (h < 240) {
		gp = x;
		bp = c;
	} else if (h < 300) {
		rp = x;
		bp = c;
	} else {
		rp = c;
		bp = x;
	}
	return {
		r: Math.round((rp + m) * 255),
		g: Math.round((gp + m) * 255),
		b: Math.round((bp + m) * 255),
	};
}

function toRgbaString(rgb: Rgb, alpha: number): string {
	const a = clamp(alpha, 0, 100) / 100;
	return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

const alphaCheckerStyle: CSSProperties = {
	backgroundColor: 'var(--color-theme-background, #fff)',
	backgroundImage: [
		'linear-gradient(45deg, color-mix(in oklch, var(--color-textcolor, #000) 9%, transparent) 25%, transparent 25%)',
		'linear-gradient(-45deg, color-mix(in oklch, var(--color-textcolor, #000) 9%, transparent) 25%, transparent 25%)',
		'linear-gradient(45deg, transparent 75%, color-mix(in oklch, var(--color-textcolor, #000) 9%, transparent) 75%)',
		'linear-gradient(-45deg, transparent 75%, color-mix(in oklch, var(--color-textcolor, #000) 9%, transparent) 75%)',
	].join(', '),
	backgroundSize: '6px 6px',
	backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0',
};

export type ColorPickerFormat = 'hex' | 'rgb';

export type ColorPickerProps = {
	value?: string;
	defaultValue?: string;
	/** 受控透明度 0–100；与 `value` 的 hex/rgba 分离，便于 EPUB 划线仅存 hex */
	alpha?: number;
	onChange?: (
		color: string,
		detail: { hex: string; rgb: Rgb; alpha: number },
	) => void;
	disabled?: boolean;
	showAlpha?: boolean;
	size?: 'default' | 'sm';
	className?: string;
	triggerClassName?: string;
	children?: ReactNode;
};

type ColorState = { rgb: Rgb; alpha: number; h: number };

const sliderThumbClass =
	'pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.2)]';

function AlphaCheckerSurface({
	className,
	style,
	children,
}: {
	className?: string;
	style?: CSSProperties;
	children?: ReactNode;
}) {
	return (
		<div
			className={cn('relative overflow-hidden', className)}
			style={{ ...alphaCheckerStyle, ...style }}
		>
			{children}
		</div>
	);
}

function defaultState(hex = '#43860c'): ColorState {
	const rgb = hexToRgb(hex) ?? { r: 67, g: 134, b: 12 };
	const { h } = rgbToHsv(rgb.r, rgb.g, rgb.b);
	return { rgb, alpha: 100, h };
}

function stateFromValue(value: string, fallbackAlpha = 100): ColorState {
	const parsed = parseColorString(value);
	if (!parsed) return defaultState();
	const { h } = rgbToHsv(parsed.rgb.r, parsed.rgb.g, parsed.rgb.b);
	return { rgb: parsed.rgb, alpha: parsed.alpha ?? fallbackAlpha, h };
}

function useDrag(
	onMove: (clientX: number, clientY: number) => void,
	onEnd?: () => void,
) {
	return useCallback(
		(e: React.PointerEvent<HTMLElement>) => {
			const el = e.currentTarget;
			el.setPointerCapture(e.pointerId);
			const move = (ev: PointerEvent) => onMove(ev.clientX, ev.clientY);
			const up = () => {
				el.releasePointerCapture(e.pointerId);
				window.removeEventListener('pointermove', move);
				window.removeEventListener('pointerup', up);
				onEnd?.();
			};
			onMove(e.clientX, e.clientY);
			window.addEventListener('pointermove', move);
			window.addEventListener('pointerup', up);
		},
		[onMove, onEnd],
	);
}

function useSliderDrag(
	trackRef: React.RefObject<HTMLElement | null>,
	onRatio: (ratio: number) => void,
	onEnd?: () => void,
) {
	return useDrag((clientX) => {
		const track = trackRef.current;
		if (!track) return;
		const rect = track.getBoundingClientRect();
		onRatio(clamp((clientX - rect.left) / rect.width, 0, 1));
	}, onEnd);
}

function ColorPickerPanel({
	state,
	setState,
	showAlpha,
	onChangeComplete,
}: {
	state: ColorState;
	setState: React.Dispatch<React.SetStateAction<ColorState>>;
	showAlpha: boolean;
	onChangeComplete: (next: ColorState) => void;
}) {
	const [format, setFormat] = useState<ColorPickerFormat>('rgb');
	const satRef = useRef<HTMLDivElement>(null);
	const hueRef = useRef<HTMLDivElement>(null);
	const alphaRef = useRef<HTMLDivElement>(null);
	const stateRef = useRef(state);
	stateRef.current = state;

	const hsv = rgbToHsv(state.rgb.r, state.rgb.g, state.rgb.b);
	const hueColor = hsvToRgb(state.h, 100, 100);
	const hueHex = rgbToHex(hueColor);
	const previewColor = toRgbaString(state.rgb, state.alpha);
	const satX = `${hsv.s}%`;
	const satY = `${100 - hsv.v}%`;

	const emit = useCallback(
		(next: ColorState) => {
			setState(next);
			onChangeComplete(next);
		},
		[onChangeComplete, setState],
	);

	const applyPreview = useCallback((next: ColorState) => {
		setState(next);
	}, []);

	const commitCurrent = useCallback(() => {
		onChangeComplete(stateRef.current);
	}, [onChangeComplete]);

	const onSatMove = useCallback(
		(clientX: number, clientY: number) => {
			const el = satRef.current;
			if (!el) return;
			const rect = el.getBoundingClientRect();
			const s = clamp((clientX - rect.left) / rect.width, 0, 1) * 100;
			const v = (1 - clamp((clientY - rect.top) / rect.height, 0, 1)) * 100;
			const prev = stateRef.current;
			const rgb = hsvToRgb(prev.h, s, v);
			applyPreview({ ...prev, rgb });
		},
		[applyPreview],
	);

	const onHueRatio = useCallback(
		(ratio: number) => {
			const prev = stateRef.current;
			const h = ratio * 360;
			const { s, v } = rgbToHsv(prev.rgb.r, prev.rgb.g, prev.rgb.b);
			const rgb = hsvToRgb(h, s, v);
			applyPreview({ rgb, alpha: prev.alpha, h });
		},
		[applyPreview],
	);

	const onAlphaRatio = useCallback(
		(ratio: number) => {
			const prev = stateRef.current;
			applyPreview({ ...prev, alpha: Math.round(ratio * 100) });
		},
		[applyPreview],
	);

	const satDrag = useDrag(onSatMove, commitCurrent);
	const hueDrag = useSliderDrag(hueRef, onHueRatio, commitCurrent);
	const alphaDrag = useSliderDrag(alphaRef, onAlphaRatio, commitCurrent);

	const fieldFocusClass =
		'focus:border-theme/40 focus:ring-2 focus:ring-theme/20 focus-visible:border-theme/40 focus-visible:ring-2 focus-visible:ring-theme/20';

	const inputClass = cn(
		'h-7 w-full min-w-0 rounded border border-theme/15 bg-theme-background px-2 text-center text-xs text-textcolor tabular-nums outline-none',
		fieldFocusClass,
	);

	const patchRgbPreview = (key: keyof Rgb, raw: string) => {
		const n = clamp(Number.parseInt(raw, 10) || 0, 0, 255);
		const rgb = { ...state.rgb, [key]: n };
		const { h } = rgbToHsv(rgb.r, rgb.g, rgb.b);
		applyPreview({ rgb, alpha: state.alpha, h });
	};

	const commitFromInputs = () => {
		emit(stateRef.current);
	};

	return (
		<div className="w-[280px]">
			<div className="select-none">
				<div
					ref={satRef}
					className="relative h-[180px] w-full cursor-crosshair touch-none overflow-hidden rounded-sm"
					style={{
						background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueHex})`,
					}}
					onPointerDown={satDrag}
				>
					<div
						className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
						style={{ left: satX, top: satY }}
					/>
				</div>

				<div className="mt-3 flex items-center gap-3">
					<div className="min-w-0 flex-1 space-y-2">
						<div
							ref={hueRef}
							className="relative h-3 cursor-pointer touch-none rounded-full"
							style={{
								background:
									'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
							}}
							onPointerDown={hueDrag}
						>
							<div
								className={sliderThumbClass}
								style={{
									left: `${(state.h / 360) * 100}%`,
									backgroundColor: hueHex,
								}}
							/>
						</div>
						{showAlpha ? (
							<div
								ref={alphaRef}
								className="relative h-3 cursor-pointer touch-none rounded-full ring-1 ring-inset ring-textcolor/10"
								onPointerDown={alphaDrag}
							>
								<AlphaCheckerSurface className="absolute inset-0 rounded-full" />
								<div
									className="pointer-events-none absolute inset-0 rounded-full"
									style={{
										background: `linear-gradient(to right, rgba(${state.rgb.r},${state.rgb.g},${state.rgb.b},0), rgba(${state.rgb.r},${state.rgb.g},${state.rgb.b},1))`,
									}}
								/>
								<div
									className={sliderThumbClass}
									style={{
										left: `${state.alpha}%`,
										backgroundColor: previewColor,
									}}
								/>
							</div>
						) : null}
					</div>
					<AlphaCheckerSurface className="size-9 shrink-0 rounded-lg ring-1 ring-textcolor/10 shadow-sm">
						<div
							className="absolute inset-0"
							style={{ backgroundColor: previewColor }}
						/>
					</AlphaCheckerSurface>
				</div>
			</div>

			<div
				className="mt-3 flex select-text items-center gap-2"
				onMouseDown={(e) => e.stopPropagation()}
				onPointerDown={(e) => e.stopPropagation()}
			>
				<Select
					value={format}
					onValueChange={(v) => setFormat(v as ColorPickerFormat)}
				>
					<SelectTrigger
						size="sm"
						className={cn(
							inputClass,
							'flex w-[72px] data-[size=sm]:h-7 items-center justify-between px-2 text-left shadow-none [box-shadow:none]',
							'focus:border-theme/15 focus:ring-0',
							'data-[state=open]:border-theme/40 data-[state=open]:ring-2 data-[state=open]:ring-theme/20',
							'dark:bg-theme-background dark:hover:bg-theme-background',
						)}
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="hex">HEX</SelectItem>
						<SelectItem value="rgb">RGB</SelectItem>
					</SelectContent>
				</Select>
				{format === 'rgb' ? (
					<>
						<input
							type="text"
							inputMode="numeric"
							className={cn(inputClass, 'w-12')}
							value={state.rgb.r}
							onChange={(e) => patchRgbPreview('r', e.target.value)}
							onBlur={commitFromInputs}
							onKeyDown={(e) => {
								if (e.key === 'Enter') commitFromInputs();
							}}
						/>
						<input
							type="text"
							inputMode="numeric"
							className={cn(inputClass, 'w-12')}
							value={state.rgb.g}
							onChange={(e) => patchRgbPreview('g', e.target.value)}
							onBlur={commitFromInputs}
							onKeyDown={(e) => {
								if (e.key === 'Enter') commitFromInputs();
							}}
						/>
						<input
							type="text"
							inputMode="numeric"
							className={cn(inputClass, 'w-12')}
							value={state.rgb.b}
							onChange={(e) => patchRgbPreview('b', e.target.value)}
							onBlur={commitFromInputs}
							onKeyDown={(e) => {
								if (e.key === 'Enter') commitFromInputs();
							}}
						/>
					</>
				) : (
					<input
						type="text"
						className={cn(inputClass, 'flex-1 uppercase')}
						value={rgbToHex(state.rgb)}
						onChange={(e) => {
							const parsed = hexToRgb(e.target.value);
							if (!parsed) return;
							const { h } = rgbToHsv(parsed.r, parsed.g, parsed.b);
							applyPreview({ rgb: parsed, alpha: state.alpha, h });
						}}
						onBlur={commitFromInputs}
						onKeyDown={(e) => {
							if (e.key === 'Enter') commitFromInputs();
						}}
					/>
				)}
				{showAlpha ? (
					<div className="relative w-14">
						<input
							type="text"
							inputMode="numeric"
							className={cn(inputClass, 'pr-5')}
							value={state.alpha}
							onChange={(e) => {
								const alpha = clamp(
									Number.parseInt(e.target.value, 10) || 0,
									0,
									100,
								);
								applyPreview({ ...stateRef.current, alpha });
							}}
							onBlur={commitFromInputs}
							onKeyDown={(e) => {
								if (e.key === 'Enter') commitFromInputs();
							}}
						/>
						<span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-textcolor/50">
							%
						</span>
					</div>
				) : null}
			</div>
		</div>
	);
}

export function ColorPicker({
	value,
	defaultValue = '#43860c',
	alpha: alphaProp,
	onChange,
	disabled,
	showAlpha = true,
	size = 'default',
	className,
	triggerClassName,
	children,
}: ColorPickerProps) {
	const [open, setOpen] = useState(false);
	const [state, setState] = useState(() =>
		stateFromValue(value ?? defaultValue, alphaProp ?? 100),
	);

	useEffect(() => {
		if (value === undefined) return;
		const parsed = parseColorString(value);
		if (!parsed) return;
		setState((prev) => {
			const { h } = rgbToHsv(parsed.rgb.r, parsed.rgb.g, parsed.rgb.b);
			const nextAlpha = alphaProp ?? parsed.alpha;
			if (
				prev.rgb.r === parsed.rgb.r &&
				prev.rgb.g === parsed.rgb.g &&
				prev.rgb.b === parsed.rgb.b &&
				prev.alpha === nextAlpha
			) {
				return prev;
			}
			return { rgb: parsed.rgb, alpha: nextAlpha, h };
		});
	}, [value, alphaProp]);

	const preview = useMemo(
		() => toRgbaString(state.rgb, showAlpha ? state.alpha : 100),
		[state.rgb, state.alpha, showAlpha],
	);

	const emitChange = useCallback(
		(next: ColorState) => {
			const hex = rgbToHex(next.rgb);
			onChange?.(hex, {
				hex,
				rgb: next.rgb,
				alpha: showAlpha ? next.alpha : 100,
			});
		},
		[onChange, showAlpha],
	);

	const triggerSize =
		size === 'sm' ? 'size-5 rounded-full' : 'size-7 rounded-md';

	const trigger = children ?? (
		<button
			type="button"
			disabled={disabled}
			className={cn(
				'border border-theme/20 shadow-xs transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-theme/40',
				triggerSize,
				triggerClassName,
			)}
			style={{ backgroundColor: preview } as CSSProperties}
			aria-label="Color picker"
		/>
	);

	return (
		<Popover modal={false} open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild disabled={disabled}>
				{trigger}
			</PopoverTrigger>
			<PopoverContent
				align="start"
				sideOffset={8}
				className={cn('w-auto border-theme/10 p-3 shadow-lg', className)}
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<ColorPickerPanel
					state={state}
					setState={setState}
					showAlpha={showAlpha}
					onChangeComplete={emitChange}
				/>
			</PopoverContent>
		</Popover>
	);
}
