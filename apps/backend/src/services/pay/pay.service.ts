import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import Stripe from 'stripe';

import { StripeEnum } from '../../enum/config.enum';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import {
	DEFAULT_MEMBERSHIP_TYPE,
	getMembershipPlan,
	resolveMembershipDays,
} from './membership.constants';
import { MembershipService } from './membership.service';

@Injectable()
export class PayService {
	private readonly logger = new Logger(PayService.name);
	private readonly stripe: Stripe | null;
	/** 密钥填错时的说明（例如把 pk_ 当成了 Secret） */
	private readonly stripeConfigHint: string | null;

	constructor(
		private readonly config: ConfigService,
		private readonly membershipService: MembershipService,
	) {
		const raw = this.config.get<string>(StripeEnum.STRIPE_SECRET_KEY);
		const secret = raw?.trim();
		if (!secret) {
			this.stripe = null;
			this.stripeConfigHint = null;
			return;
		}
		if (secret.startsWith('pk_')) {
			this.stripe = null;
			this.stripeConfigHint =
				'STRIPE_SECRET_KEY 不能使用 Publishable key（pk_ 开头）。请在 Stripe 控制台「开发者 → API 密钥」复制 Secret key（sk_test_… 或 sk_live_…），不要复制 Publishable key。';
			this.logger.error(this.stripeConfigHint);
			return;
		}
		this.stripeConfigHint = null;
		this.stripe = new Stripe(secret);
	}

	private getStripe(): Stripe {
		if (this.stripeConfigHint) {
			throw new ServiceUnavailableException(this.stripeConfigHint);
		}
		if (!this.stripe) {
			throw new ServiceUnavailableException(
				'Stripe 未配置：请在环境变量中设置 STRIPE_SECRET_KEY（Secret key，sk_ 开头）',
			);
		}
		return this.stripe;
	}

	async createCheckoutSession(
		dto: CreateCheckoutSessionDto,
		userId: number,
	): Promise<{
		sessionId: string;
		url: string | null;
		clientSecret: string | null;
	}> {
		const stripe = this.getStripe();
		const plan = dto.membershipPlan
			? getMembershipPlan(dto.membershipPlan)
			: null;
		if (dto.membershipPlan && !plan) {
			throw new BadRequestException('无效的会员套餐');
		}

		const currency = plan ? 'cny' : dto.currency;
		const unitAmount = plan ? plan.amountMinorUnits : dto.amount;
		if (unitAmount == null || unitAmount < 1) {
			throw new BadRequestException('缺少有效支付金额');
		}
		const productName =
			plan?.defaultProductName ?? dto.productName ?? '订单支付';
		const membershipDays = plan
			? plan.durationDays
			: resolveMembershipDays(dto.membershipDays);

		const line_items = [
			{
				quantity: 1,
				price_data: {
					currency,
					unit_amount: unitAmount,
					product_data: {
						name: productName,
					},
				},
			},
		];
		const common = {
			mode: 'payment' as const,
			line_items,
			client_reference_id: String(userId),
			metadata: {
				userId: String(userId),
				membershipDays: String(membershipDays),
				membershipType: DEFAULT_MEMBERSHIP_TYPE,
				...(plan ? { membershipPlan: plan.code } : {}),
			},
		};

		if (dto.embedded === true) {
			const session = await stripe.checkout.sessions.create({
				...common,
				ui_mode: 'embedded',
				/** 完成后不整页跳转，由前端 initEmbeddedCheckout 的 onComplete 关闭内嵌表单 */
				redirect_on_completion: 'never',
			});
			return {
				sessionId: session.id,
				url: null,
				clientSecret: session.client_secret ?? null,
			};
		}

		const session = await stripe.checkout.sessions.create({
			...common,
			success_url: dto.successUrl!,
			cancel_url: dto.cancelUrl,
		});
		return {
			sessionId: session.id,
			url: session.url,
			clientSecret: null,
		};
	}

	constructWebhookEvent(
		req: Request & { rawBody?: Buffer },
		signature: string,
	): Stripe.Event {
		const webhookSecret = this.config.get<string>(
			StripeEnum.STRIPE_WEBHOOK_SECRET,
		);
		if (!webhookSecret) {
			throw new BadRequestException('STRIPE_WEBHOOK_SECRET 未配置');
		}
		const rawBody = req.rawBody;
		if (!rawBody) {
			throw new BadRequestException(
				'无法读取 Webhook 原始请求体，请确认已在 NestFactory.create 中开启 rawBody',
			);
		}
		const stripe = this.getStripe();
		return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
	}

	async handleWebhookEvent(event: Stripe.Event): Promise<void> {
		switch (event.type) {
			case 'checkout.session.completed': {
				const session = event.data.object as Stripe.Checkout.Session;
				await this.grantMembershipFromCheckoutSession(session);
				break;
			}
			default:
				break;
		}
	}

	/** 内嵌收银台完成后由前端携带 sessionId 调用，与 Webhook 共用幂等开通逻辑 */
	async completeCheckoutMembership(
		sessionId: string,
		userId: number,
	): Promise<{
		isMember: boolean;
		membershipType: string;
		memberExpiresAt: Date | null;
	}> {
		const stripe = this.getStripe();
		const session = await stripe.checkout.sessions.retrieve(sessionId);
		if (session.payment_status !== 'paid') {
			throw new BadRequestException('订单尚未支付完成');
		}
		const meta = this.membershipService.parseStripeSessionMembership(
			session.metadata ?? undefined,
		);
		const sessionUserId =
			meta.userId ??
			(session.client_reference_id
				? Number.parseInt(session.client_reference_id, 10)
				: Number.NaN);
		if (!Number.isFinite(sessionUserId) || sessionUserId !== userId) {
			throw new ForbiddenException('无权确认该支付会话');
		}
		return this.membershipService.grantAfterPayment(userId, {
			grantId: session.id,
			membershipDays: meta.membershipDays,
			membershipType: meta.membershipType,
		});
	}

	private async grantMembershipFromCheckoutSession(
		session: Stripe.Checkout.Session,
	): Promise<void> {
		if (session.payment_status !== 'paid') {
			this.logger.warn(
				`Skip membership grant: session=${session.id} payment_status=${session.payment_status}`,
			);
			return;
		}
		const meta = this.membershipService.parseStripeSessionMembership(
			session.metadata ?? undefined,
		);
		const userId =
			meta.userId ??
			(session.client_reference_id
				? Number.parseInt(session.client_reference_id, 10)
				: Number.NaN);
		if (!Number.isFinite(userId)) {
			this.logger.warn(
				`Stripe checkout.session.completed missing userId session=${session.id}`,
			);
			return;
		}
		await this.membershipService.grantAfterPayment(userId, {
			grantId: session.id,
			membershipDays: meta.membershipDays,
			membershipType: meta.membershipType,
		});
	}
}
