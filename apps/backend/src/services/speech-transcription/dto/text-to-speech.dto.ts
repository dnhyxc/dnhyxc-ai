export class TextToSpeechDto {
	text: string;
	model?: string;
	voiceId?: string;
	speed?: number;
	vol?: number;
	pitch?: number;
	outputFormat?: 'mp3' | 'wav' | 'pcm' | 'flac';
}
