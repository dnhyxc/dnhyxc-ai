/**
 * 设置 → 朗读：本机 Web Speech 音色选择与试听（会员页面上方；非会员为唯一区块）
 */
import { Button } from '@ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import { Label } from '@ui/label';
import { ScrollArea } from '@ui/scroll-area';
import { ChevronDown, Volume2 } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { TtsPlaybackSource } from '@/service';
import useStore from '@/store';
import { getLoggedInUserId } from '@/store/loggedInUserId';
import type { LocalVoiceOption } from '@/utils/speech';
import {
	getActiveLocalVoiceUri,
	getPreferredLocalVoiceKey,
	isSpeechSupported,
	LOCAL_TTS_VOICE_AUTO,
	listLocalVoices,
	playPreferred,
	setPreferredLocalVoiceByUri,
	setPreferredLocalVoiceKey,
	stopAllPlayback,
	warmupSpeechVoices,
} from '@/utils/speech';

function groupVoicesByGender(voices: LocalVoiceOption[]) {
	const female: LocalVoiceOption[] = [];
	const male: LocalVoiceOption[] = [];
	for (const v of voices) {
		if (v.gender === 'female') female.push(v);
		else if (v.gender === 'male') male.push(v);
	}
	return { female, male };
}

function VoiceDropdownGroup({
	label,
	voices,
	genderTagKey,
	t,
}: {
	label: string;
	voices: LocalVoiceOption[];
	genderTagKey: 'female' | 'male';
	t: (key: string) => string;
}) {
	if (voices.length === 0) return null;
	const tag = t(`setting.system.localTts.genderTag.${genderTagKey}`);
	return (
		<>
			<DropdownMenuLabel>{label}</DropdownMenuLabel>
			{voices.map((v) => (
				<DropdownMenuRadioItem key={v.voiceURI} value={v.voiceURI}>
					{`${v.name} (${v.lang}) · ${tag}`}
				</DropdownMenuRadioItem>
			))}
		</>
	);
}

