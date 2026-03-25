import {
	BadRequestException,
	Body,
	Controller,
	Headers,
	HttpCode,
	HttpStatus,
	Post,
	Req,
	UnauthorizedException,
	UseGuards,
	UseInterceptors,
	UsePipes,
	ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';

import { JwtGuard } from '../../guards/jwt.guard';
import { ResponseInterceptor } from '../../interceptors/response.interceptor';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { PayService } from './pay.service';

@Controller('pay')
export class PayController {
	constructor(private readonly payService: PayService) {}

	@Post('createCheckoutSession')
	@UseGuards(JwtGuard)
	@UseInterceptors(ResponseInterceptor)
	@UsePipes(
		new ValidationPipe({
			transform: true,
			whitelist: true,
		}),
	)
	async createCheckoutSession(
		@Body() dto: CreateCheckoutSessionDto,
		@Req() req: Request & { user?: { userId?: number } },
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('无法识别当前用户');
		}
		return this.payService.createCheckoutSession(dto, userId);
	}

	/**
	 * Stripe Webhook：在 Dashboard 或使用 `stripe listen --forward-to localhost:9112/api/pay/webhook` 配置。
	 * 响应体保持简洁，不使用 ResponseInterceptor。
	 */
	@Post('webhook')
	@HttpCode(HttpStatus.OK)
	async webhook(
		@Headers('stripe-signature') signature: string | undefined,
		@Req() req: Request & { rawBody?: Buffer },
	) {
		if (!signature) {
			throw new BadRequestException('缺少 Stripe-Signature 请求头');
		}
		try {
			const event = this.payService.constructWebhookEvent(req, signature);
			await this.payService.handleWebhookEvent(event);
			return { received: true };
		} catch (e) {
			if (e instanceof Stripe.errors.StripeSignatureVerificationError) {
				throw new BadRequestException('Webhook 签名校验失败');
			}
			throw e;
		}
	}
}
