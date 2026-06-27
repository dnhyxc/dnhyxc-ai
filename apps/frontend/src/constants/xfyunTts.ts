/** 讯飞在线合成默认发音人（控制台已开通） */
export const DEFAULT_XFYUN_TTS_VCN = 'x4_yezi';

export type XfyunTtsVoice = {
	vcn: string;
	nameZh: string;
	nameEn: string;
	gender: 'female' | 'male';
};

/** 控制台已开通发音人（在线语音合成 · 普通话） */
export const XFYUN_TTS_LISTEN_VOICES: readonly XfyunTtsVoice[] = [
	{
		vcn: 'x4_xiaoyan',
		nameZh: '讯飞小燕',
		nameEn: 'Xiaoyan',
		gender: 'female',
	},
	{ vcn: 'x4_yezi', nameZh: '讯飞小露', nameEn: 'Yezi', gender: 'female' },
	{ vcn: 'aisjiuxu', nameZh: '讯飞许久', nameEn: 'Jiuxu', gender: 'male' },
	{ vcn: 'aisjinger', nameZh: '讯飞小婧', nameEn: 'Jinger', gender: 'female' },
	{ vcn: 'aisbabyxu', nameZh: '讯飞许小宝', nameEn: 'Baby Xu', gender: 'male' },
];

export function isXfyunTtsVcn(vcn: string): boolean {
	return XFYUN_TTS_LISTEN_VOICES.some((v) => v.vcn === vcn);
}

export function getXfyunTtsVoiceLabel(
	voice: XfyunTtsVoice,
	locale: string,
): string {
	const name = locale === 'zh-CN' ? voice.nameZh : voice.nameEn;
	return `${name} (${voice.vcn})`;
}

/** 讯飞在线合成 business 参数：speed / volume / pitch 均为 0–100，50 为默认 */
export const XFYUN_TTS_PARAM_DEFAULT = 50;

function clampXfyunParam(n: number): number {
	return Math.min(100, Math.max(0, Math.round(n)));
}

/** MiniMax 语速 0.5–2 → 讯飞 0–100 */
export function xfyunSpeedFromMinimaxSpeed(speed: number): number {
	return clampXfyunParam(((speed - 0.5) / 1.5) * 100);
}

/** MiniMax 音量 0.01–10 → 讯飞 0–100 */
export function xfyunVolumeFromVol(vol: number): number {
	return clampXfyunParam(((vol - 0.01) / (10 - 0.01)) * 100);
}

export function volFromXfyunVolume(volume: number): number {
	const v = clampXfyunParam(volume);
	return 0.01 + (v / 100) * (10 - 0.01);
}

/** MiniMax 音高 -12–12 → 讯飞 0–100（0 对应 50） */
export function xfyunPitchFromPitch(pitch: number): number {
	return clampXfyunParam(50 + (pitch / 12) * 50);
}

export function pitchFromXfyunPitch(xfyunPitch: number): number {
	const p = clampXfyunParam(xfyunPitch);
	return Math.round(((p - 50) / 50) * 12);
}
