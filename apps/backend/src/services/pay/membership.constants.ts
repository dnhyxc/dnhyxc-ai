/** 会员套餐 code（前后端需保持一致） */
export const MEMBERSHIP_PLAN_CODES = [
	'membership_monthly',
	'membership_quarterly',
	'membership_yearly',
] as const;

export type MembershipPlanCode = (typeof MEMBERSHIP_PLAN_CODES)[number];

export type MembershipPlanDefinition = {
	code: MembershipPlanCode;
	/** 展示价（元） */
	priceYuan: number;
	/** Stripe 最小货币单位（CNY 分） */
	amountMinorUnits: number;
	durationDays: number;
	/** 默认商品名（可被 i18n 覆盖） */
	defaultProductName: string;
};

export const MEMBERSHIP_PLANS: Record<
	MembershipPlanCode,
	MembershipPlanDefinition
> = {
	membership_monthly: {
		code: 'membership_monthly',
		priceYuan: 9.9,
		amountMinorUnits: 990,
		durationDays: 30,
		defaultProductName: '月度会员',
	},
	membership_quarterly: {
		code: 'membership_quarterly',
		priceYuan: 25.9,
		amountMinorUnits: 2590,
		durationDays: 90,
		defaultProductName: '季度会员',
	},
	membership_yearly: {
		code: 'membership_yearly',
		priceYuan: 99.9,
		amountMinorUnits: 9990,
		durationDays: 365,
		defaultProductName: '年度会员',
	},
};

export const DEFAULT_MEMBERSHIP_PLAN: MembershipPlanCode = 'membership_monthly';

export function getMembershipPlan(
	code: string | undefined,
): MembershipPlanDefinition | null {
	if (!code) return null;
	return MEMBERSHIP_PLANS[code as MembershipPlanCode] ?? null;
}

/** 会员充值默认有效天数（Stripe 未传 membershipDays 时使用） */
export const DEFAULT_MEMBERSHIP_DURATION_DAYS = 30;

export const DEFAULT_MEMBERSHIP_TYPE = 'premium';

export function resolveMembershipDays(input?: number): number {
	if (input != null && Number.isFinite(input) && input >= 1) {
		return Math.min(Math.floor(input), 3650);
	}
	return DEFAULT_MEMBERSHIP_DURATION_DAYS;
}

export function parseMembershipDaysFromMetadata(
	value: string | undefined,
	planCode?: string,
): number {
	const fromPlan = getMembershipPlan(planCode)?.durationDays;
	if (fromPlan != null) return fromPlan;
	if (!value?.trim()) return DEFAULT_MEMBERSHIP_DURATION_DAYS;
	const n = Number.parseInt(value, 10);
	return resolveMembershipDays(Number.isFinite(n) ? n : undefined);
}
