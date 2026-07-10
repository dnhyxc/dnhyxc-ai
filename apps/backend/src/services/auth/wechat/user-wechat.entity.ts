import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

@Entity('user_wechat')
@Index(['scene', 'appid', 'openid'], { unique: true })
export class UserWechat {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ type: 'int' })
	userId!: number;

	@Column({ type: 'varchar', length: 32 })
	scene!: string;

	@Column({ type: 'varchar', length: 64 })
	appid!: string;

	@Column({ type: 'varchar', length: 64 })
	openid!: string;

	@Column({ type: 'varchar', length: 64, nullable: true })
	unionid!: string | null;

	@CreateDateColumn({ type: 'timestamp' })
	createdAt!: Date;

	@UpdateDateColumn({ type: 'timestamp' })
	lastLoginAt!: Date;
}
