import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
} from 'typeorm';

/** 支付开通幂等记录：同一 grantId（如 Stripe session.id）只应开通一次 */
@Entity('membership_payment_grant')
@Index(['grantId'], { unique: true })
export class MembershipPaymentGrant {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ name: 'grant_id', type: 'varchar', length: 255 })
	grantId!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;
}
