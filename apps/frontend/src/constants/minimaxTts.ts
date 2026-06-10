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
export const DEFAULT_MINIMAX_TTS_VOICE_ID = 'English_radiant_girl';

/** MiniMax 官方英文系统音色（https://platform.minimax.io/docs/faq/system-voice-id） */
export const MINIMAX_TTS_ENGLISH_VOICES = [
	{ id: 'English_expressive_narrator', name: 'Expressive Narrator' },
	{ id: 'English_radiant_girl', name: 'Radiant Girl' },
	{ id: 'English_magnetic_voiced_man', name: 'Magnetic-voiced Male' },
	{ id: 'English_compelling_lady1', name: 'Compelling Lady' },
	{ id: 'English_Aussie_Bloke', name: 'Aussie Bloke' },
	{ id: 'English_captivating_female1', name: 'Captivating Female' },
	{ id: 'English_Upbeat_Woman', name: 'Upbeat Woman' },
	{ id: 'English_Trustworth_Man', name: 'Trustworthy Man' },
	{ id: 'English_CalmWoman', name: 'Calm Woman' },
	{ id: 'English_UpsetGirl', name: 'Upset Girl' },
	{ id: 'English_Gentle-voiced_man', name: 'Gentle-voiced Man' },
	{ id: 'English_Whispering_girl', name: 'Whispering Girl' },
	{ id: 'English_Diligent_Man', name: 'Diligent Man' },
	{ id: 'English_Graceful_Lady', name: 'Graceful Lady' },
	{ id: 'English_ReservedYoungMan', name: 'Reserved Young Man' },
	{ id: 'English_PlayfulGirl', name: 'Playful Girl' },
	{ id: 'English_ManWithDeepVoice', name: 'Man With Deep Voice' },
	{ id: 'English_MaturePartner', name: 'Mature Partner' },
	{ id: 'English_FriendlyPerson', name: 'Friendly Guy' },
	{ id: 'English_MatureBoss', name: 'Bossy Lady' },
	{ id: 'English_Debator', name: 'Male Debater' },
	{ id: 'English_LovelyGirl', name: 'Lovely Girl' },
	{ id: 'English_Steadymentor', name: 'Reliable Man' },
	{ id: 'English_Deep-VoicedGentleman', name: 'Deep-voiced Gentleman' },
	{ id: 'English_Wiselady', name: 'Wise Lady' },
	{ id: 'English_CaptivatingStoryteller', name: 'Captivating Storyteller' },
	{ id: 'English_DecentYoungMan', name: 'Decent Young Man' },
	{ id: 'English_SentimentalLady', name: 'Sentimental Lady' },
	{ id: 'English_ImposingManner', name: 'Imposing Queen' },
	{ id: 'English_SadTeen', name: 'Teen Boy' },
	{ id: 'English_PassionateWarrior', name: 'Passionate Warrior' },
	{ id: 'English_WiseScholar', name: 'Wise Scholar' },
	{ id: 'English_Soft-spokenGirl', name: 'Soft-Spoken Girl' },
	{ id: 'English_SereneWoman', name: 'Serene Woman' },
	{ id: 'English_ConfidentWoman', name: 'Confident Woman' },
	{ id: 'English_PatientMan', name: 'Patient Man' },
	{ id: 'English_Comedian', name: 'Comedian' },
	{ id: 'English_BossyLeader', name: 'Bossy Leader' },
	{ id: 'English_Strong-WilledBoy', name: 'Strong-Willed Boy' },
	{ id: 'English_StressedLady', name: 'Stressed Lady' },
	{ id: 'English_AssertiveQueen', name: 'Assertive Queen' },
	{ id: 'English_AnimeCharacter', name: 'Female Narrator' },
	{ id: 'English_Jovialman', name: 'Jovial Man' },
	{ id: 'English_WhimsicalGirl', name: 'Whimsical Girl' },
	{ id: 'English_Kind-heartedGirl', name: 'Kind-Hearted Girl' },
] as const;

/** 音色 ID 列表（CreatableCombobox 预设） */
export const MINIMAX_TTS_VOICE_PRESETS = MINIMAX_TTS_ENGLISH_VOICES.map(
	(v) => v.id,
);
