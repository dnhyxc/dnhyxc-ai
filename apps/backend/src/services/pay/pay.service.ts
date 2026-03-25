import {
	BadRequestException,
	Injectable,
	Logger,
	ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import Stripe from 'stripe';

import { StripeEnum } from '../../enum/config.enum';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

@Injectable()
export class PayService {
	private readonly logger = new Logger(PayService.name);
	private readonly stripe: Stripe | null;
	/** 密钥填错时的说明（例如把 pk_ 当成了 Secret） */
	private readonly stripeConfigHint: string | null;

	constructor(private readonly config: ConfigService) {
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
		const line_items = [
			{
				quantity: 1,
				price_data: {
					currency: dto.currency,
					unit_amount: dto.amount,
					product_data: {
						name: dto.productName ?? '订单支付',
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
			},
		};

		if (dto.embedded === true) {
			const session = await stripe.checkout.sessions.create({
				...common,
				ui_mode: 'embedded',
				return_url: dto.returnUrl!,
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
				this.logger.log(
					`Stripe checkout.session.completed session=${session.id} userId=${session.metadata?.userId ?? session.client_reference_id ?? '-'}`,
				);
				break;
			}
			default:
				break;
		}
	}
}
