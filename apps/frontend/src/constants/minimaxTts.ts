/** 与后端 MinimaxTtsDto 白名单保持一致 */
export const MINIMAX_TTS_MODELS = [
	'speech-2.8-hd',
	'speech-2.8-turbo',
	'speech-2.6-hd',
	'speech-2.6-turbo',
	'speech-02-hd',
	'speech-02-turbo',
	'speech-01-hd',
	'speech-01-turbo',
] as const;

export const MINIMAX_TTS_AUDIO_FORMATS = [
	'mp3',
	'pcm',
	'flac',
	'wav',
	'pcmu_raw',
	'pcmu_wav',
	'opus',
] as const;

/** MiniMax T2A `voice_setting.emotion`（与官网 8 项一致，不含 whisper） */
export const MINIMAX_TTS_EMOTIONS = [
	'happy',
	'sad',
	'angry',
	'fearful',
	'disgusted',
	'surprised',
	'calm',
	'fluent',
] as const;

/** MiniMax T2A `language_boost` 可选值 */
export const MINIMAX_TTS_LANGUAGE_BOOST_VALUES = [
	'auto',
	'English',
	'Chinese',
] as const;

export const DEFAULT_MINIMAX_TTS_LANGUAGE_BOOST =
	MINIMAX_TTS_LANGUAGE_BOOST_VALUES[0];

export const DEFAULT_MINIMAX_TTS_MODEL = 'speech-2.8-hd';
export const DEFAULT_MINIMAX_TTS_VOICE_ID = 'English_captivating_female1';

export type MinimaxTtsVoiceGender = 'female' | 'male';

export type MinimaxTtsEnglishVoice = {
	id: string;
	/** 官网 Voice_name（英文） */
	name: string;
	/** 官网 Voice_name 中文表述，供设置页展示 */
	nameZh: string;
	gender: MinimaxTtsVoiceGender;
};

/**
 * MiniMax 官方英文系统音色
 * @see https://platform.minimaxi.com/docs/faq/system-voice-id
 * nameZh 依据官网英文 Voice_name 译为中文类型描述
 */
