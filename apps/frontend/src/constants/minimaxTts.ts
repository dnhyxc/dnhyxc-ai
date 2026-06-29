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

export type MinimaxTtsLanguageBoost =
	(typeof MINIMAX_TTS_LANGUAGE_BOOST_VALUES)[number];

export const DEFAULT_MINIMAX_TTS_MODEL = 'speech-2.8-hd';
export const DEFAULT_MINIMAX_TTS_VOICE_ID = 'English_captivating_female1';

export type DefaultMinimaxCloudCredentials = {
	minimaxApiKey: string;
	model: string;
};

function readMinimaxEnv(key: keyof ImportMetaEnv): string {
	const raw = import.meta.env[key];
	return typeof raw === 'string' ? raw.trim() : '';
}

/** 设置页 MiniMax 模型默认名（来自 VITE_MINIMAX_MODEL_NAME；API Key 不预填） */
export function getDefaultMinimaxCloudCredentials(): DefaultMinimaxCloudCredentials {
	return {
		minimaxApiKey: '',
		model:
			readMinimaxEnv('VITE_MINIMAX_MODEL_NAME') || DEFAULT_MINIMAX_TTS_MODEL,
	};
}

/** 空 model 用环境变量默认；API Key 仅保留用户已保存值 */
export function fillMinimaxCloudCredentialsFromEnv<
	T extends DefaultMinimaxCloudCredentials,
>(prefs: T): T {
	const env = getDefaultMinimaxCloudCredentials();
	return {
		...prefs,
		model: prefs.model.trim() || env.model,
	};
}

/** 中文朗读默认音色（甜美女性） */
export const DEFAULT_MINIMAX_TTS_CHINESE_VOICE_ID = 'female-tianmei';

export type MinimaxTtsVoiceGender = 'female' | 'male';

export type MinimaxTtsVoice = {
	id: string;
	/** 官网 Voice_name（英文） */
	name: string;
	/** 官网 Voice_name 中文表述，供设置页展示 */
	nameZh: string;
	gender: MinimaxTtsVoiceGender;
};

/** @deprecated 使用 MinimaxTtsVoice */
export type MinimaxTtsEnglishVoice = MinimaxTtsVoice;

/**
 * MiniMax 官方英文系统音色
 * @see https://platform.minimaxi.com/docs/faq/system-voice-id
 * nameZh 依据官网英文 Voice_name 译为中文类型描述
 */
