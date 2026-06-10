/**
 * 设置 → 云端朗读：朗读参数（localStorage，随 englishTts 请求发送）
 */
import { Button } from '@ui/button';
import { Input, Label, Switch } from '@ui/index';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ui/select';
import { Minus, Plus, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	MINIMAX_TTS_AUDIO_FORMATS,
	MINIMAX_TTS_EMOTIONS,
	MINIMAX_TTS_ENGLISH_VOICES,
	MINIMAX_TTS_LANGUAGE_BOOST_VALUES,
	MINIMAX_TTS_MODELS,
} from '@/constants/minimaxTts';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import {
	DEFAULT_MINIMAX_TTS_USER_PREFS,
	loadMinimaxTtsUserPrefs,
	type MinimaxTtsUserPrefs,
	saveMinimaxTtsUserPrefs,
} from '@/utils/minimaxTtsPrefs';
import { ParamsHelpPopover } from './ParamsHelpPopover';

const EMOTION_NONE = '__none__';

const fieldInputClass =
	'flex-1 min-w-0 border border-theme/20 bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-theme/40';

function getFieldLabelClass(locale: string) {
	return locale === 'zh-CN'
		? 'shrink-0 inline-block w-[4em] whitespace-nowrap text-justify [text-align-last:justify]'
		: 'shrink-0 inline-block w-[5rem] whitespace-nowrap text-end';
}

const numberInputClass =
	'h-9 min-w-0 flex-1 border-0 bg-transparent px-3 shadow-none focus-visible:border-transparent focus-visible:ring-0 [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

const stepperButtonClass =
	'flex min-h-0 flex-1 w-9 cursor-pointer items-center justify-center text-textcolor/70 transition-colors hover:bg-theme/10 hover:text-textcolor disabled:cursor-not-allowed disabled:opacity-40';

function stepNumber(
	value: number,
	step: number,
	min: number,
	max: number,
	dir: 1 | -1,
) {
	const stepDecimals = (String(step).split('.')[1] ?? '').length;
	const next = Number((value + dir * step).toFixed(stepDecimals));
	if (!Number.isFinite(next)) return value;
	return Math.min(max, Math.max(min, next));
}

function NumberField({
	id,
	label,
	value,
	onChange,
	min,
	max,
	step,
	disabled,
	labelClassName,
}: {
	id: string;
	label: string;
	value: number;
	onChange: (n: number) => void;
	min: number;
	max: number;
	step: number;
	disabled?: boolean;
	labelClassName: string;
}) {
	const { t } = useI18n();
	const current = Number.isFinite(value) ? value : min;
	const atMin = current <= min;
	const atMax = current >= max;

	const bump = (dir: 1 | -1) => {
		onChange(stepNumber(current, step, min, max, dir));
	};

	return (
		<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
			<Label htmlFor={id} className={labelClassName}>
				{label}
			</Label>
			<div
				className={cn(
					'flex min-w-0 flex-1 overflow-hidden rounded-md border border-theme/20',
					'focus-within:border-theme/40',
					disabled && 'opacity-50',
				)}
			>
				<Input
					id={id}
					type="number"
					min={min}
					max={max}
					step={step}
					value={current}
					disabled={disabled}
					onChange={(e) => {
						const next = Number(e.target.value);
						if (Number.isFinite(next)) {
							onChange(Math.min(max, Math.max(min, next)));
						}
					}}
					className={numberInputClass}
				/>
				<div className="flex h-9 shrink-0 flex-col border-l border-theme/20">
					<button
						type="button"
						disabled={disabled || atMax}
						aria-label={t('setting.cloudTts.increaseValue', { label })}
						onClick={() => bump(1)}
						className={cn(stepperButtonClass, 'border-b border-theme/20')}
					>
						<Plus className="size-3.5" aria-hidden />
					</button>
					<button
						type="button"
						disabled={disabled || atMin}
						aria-label={t('setting.cloudTts.decreaseValue', { label })}
						onClick={() => bump(-1)}
						className={stepperButtonClass}
					>
						<Minus className="size-3.5" aria-hidden />
					</button>
				</div>
			</div>
		</div>
	);
}

