import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** 用户级云端朗读（MiniMax）偏好，每用户一行 */
@Entity('minimax_tts_user_config')
export class MinimaxTtsUserConfig {
	@PrimaryColumn({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ type: 'boolean', default: false })
	enabled!: boolean;

	@Column({ type: 'varchar', length: 64, default: 'speech-2.8-turbo' })
	model!: string;

	@Column({ name: 'voice_id', type: 'varchar', length: 128, default: '' })
	voiceId!: string;

	/** 讯飞发音人 vcn；与 MiniMax voiceId 独立存储 */
	@Column({
		name: 'xfyun_voice_id',
		type: 'varchar',
		length: 128,
		default: 'x4_yezi',
	})
	xfyunVoiceId!: string;

	@Column({ type: 'double', default: 1 })
	speed!: number;

	@Column({ type: 'double', default: 5 })
	vol!: number;

	@Column({ type: 'int', default: 0 })
	pitch!: number;

	@Column({ type: 'varchar', length: 32, default: '' })
	emotion!: string;

	@Column({ type: 'varchar', length: 16, default: 'mp3' })
	format!: string;

	@Column({
		name: 'language_boost',
		type: 'varchar',
		length: 32,
		default: 'auto',
	})
	languageBoost!: string;

	@Column({ name: 'sample_rate', type: 'int', default: 32_000 })
	sampleRate!: number;

	@Column({ type: 'int', default: 128_000 })
	bitrate!: number;

	@Column({ type: 'int', default: 1 })
	channel!: number;

	/** 会员朗读选路：local 本机 Web Speech，cloud MiniMax，xfyun 讯飞在线 */
	@Column({
		name: 'playback_source',
		type: 'varchar',
		length: 16,
		default: 'local',
	})
	playbackSource!: 'local' | 'cloud' | 'xfyun';

	/** 讯飞应用凭证；均为空时 TTS 走后端环境变量 */
	@Column({ name: 'xfyun_app_id', type: 'varchar', length: 64, default: '' })
	xfyunAppId!: string;

	@Column({ name: 'xfyun_api_key', type: 'varchar', length: 128, default: '' })
	xfyunApiKey!: string;

	@Column({
		name: 'xfyun_api_secret',
		type: 'varchar',
		length: 128,
		default: '',
	})
	xfyunApiSecret!: string;

	/** MiniMax API Key；为空时 TTS 走后端环境变量 */
	@Column({
		name: 'minimax_api_key',
		type: 'varchar',
		length: 256,
		default: '',
	})
	minimaxApiKey!: string;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt!: Date;
}