export const MINIMAX_TTS_ENGLISH_VOICES: readonly MinimaxTtsVoice[] = [
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

/**
 * MiniMax 官方中文系统音色（普通话 + 粤语）
 * @see https://platform.minimaxi.com/docs/faq/system-voice-id
 */
export const MINIMAX_TTS_CHINESE_VOICES: readonly MinimaxTtsVoice[] = [
	{
		id: 'male-qn-qingse',
		name: 'Youthful Male',
		nameZh: '青涩青年',
		gender: 'male',
	},
	{
		id: 'male-qn-jingying',
		name: 'Elite Youth',
		nameZh: '精英青年',
		gender: 'male',
	},
	{
		id: 'male-qn-badao',
		name: 'Dominant Youth',
		nameZh: '霸道青年',
		gender: 'male',
	},
	{
		id: 'male-qn-daxuesheng',
		name: 'College Student',
		nameZh: '青年大学生',
		gender: 'male',
	},
	{
		id: 'female-shaonv',
		name: 'Young Girl',
		nameZh: '少女',
		gender: 'female',
	},
	{
		id: 'female-yujie',
		name: 'Mature Lady',
		nameZh: '御姐',
		gender: 'female',
	},
	{
		id: 'female-chengshu',
		name: 'Mature Woman',
		nameZh: '成熟女性',
		gender: 'female',
	},
	{
		id: 'female-tianmei',
		name: 'Sweet Woman',
		nameZh: '甜美女性',
		gender: 'female',
	},
	{
		id: 'male-qn-qingse-jingpin',
		name: 'Youthful Male (Beta)',
		nameZh: '青涩青年',
		gender: 'male',
	},
	{
		id: 'male-qn-jingying-jingpin',
		name: 'Elite Youth (Beta)',
		nameZh: '精英青年',
		gender: 'male',
	},
	{
		id: 'male-qn-badao-jingpin',
		name: 'Dominant Youth (Beta)',
		nameZh: '霸道青年',
		gender: 'male',
	},
	{
		id: 'male-qn-daxuesheng-jingpin',
		name: 'College Student (Beta)',
		nameZh: '青年大学生',
		gender: 'male',
	},
	{
		id: 'female-shaonv-jingpin',
		name: 'Young Girl (Beta)',
		nameZh: '少女',
		gender: 'female',
	},
	{
		id: 'female-yujie-jingpin',
		name: 'Mature Lady (Beta)',
		nameZh: '御姐',
		gender: 'female',
	},
	{
		id: 'female-chengshu-jingpin',
		name: 'Mature Woman (Beta)',
		nameZh: '成熟女性',
		gender: 'female',
	},
	{
		id: 'female-tianmei-jingpin',
		name: 'Sweet Woman (Beta)',
		nameZh: '甜美女性',
		gender: 'female',
	},
	{
		id: 'clever_boy',
		name: 'Clever Boy',
		nameZh: '聪明男童',
		gender: 'male',
	},
	{
		id: 'cute_boy',
		name: 'Cute Boy',
		nameZh: '可爱男童',
		gender: 'male',
	},
	{
		id: 'lovely_girl',
		name: 'Lovely Girl',
		nameZh: '萌萌女童',
		gender: 'female',
	},
	{
		id: 'cartoon_pig',
		name: 'Cartoon Pig',
		nameZh: '卡通猪小琪',
		gender: 'female',
	},
	{
		id: 'bingjiao_didi',
		name: 'Yandere Younger Brother',
		nameZh: '病娇弟弟',
		gender: 'male',
	},
	{
		id: 'junlang_nanyou',
		name: 'Handsome Boyfriend',
		nameZh: '俊朗男友',
		gender: 'male',
	},
	{
		id: 'chunzhen_xuedi',
		name: 'Innocent Junior',
		nameZh: '纯真学弟',
		gender: 'male',
	},
	{
		id: 'lengdan_xiongzhang',
		name: 'Cool Senior',
		nameZh: '冷淡学长',
		gender: 'male',
	},
	{
		id: 'badao_shaoye',
		name: 'Dominant Young Master',
		nameZh: '霸道少爷',
		gender: 'male',
	},
	{
		id: 'tianxin_xiaoling',
		name: 'Sweet Ling',
		nameZh: '甜心小玲',
		gender: 'female',
	},
	{
		id: 'qiaopi_mengmei',
		name: 'Playful Girl',
		nameZh: '俏皮萌妹',
		gender: 'female',
	},
	{
		id: 'wumei_yujie',
		name: 'Charming Lady',
		nameZh: '妩媚御姐',
		gender: 'female',
	},
	{
		id: 'diadia_xuemei',
		name: 'Cute Junior Girl',
		nameZh: '嗲嗲学妹',
		gender: 'female',
	},
	{
		id: 'danya_xuejie',
		name: 'Elegant Senior Girl',
		nameZh: '淡雅学姐',
		gender: 'female',
	},
	{
		id: 'Chinese (Mandarin)_Reliable_Executive',
		name: 'Reliable Executive',
		nameZh: '沉稳高管',
		gender: 'male',
	},
	{
		id: 'Chinese (Mandarin)_News_Anchor',
		name: 'News Anchor',
		nameZh: '新闻女声',
		gender: 'female',
	},
	{
		id: 'Chinese (Mandarin)_Mature_Woman',
		name: 'Mature Woman',
		nameZh: '傲娇御姐',
		gender: 'female',
	},
	{
		id: 'Chinese (Mandarin)_Unrestrained_Young_Man',
		name: 'Unrestrained Young Man',
		nameZh: '不羁青年',
		gender: 'male',
	},
	{
		id: 'Arrogant_Miss',
		name: 'Arrogant Miss',
		nameZh: '嚣张小姐',
		gender: 'female',
	},
	{
		id: 'Robot_Armor',
		name: 'Robot Armor',
		nameZh: '机械战甲',
		gender: 'male',
	},
	{
		id: 'Chinese (Mandarin)_Kind-hearted_Antie',
		name: 'Kind-hearted Antie',
		nameZh: '热心大婶',
		gender: 'female',
	},
	{
		id: 'Chinese (Mandarin)_HK_Flight_Attendant',
		name: 'HK Flight Attendant',
		nameZh: '港普空姐',
		gender: 'female',
	},
	{
		id: 'Chinese (Mandarin)_Humorous_Elder',
		name: 'Humorous Elder',
		nameZh: '搞笑大爷',
		gender: 'male',
	},
	{
		id: 'Chinese (Mandarin)_Gentleman',
		name: 'Gentleman',
		nameZh: '温润男声',
		gender: 'male',
	},
	{
		id: 'Chinese (Mandarin)_Warm_Bestie',
		name: 'Warm Bestie',
		nameZh: '温暖闺蜜',
		gender: 'female',
	},
	{
		id: 'Chinese (Mandarin)_Male_Announcer',
		name: 'Male Announcer',
		nameZh: '播报男声',
		gender: 'male',
	},
	{
		id: 'Chinese (Mandarin)_Sweet_Lady',
		name: 'Sweet Lady',
		nameZh: '甜美女声',
		gender: 'female',
	},
	{
		id: 'Chinese (Mandarin)_Southern_Young_Man',
		name: 'Southern Young Man',
		nameZh: '南方小哥',
		gender: 'male',
	},
	{
		id: 'Chinese (Mandarin)_Wise_Women',
		name: 'Wise Women',
		nameZh: '阅历姐姐',
		gender: 'female',
	},
	{
		id: 'Chinese (Mandarin)_Gentle_Youth',
		name: 'Gentle Youth',
		nameZh: '温润青年',
		gender: 'male',
	},
	{
		id: 'Chinese (Mandarin)_Warm_Girl',
		name: 'Warm Girl',
		nameZh: '温暖少女',
		gender: 'female',
	},
	{
		id: 'Chinese (Mandarin)_Kind-hearted_Elder',
		name: 'Kind-hearted Elder',
		nameZh: '花甲奶奶',
		gender: 'female',
	},
	{
		id: 'Chinese (Mandarin)_Cute_Spirit',
		name: 'Cute Spirit',
		nameZh: '憨憨萌兽',
		gender: 'female',
	},
	{
		id: 'Chinese (Mandarin)_Radio_Host',
		name: 'Radio Host',
		nameZh: '电台男主播',
		gender: 'male',
	},
	{
		id: 'Chinese (Mandarin)_Lyrical_Voice',
		name: 'Lyrical Voice',
		nameZh: '抒情男声',
		gender: 'male',
	},
	{
		id: 'Chinese (Mandarin)_Straightforward_Boy',
		name: 'Straightforward Boy',
		nameZh: '率真弟弟',
		gender: 'male',
	},
	{
		id: 'Chinese (Mandarin)_Sincere_Adult',
		name: 'Sincere Adult',
		nameZh: '真诚青年',
		gender: 'male',
	},
	{
		id: 'Chinese (Mandarin)_Gentle_Senior',
		name: 'Gentle Senior',
		nameZh: '温柔学姐',
		gender: 'female',
	},
	{
		id: 'Chinese (Mandarin)_Stubborn_Friend',
		name: 'Stubborn Friend',
		nameZh: '嘴硬竹马',
		gender: 'male',
	},
	{
		id: 'Chinese (Mandarin)_Crisp_Girl',
		name: 'Crisp Girl',
		nameZh: '清脆少女',
		gender: 'female',
	},
	{
		id: 'Chinese (Mandarin)_Pure-hearted_Boy',
		name: 'Pure-hearted Boy',
		nameZh: '清澈邻家弟弟',
		gender: 'male',
	},
	{
		id: 'Chinese (Mandarin)_Soft_Girl',
		name: 'Soft Girl',
		nameZh: '柔和少女',
		gender: 'female',
	},
	{
		id: 'Cantonese_ProfessionalHost（F)',
		name: 'Professional Female Host',
		nameZh: '专业女主持',
		gender: 'female',
	},
	{
		id: 'Cantonese_GentleLady',
		name: 'Gentle Lady',
		nameZh: '温柔女声',
		gender: 'female',
	},
	{
		id: 'Cantonese_ProfessionalHost（M)',
		name: 'Professional Male Host',
		nameZh: '专业男主持',
		gender: 'male',
	},
	{
		id: 'Cantonese_PlayfulMan',
		name: 'Playful Man',
		nameZh: '活泼男声',
		gender: 'male',
	},
	{
		id: 'Cantonese_CuteGirl',
		name: 'Cute Girl',
		nameZh: '可爱女孩',
		gender: 'female',
	},
	{
		id: 'Cantonese_KindWoman',
		name: 'Kind Woman',
		nameZh: '善良女声',
		gender: 'female',
	},
];

/** 设置页展示名：中文界面用 nameZh，英文界面用官网英文名 */
export function getMinimaxTtsVoiceDisplayName(
	voice: MinimaxTtsVoice,
	locale: string,
): string {
	return locale === 'zh-CN' ? voice.nameZh : voice.name;
}

/** 按语言增强筛选可选音色；auto 时合并中英列表 */
export function getMinimaxTtsVoicesForLanguageBoost(
	languageBoost: MinimaxTtsLanguageBoost,
): readonly MinimaxTtsVoice[] {
	if (languageBoost === 'English') return MINIMAX_TTS_ENGLISH_VOICES;
	if (languageBoost === 'Chinese') return MINIMAX_TTS_CHINESE_VOICES;
	return [...MINIMAX_TTS_ENGLISH_VOICES, ...MINIMAX_TTS_CHINESE_VOICES];
}

/** 语言增强对应的默认音色 ID */
export function defaultMinimaxTtsVoiceIdForLanguageBoost(
	languageBoost: MinimaxTtsLanguageBoost,
): string {
	if (languageBoost === 'Chinese') return DEFAULT_MINIMAX_TTS_CHINESE_VOICE_ID;
	return DEFAULT_MINIMAX_TTS_VOICE_ID;
}

/** 女性音色在上、男性在下（设置页 Select 分组用） */
export function getMinimaxTtsVoicesByGender(
	voices: readonly MinimaxTtsVoice[],
): {
	female: readonly MinimaxTtsVoice[];
	male: readonly MinimaxTtsVoice[];
} {
	const female: MinimaxTtsVoice[] = [];
	const male: MinimaxTtsVoice[] = [];
	for (const voice of voices) {
		if (voice.gender === 'female') female.push(voice);
		else male.push(voice);
	}
	return { female, male };
}

/** @deprecated 使用 getMinimaxTtsVoicesByGender(MINIMAX_TTS_ENGLISH_VOICES) */
export function getMinimaxTtsEnglishVoicesByGender(): {
	female: readonly MinimaxTtsVoice[];
	male: readonly MinimaxTtsVoice[];
} {
	return getMinimaxTtsVoicesByGender(MINIMAX_TTS_ENGLISH_VOICES);
}

/** 音色 ID 列表（CreatableCombobox 预设） */
export const MINIMAX_TTS_VOICE_PRESETS = [
	...MINIMAX_TTS_ENGLISH_VOICES,
	...MINIMAX_TTS_CHINESE_VOICES,
].map((v) => v.id);
