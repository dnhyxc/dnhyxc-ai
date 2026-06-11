import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** 用户级云端朗读（MiniMax）偏好，每用户一行 */
@Entity('minimax_tts_user_config')
export class MinimaxTtsUserConfig {
	@PrimaryColumn({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ type: 'boolean', default: false })
	enabled!: boolean;

	@Column({ type: 'varchar', length: 64, default: 'speech-2.8-hd' })
	model!: string;

	@Column({ name: 'voice_id', type: 'varchar', length: 128, default: '' })
	voiceId!: string;

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

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt!: Date;
}