export const LocalTtsVoiceSetting = observer(function LocalTtsVoiceSetting({
	showDivider = false,
	playbackSource = 'local',
}: {
	showDivider?: boolean;
	playbackSource?: TtsPlaybackSource;
}) {
	const { t } = useI18n();
	const { userStore } = useStore();
	const loggedInUserId = userStore.userInfo?.id ?? getLoggedInUserId();
	const [supported, setSupported] = useState(() => isSpeechSupported());
	const [voices, setVoices] = useState<LocalVoiceOption[]>([]);
	const [selected, setSelected] = useState(LOCAL_TTS_VOICE_AUTO);
	const [previewing, setPreviewing] = useState(false);

	const voiceGroups = useMemo(() => groupVoicesByGender(voices), [voices]);

	const selectedLabel = useMemo(() => {
		if (selected === LOCAL_TTS_VOICE_AUTO) {
			return t('setting.system.localTts.autoOption');
		}
		const voice = voices.find((v) => v.voiceURI === selected);
		if (!voice) return t('setting.system.localTts.voiceLabel');
		const tagKey =
			voice.gender === 'male'
				? 'male'
				: voice.gender === 'female'
					? 'female'
					: null;
		const tag = tagKey ? t(`setting.system.localTts.genderTag.${tagKey}`) : '';
		return tag
			? `${voice.name} (${voice.lang}) · ${tag}`
			: `${voice.name} (${voice.lang})`;
	}, [selected, voices, t]);

	const refreshVoices = useCallback(() => {
		setSupported(isSpeechSupported());
		const list = listLocalVoices();
		setVoices(list);
		const hasCustom = Boolean(getPreferredLocalVoiceKey());
		const activeUri = getActiveLocalVoiceUri();
		if (!hasCustom) {
			setSelected(LOCAL_TTS_VOICE_AUTO);
		} else if (activeUri && list.some((v) => v.voiceURI === activeUri)) {
			setSelected(activeUri);
		} else if (list[0]) {
			setSelected(list[0].voiceURI);
		} else {
			setSelected(LOCAL_TTS_VOICE_AUTO);
		}
	}, []);

	useEffect(() => {
		warmupSpeechVoices();
		refreshVoices();
		const onVoicesChanged = () => refreshVoices();
		if (isSpeechSupported()) {
			window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
		}
		return () => {
			if (isSpeechSupported()) {
				window.speechSynthesis.removeEventListener(
					'voiceschanged',
					onVoicesChanged,
				);
			}
		};
	}, [refreshVoices, loggedInUserId]);

	const onVoiceChange = useCallback(
		(value: string) => {
			setSelected(value);
			if (value === LOCAL_TTS_VOICE_AUTO) {
				setPreferredLocalVoiceKey(null);
			} else {
				setPreferredLocalVoiceByUri(value);
			}
			refreshVoices();
		},
		[refreshVoices],
	);

	const onPreview = useCallback(async () => {
		if (!supported || previewing) return;
		stopAllPlayback();
		setPreviewing(true);
		try {
			await playPreferred(t('setting.cloudTts.previewText'), {
				preferLocal: true,
			});
		} finally {
			setPreviewing(false);
		}
	}, [supported, previewing, t]);

	const handleVoiceMenuWheel = useCallback(
		(event: React.WheelEvent<HTMLDivElement>) => {
			event.stopPropagation();
			event.currentTarget.scrollTop += event.deltaY;
		},
		[],
	);

	const handleVoiceMenuWheelCapture = useCallback(
		(event: React.WheelEvent<HTMLDivElement>) => {
			event.stopPropagation();
		},
		[],
	);

	const hasMaleGroup = voiceGroups.male.length > 0;
	const hasFemaleGroup = voiceGroups.female.length > 0;

	return (
		<div
			className={cn(
				'w-full',
				showDivider ? 'mt-3.5 border-b border-theme/20 pb-4.5' : 'pb-4.5',
			)}
		>
			<div className="text-md font-bold">
				{t('setting.system.localTts.title')}
			</div>
			<div className="my-2 px-8.5 text-xs text-textcolor/55">
				{t('setting.system.localTts.desc')}
			</div>
			{!supported ? (
				<p className="px-8.5 text-sm text-textcolor/70">
					{t('setting.system.localTts.unsupported')}
				</p>
			) : voices.length === 0 ? (
				<p className="px-8.5 text-sm text-textcolor/70">
					{t('setting.system.localTts.noVoices')}
				</p>
			) : (
				<div
					className={cn(
						'mt-3.5 flex flex-wrap items-center gap-3 px-8.5 text-sm',
						playbackSource !== 'local' && 'pointer-events-none opacity-50',
					)}
				>
					<Label id="local-english-tts-voice" className="shrink-0">
						{t('setting.system.localTts.voiceLabel')}
					</Label>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="link"
								size="sm"
								aria-labelledby="local-english-tts-voice"
								className="w-[min(100%,15rem)] justify-between gap-2 border border-theme/20 font-normal shadow-none hover:border-theme/20 focus:border-theme/20 focus-visible:border-theme/20 focus-visible:ring-0 data-[state=open]:border-theme/20 data-[state=open]:ring-0"
							>
								<span className="truncate">{selectedLabel}</span>
								<ChevronDown
									className="size-4 shrink-0 opacity-50"
									aria-hidden
								/>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="start"
							className="w-[min(100%,20rem)] overflow-hidden p-0"
						>
							<ScrollArea
								className="max-h-72 w-full min-h-0 border-0"
								viewportClassName="max-h-72 box-border py-1 pe-3 ps-1 [&>div]:min-h-0!"
								onWheel={handleVoiceMenuWheel}
								onWheelCapture={handleVoiceMenuWheelCapture}
							>
								<DropdownMenuRadioGroup
									value={selected}
									onValueChange={onVoiceChange}
								>
									<DropdownMenuRadioItem
										value={LOCAL_TTS_VOICE_AUTO}
										className="px-2 pl-2 [&>span:first-child]:hidden"
									>
										{t('setting.system.localTts.autoOption')}
									</DropdownMenuRadioItem>
									{hasFemaleGroup || hasMaleGroup ? (
										<DropdownMenuSeparator />
									) : null}
									<VoiceDropdownGroup
										label={t('setting.system.localTts.groupFemale')}
										voices={voiceGroups.female}
										genderTagKey="female"
										t={t}
									/>
									{hasFemaleGroup && hasMaleGroup ? (
										<DropdownMenuSeparator />
									) : null}
									<VoiceDropdownGroup
										label={t('setting.system.localTts.groupMale')}
										voices={voiceGroups.male}
										genderTagKey="male"
										t={t}
									/>
								</DropdownMenuRadioGroup>
							</ScrollArea>
						</DropdownMenuContent>
					</DropdownMenu>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="gap-1.5 border border-theme/20"
						disabled={previewing}
						onClick={() => void onPreview()}
					>
						<Volume2 className="size-4" aria-hidden />
						{t('setting.system.localTts.preview')}
					</Button>
				</div>
			)}
		</div>
	);
});