function PrefSelectField({
	id,
	label,
	value,
	onValueChange,
	options,
	disabled,
	labelClassName,
}: {
	id: string;
	label: string;
	value: string;
	onValueChange: (value: string) => void;
	options: readonly { value: string; label: string }[];
	disabled?: boolean;
	labelClassName: string;
}) {
	return (
		<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
			<Label htmlFor={id} className={labelClassName}>
				{label}
			</Label>
			<div className="min-w-0 flex-1">
				<Select value={value} onValueChange={onValueChange} disabled={disabled}>
					<SelectTrigger id={id} className={cn(fieldInputClass, 'w-full')}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent position="popper">
						{options.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}

const CloudTtsSetting = () => {
	const { t, locale } = useI18n();
	const fieldLabelClass = useMemo(() => getFieldLabelClass(locale), [locale]);
	const [prefs, setPrefs] = useState<MinimaxTtsUserPrefs>(() =>
		loadMinimaxTtsUserPrefs(),
	);
	const [previewing, setPreviewing] = useState(false);

	useEffect(() => {
		saveMinimaxTtsUserPrefs(prefs);
	}, [prefs]);

	const patch = useCallback((partial: Partial<MinimaxTtsUserPrefs>) => {
		setPrefs((prev) => ({ ...prev, ...partial }));
	}, []);

	const modelOptions = useMemo(
		() => MINIMAX_TTS_MODELS.map((value) => ({ value, label: value })),
		[],
	);

	const voiceOptions = useMemo(
		() =>
			MINIMAX_TTS_ENGLISH_VOICES.map(({ id, name }) => ({
				value: id,
				label: `${name} · ${id}`,
			})),
		[],
	);

	const formatOptions = useMemo(
		() => MINIMAX_TTS_AUDIO_FORMATS.map((value) => ({ value, label: value })),
		[],
	);

	const emotionOptions = useMemo(
		() => [
			{
				value: EMOTION_NONE,
				label: t('setting.cloudTts.emotionNone'),
			},
			...MINIMAX_TTS_EMOTIONS.map((value) => ({
				value,
				label: t(`setting.cloudTts.emotion.${value}`),
			})),
		],
		[t],
	);

	const languageBoostOptions = useMemo(
		() =>
			MINIMAX_TTS_LANGUAGE_BOOST_VALUES.map((value) => ({
				value,
				label: t(`setting.cloudTts.languageBoostOption.${value}`),
			})),
		[t],
	);

	const onReset = () => {
		setPrefs({ ...DEFAULT_MINIMAX_TTS_USER_PREFS });
	};

	const onPreview = async () => {
		if (previewing) return;
		stopAllEnglishPlayback();
		setPreviewing(true);
		try {
			await playEnglishPreferred(t('setting.cloudTts.previewText'), {
				preferLocal: false,
			});
		} finally {
			setPreviewing(false);
		}
	};

	const fieldsDisabled = !prefs.enabled || previewing;

	return (
		<div className="m-2 mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center">
			<div className="w-full">
				<div className="w-full border-b border-theme/20 pb-4.5">
					<div className="text-md font-bold">{t('setting.cloudTts.title')}</div>
					<div className="my-2 px-8.5 text-xs text-textcolor/55">
						{t('setting.cloudTts.desc')}
					</div>

					<div className="mt-3.5 flex items-center justify-between gap-4 px-8.5 text-sm">
						<div className="min-w-0 flex-1">
							<Label
								htmlFor="cloud-tts-enabled"
								className="cursor-pointer text-sm font-medium"
							>
								{t('setting.cloudTts.enabledLabel')}
							</Label>
							<p className="mt-1 text-xs text-textcolor/55">
								{t('setting.cloudTts.enabledHelp')}
							</p>
						</div>
						<Switch
							id="cloud-tts-enabled"
							checked={prefs.enabled}
							onCheckedChange={(enabled) => patch({ enabled })}
						/>
					</div>
				</div>

				<div
					className={cn(
						'my-3.5 flex flex-col gap-4 px-8.5 text-sm',
						!prefs.enabled && 'pointer-events-none opacity-50',
					)}
				>
					<div className="flex items-center gap-1">
						<div className="text-md font-bold">
							{t('setting.cloudTts.paramsTitle')}
						</div>
						<ParamsHelpPopover />
					</div>
					<p className="text-xs text-textcolor/55">
						{t('setting.cloudTts.paramsDesc')}
					</p>

					<PrefSelectField
						id="cloud-tts-model"
						label={t('setting.cloudTts.model')}
						value={prefs.model}
						onValueChange={(model) => patch({ model })}
						options={modelOptions}
						disabled={fieldsDisabled}
						labelClassName={fieldLabelClass}
					/>

					<PrefSelectField
						id="cloud-tts-voice"
						label={t('setting.cloudTts.voiceId')}
						value={prefs.voiceId}
						onValueChange={(voiceId) => patch({ voiceId })}
						options={voiceOptions}
						disabled={fieldsDisabled}
						labelClassName={fieldLabelClass}
					/>

					<NumberField
						id="cloud-tts-speed"
						label={t('setting.cloudTts.speed')}
						value={prefs.speed}
						min={0.5}
						max={2}
						step={0.1}
						disabled={fieldsDisabled}
						labelClassName={fieldLabelClass}
						onChange={(speed) => patch({ speed })}
					/>
					<NumberField
						id="cloud-tts-vol"
						label={t('setting.cloudTts.vol')}
						value={prefs.vol}
						min={0.01}
						max={10}
						step={0.1}
						disabled={fieldsDisabled}
						labelClassName={fieldLabelClass}
						onChange={(vol) => patch({ vol })}
					/>
					<NumberField
						id="cloud-tts-pitch"
						label={t('setting.cloudTts.pitch')}
						value={prefs.pitch}
						min={-12}
						max={12}
						step={1}
						disabled={fieldsDisabled}
						labelClassName={fieldLabelClass}
						onChange={(pitch) => patch({ pitch })}
					/>

					<PrefSelectField
						id="cloud-tts-emotion"
						label={t('setting.cloudTts.emotion')}
						value={prefs.emotion || EMOTION_NONE}
						onValueChange={(emotion) =>
							patch({ emotion: emotion === EMOTION_NONE ? '' : emotion })
						}
						options={emotionOptions}
						disabled={fieldsDisabled}
						labelClassName={fieldLabelClass}
					/>

					<PrefSelectField
						id="cloud-tts-format"
						label={t('setting.cloudTts.format')}
						value={prefs.format}
						onValueChange={(format) => patch({ format })}
						options={formatOptions}
						disabled={fieldsDisabled}
						labelClassName={fieldLabelClass}
					/>

					<PrefSelectField
						id="cloud-tts-lang-boost"
						label={t('setting.cloudTts.languageBoost')}
						value={prefs.languageBoost}
						onValueChange={(languageBoost) => patch({ languageBoost })}
						options={languageBoostOptions}
						disabled={fieldsDisabled}
						labelClassName={fieldLabelClass}
					/>

					<p className="text-xs text-textcolor/55">
						{t('setting.cloudTts.advancedHint')}
					</p>
					<NumberField
						id="cloud-tts-sample-rate"
						label={t('setting.cloudTts.sampleRate')}
						value={prefs.sampleRate}
						min={8000}
						max={44100}
						step={1000}
						disabled={fieldsDisabled}
						labelClassName={fieldLabelClass}
						onChange={(sampleRate) => patch({ sampleRate })}
					/>
					<NumberField
						id="cloud-tts-bitrate"
						label={t('setting.cloudTts.bitrate')}
						value={prefs.bitrate}
						min={32000}
						max={256000}
						step={1000}
						disabled={fieldsDisabled}
						labelClassName={fieldLabelClass}
						onChange={(bitrate) => patch({ bitrate })}
					/>
					<NumberField
						id="cloud-tts-channel"
						label={t('setting.cloudTts.channel')}
						value={prefs.channel}
						min={1}
						max={2}
						step={1}
						disabled={fieldsDisabled}
						labelClassName={fieldLabelClass}
						onChange={(channel) => patch({ channel: channel === 2 ? 2 : 1 })}
					/>
				</div>

				<div className="mt-3.5 flex flex-wrap items-center justify-end px-8.5 pb-4.5">
					<div className="flex shrink-0 flex-wrap items-center">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className={cn(
								'min-w-24 cursor-pointer border border-theme/20',
								previewing && 'disabled:opacity-100',
							)}
							disabled={previewing}
							onClick={onReset}
						>
							{t('setting.cloudTts.reset')}
						</Button>
						<Button
							type="button"
							size="sm"
							className={cn(
								'ml-3 min-w-24 cursor-pointer gap-1.5',
								previewing && 'disabled:opacity-100',
							)}
							disabled={previewing || !prefs.enabled}
							onClick={() => void onPreview()}
						>
							<Volume2 className="size-4" aria-hidden />
							{t('setting.cloudTts.preview')}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default CloudTtsSetting;
