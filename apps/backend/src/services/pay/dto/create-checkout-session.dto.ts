import { Transform, Type } from 'class-transformer';
import {
	IsBoolean,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	IsUrl,
	Max,
	MaxLength,
	Min,
	ValidateIf,
} from 'class-validator';

/** Stripe 支持的常用货币（小写 ISO 4217） */
export const CHECKOUT_CURRENCIES = [
	'usd',
	'cny',
	'eur',
	'hkd',
	'jpy',
	'gbp',
] as const;

export class CreateCheckoutSessionDto {
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(999_999_999)
	amount!: number;

	@IsString()
	@IsIn([...CHECKOUT_CURRENCIES])
	currency!: string;

	@IsOptional()
	@IsString()
	@MaxLength(120)
	productName?: string;

	/** 为 true 时使用 Embedded Checkout（页面内嵌，redirect_on_completion: never） */
	@IsOptional()
	@Transform(({ value }) => value === true || value === 'true')
	@IsBoolean()
	embedded?: boolean;

	/** 托管跳转模式：支付成功页 */
	@ValidateIf((o) => !o.embedded)
	@IsUrl({ require_tld: false, protocols: ['http', 'https'] })
	successUrl?: string;

	/** 托管跳转模式：用户取消时跳转页（embedded 模式不支持 cancel_url，无需传） */
	@ValidateIf((o) => !o.embedded)
	@IsUrl({ require_tld: false, protocols: ['http', 'https'] })
	cancelUrl?: string;
}