export const MINIMAX_TTS_ENGLISH_VOICES: readonly MinimaxTtsEnglishVoice[] = [
	{
		id: 'English_radiant_girl',
		name: 'Radiant Girl',
		nameZh: '阳光少女',
		gender: 'female',
	},
	{
		id: 'English_compelling_lady1',
		name: 'Compelling Lady',
		nameZh: '迷人女士',
		gender: 'female',
	},
	{
		id: 'English_captivating_female1',
		name: 'Captivating Female',
		nameZh: '迷人女声',
		gender: 'female',
	},
	{
		id: 'English_Upbeat_Woman',
		name: 'Upbeat Woman',
		nameZh: '活力女性',
		gender: 'female',
	},
	{
		id: 'English_CalmWoman',
		name: 'Calm Woman',
		nameZh: '沉稳女性',
		gender: 'female',
	},
	{
		id: 'English_UpsetGirl',
		name: 'Upset Girl',
		nameZh: '沮丧少女',
		gender: 'female',
	},
	{
		id: 'English_Whispering_girl',
		name: 'Whispering Girl',
		nameZh: '低语少女',
		gender: 'female',
	},
	{
		id: 'English_Graceful_Lady',
		name: 'Graceful Lady',
		nameZh: '优雅女士',
		gender: 'female',
	},
	{
		id: 'English_PlayfulGirl',
		name: 'Playful Girl',
		nameZh: '活泼少女',
		gender: 'female',
	},
	{
		id: 'English_LovelyGirl',
		name: 'Lovely Girl',
		nameZh: '可爱少女',
		gender: 'female',
	},
	{
		id: 'English_Wiselady',
		name: 'Wise Lady',
		nameZh: '睿智女士',
		gender: 'female',
	},
	{
		id: 'English_SentimentalLady',
		name: 'Sentimental Lady',
		nameZh: '感性女士',
		gender: 'female',
	},
	{
		id: 'English_ImposingManner',
		name: 'Imposing Queen',
		nameZh: '威严女王',
		gender: 'female',
	},
	{
		id: 'English_Soft-spokenGirl',
		name: 'Soft-Spoken Girl',
		nameZh: '轻声少女',
		gender: 'female',
	},
	{
		id: 'English_SereneWoman',
		name: 'Serene Woman',
		nameZh: '沉静女性',
		gender: 'female',
	},
	{
		id: 'English_ConfidentWoman',
		name: 'Confident Woman',
		nameZh: '自信女性',
		gender: 'female',
	},
	{
		id: 'English_StressedLady',
		name: 'Stressed Lady',
		nameZh: '焦虑女士',
		gender: 'female',
	},
	{
		id: 'English_AssertiveQueen',
		name: 'Assertive Queen',
		nameZh: '果断女王',
		gender: 'female',
	},
	{
		id: 'English_AnimeCharacter',
		name: 'Female Narrator',
		nameZh: '女性旁白',
		gender: 'female',
	},
	{
		id: 'English_WhimsicalGirl',
		name: 'Whimsical Girl',
		nameZh: '奇幻少女',
		gender: 'female',
	},
	{
		id: 'English_Kind-heartedGirl',
		name: 'Kind-Hearted Girl',
		nameZh: '善良少女',
		gender: 'female',
	},
	{
		id: 'English_MatureBoss',
		name: 'Bossy Lady',
		nameZh: '强势御姐',
		gender: 'female',
	},
	{
		id: 'English_magnetic_voiced_man',
		name: 'Magnetic-voiced Male',
		nameZh: '磁性男声',
		gender: 'male',
	},
	{
		id: 'English_Aussie_Bloke',
		name: 'Aussie Bloke',
		nameZh: '澳洲男声',
		gender: 'male',
	},
	{
		id: 'English_Trustworth_Man',
		name: 'Trustworthy Man',
		nameZh: '可靠男声',
		gender: 'male',
	},
	{
		id: 'English_Gentle-voiced_man',
		name: 'Gentle-voiced Man',
		nameZh: '轻柔男声',
		gender: 'male',
	},
	{
		id: 'English_Diligent_Man',
		name: 'Diligent Man',
		nameZh: '勤恳男声',
		gender: 'male',
	},
	{
		id: 'English_ReservedYoungMan',
		name: 'Reserved Young Man',
		nameZh: '内敛青年',
		gender: 'male',
	},
	{
		id: 'English_ManWithDeepVoice',
		name: 'Man With Deep Voice',
		nameZh: '低沉男声',
		gender: 'male',
	},
	{
		id: 'English_MaturePartner',
		name: 'Mature Partner',
		nameZh: '成熟男声',
		gender: 'male',
	},
	{
		id: 'English_FriendlyPerson',
		name: 'Friendly Guy',
		nameZh: '友好男声',
		gender: 'male',
	},
	{
		id: 'English_Debator',
		name: 'Male Debater',
		nameZh: '辩论男声',
		gender: 'male',
	},
	{
		id: 'English_Steadymentor',
		name: 'Reliable Man',
		nameZh: '可靠导师',
		gender: 'male',
	},
	{
		id: 'English_Deep-VoicedGentleman',
		name: 'Deep-voiced Gentleman',
		nameZh: '低沉绅士',
		gender: 'male',
	},
	{
		id: 'English_DecentYoungMan',
		name: 'Decent Young Man',
		nameZh: '正派青年',
		gender: 'male',
	},
	{
		id: 'English_SadTeen',
		name: 'Teen Boy',
		nameZh: '少年男声',
		gender: 'male',
	},
	{
		id: 'English_PassionateWarrior',
		name: 'Passionate Warrior',
		nameZh: '热情勇士',
		gender: 'male',
	},
	{
		id: 'English_WiseScholar',
		name: 'Wise Scholar',
		nameZh: '博学学者',
		gender: 'male',
	},
	{
		id: 'English_PatientMan',
		name: 'Patient Man',
		nameZh: '耐心男声',
		gender: 'male',
	},
	{
		id: 'English_Comedian',
		name: 'Comedian',
		nameZh: '喜剧男声',
		gender: 'male',
	},
	{
		id: 'English_BossyLeader',
		name: 'Bossy Leader',
		nameZh: '强势领导',
		gender: 'male',
	},
	{
		id: 'English_Strong-WilledBoy',
		name: 'Strong-Willed Boy',
		nameZh: '坚强少年',
		gender: 'male',
	},
	{
		id: 'English_Jovialman',
		name: 'Jovial Man',
		nameZh: '开朗男声',
		gender: 'male',
	},
	{
		id: 'English_CaptivatingStoryteller',
		name: 'Captivating Storyteller',
		nameZh: '迷人讲述者',
		gender: 'male',
	},
	{
		id: 'English_expressive_narrator',
		name: 'Expressive Narrator',
		nameZh: '表现力旁白',
		gender: 'male',
	},
];

/** 设置页展示名：中文界面用 nameZh，英文界面用官网英文名 */
export function getMinimaxTtsVoiceDisplayName(
	voice: MinimaxTtsEnglishVoice,
	locale: string,
): string {
	return locale === 'zh-CN' ? voice.nameZh : voice.name;
}

/** 女性音色在上、男性在下（设置页 Select 分组用） */
export function getMinimaxTtsEnglishVoicesByGender(): {
	female: readonly MinimaxTtsEnglishVoice[];
	male: readonly MinimaxTtsEnglishVoice[];
} {
	const female: MinimaxTtsEnglishVoice[] = [];
	const male: MinimaxTtsEnglishVoice[] = [];
	for (const voice of MINIMAX_TTS_ENGLISH_VOICES) {
		if (voice.gender === 'female') female.push(voice);
		else male.push(voice);
	}
	return { female, male };
}

/** 音色 ID 列表（CreatableCombobox 预设） */
export const MINIMAX_TTS_VOICE_PRESETS = MINIMAX_TTS_ENGLISH_VOICES.map(
	(v) => v.id,
);
