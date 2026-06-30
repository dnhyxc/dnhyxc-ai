/** 与前端 MINIMAX_TTS_MODELS 保持一致 */
export const MINIMAX_TTS_MODELS = [
	'speech-2.8-hd',
	'speech-2.8-turbo',
] as const;

export const DEFAULT_MINIMAX_TTS_MODEL = 'speech-2.8-turbo';

export type MinimaxTtsModel = (typeof MINIMAX_TTS_MODELS)[number];
