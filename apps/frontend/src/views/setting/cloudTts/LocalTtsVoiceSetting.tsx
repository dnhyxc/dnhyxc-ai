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
import { Switch } from '@ui/index';
import { Label } from '@ui/label';
import { ChevronDown, Volume2 } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import useStore from '@/store';
import { getLoggedInUserId } from '@/store/loggedInUserId';
import type { LocalEnglishVoiceOption } from '@/utils/englishTts';
import {
	getActiveLocalEnglishVoiceUri,
	getPreferredLocalEnglishVoiceKey,
	isEnglishTtsSupported,
	LOCAL_ENGLISH_TTS_VOICE_AUTO,
	listLocalEnglishVoices,
	playEnglishPreferred,
	setPreferredLocalEnglishVoiceByUri,
	setPreferredLocalEnglishVoiceKey,
	stopAllEnglishPlayback,
	warmupEnglishTtsVoices,
} from '@/utils/englishTts';

function groupVoicesByGender(voices: LocalEnglishVoiceOption[]) {
	const female: LocalEnglishVoiceOption[] = [];
	const male: LocalEnglishVoiceOption[] = [];
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
	voices: LocalEnglishVoiceOption[];
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
	isMemberActive = false,
	playbackSource = 'cloud',
	onPlaybackSourceChange,
	playbackPrefsLoading = false,
}: {
	showDivider?: boolean;
	/** 有效会员：展示与本机/云端互斥的朗读选路开关 */
	isMemberActive?: boolean;
	playbackSource?: 'local' | 'cloud';
	onPlaybackSourceChange?: (source: 'local' | 'cloud') => void;
	playbackPrefsLoading?: boolean;
}) {
	const { t } = useI18n();
	const { userStore } = useStore();
	const loggedInUserId = userStore.userInfo?.id ?? getLoggedInUserId();
	const [supported, setSupported] = useState(() => isEnglishTtsSupported());
	const [voices, setVoices] = useState<LocalEnglishVoiceOption[]>([]);
	const [selected, setSelected] = useState(LOCAL_ENGLISH_TTS_VOICE_AUTO);
	const [previewing, setPreviewing] = useState(false);

	const voiceGroups = useMemo(() => groupVoicesByGender(voices), [voices]);

	const selectedLabel = useMemo(() => {
		if (selected === LOCAL_ENGLISH_TTS_VOICE_AUTO) {
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
		setSupported(isEnglishTtsSupported());
		const list = listLocalEnglishVoices();
		setVoices(list);
		const hasCustom = Boolean(getPreferredLocalEnglishVoiceKey());
		const activeUri = getActiveLocalEnglishVoiceUri();
		if (!hasCustom) {
			setSelected(LOCAL_ENGLISH_TTS_VOICE_AUTO);
		} else if (activeUri && list.some((v) => v.voiceURI === activeUri)) {
			setSelected(activeUri);
		} else if (list[0]) {
			setSelected(list[0].voiceURI);
		} else {
			setSelected(LOCAL_ENGLISH_TTS_VOICE_AUTO);
		}
	}, []);

	useEffect(() => {
		warmupEnglishTtsVoices();
		refreshVoices();
		const onVoicesChanged = () => refreshVoices();
		if (isEnglishTtsSupported()) {
			window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
		}
		return () => {
			if (isEnglishTtsSupported()) {
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
			if (value === LOCAL_ENGLISH_TTS_VOICE_AUTO) {
				setPreferredLocalEnglishVoiceKey(null);
			} else {
				setPreferredLocalEnglishVoiceByUri(value);
			}
			refreshVoices();
		},
		[refreshVoices],
	);

	const onPreview = useCallback(async () => {
		if (!supported || previewing) return;
		stopAllEnglishPlayback();
		setPreviewing(true);
		try {
			await playEnglishPreferred(t('setting.system.localTts.previewText'), {
				preferLocal: true,
			});
		} finally {
			setPreviewing(false);
		}
	}, [supported, previewing, t]);

	const hasMaleGroup = voiceGroups.male.length > 0;
	const hasFemaleGroup = voiceGroups.female.length > 0;

	return (
		<div
			className={cn(
				'w-full',
				showDivider ? 'border-b border-theme/20 pb-4.5' : 'pb-4.5',
			)}
		>
			<div className="text-md font-bold">
				{t('setting.system.localTts.title')}
			</div>
			<div className="my-2 px-8.5 text-xs text-textcolor/55">
				{t('setting.system.localTts.desc')}
			</div>
			{isMemberActive && !playbackPrefsLoading ? (
				<div className="mt-3.5 flex items-center justify-between gap-4 px-8.5 text-sm">
					<div className="min-w-0 flex-1">
						<Label
							htmlFor="local-tts-playback"
							className="cursor-pointer text-sm font-medium"
						>
							{t('setting.system.localTts.enabledLabel')}
						</Label>
						<p className="mt-1 text-xs text-textcolor/55">
							{t('setting.system.localTts.enabledHelp')}
						</p>
					</div>
					<Switch
						id="local-tts-playback"
						checked={playbackSource === 'local'}
						onCheckedChange={(checked) =>
							onPlaybackSourceChange?.(checked ? 'local' : 'cloud')
						}
					/>
				</div>
			) : null}
			{!supported ? (
				<p className="px-8.5 text-sm text-textcolor/70">
					{t('setting.system.localTts.unsupported')}
				</p>
			) : voices.length === 0 ? (
				<p className="px-8.5 text-sm text-textcolor/70">
					{t('setting.system.localTts.noVoices')}
				</p>
			) : (
				<div className="mt-3.5 flex flex-wrap items-center gap-3 px-8.5 text-sm">
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
							className="max-h-72 w-[min(100%,20rem)]"
						>
							<DropdownMenuRadioGroup
								value={selected}
								onValueChange={onVoiceChange}
							>
								<DropdownMenuRadioItem
									value={LOCAL_ENGLISH_TTS_VOICE_AUTO}
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
