export const MEMBERSHIP_PLAN_CODES = [
	'membership_monthly',
	'membership_quarterly',
	'membership_yearly',
] as const;

export type MembershipPlanCode = (typeof MEMBERSHIP_PLAN_CODES)[number];

export type MembershipPlanDefinition = {
	code: MembershipPlanCode;
	priceYuan: number;
	durationDays: number;
};

export const MEMBERSHIP_PLANS: Record<
	MembershipPlanCode,
	MembershipPlanDefinition
> = {
	membership_monthly: {
		code: 'membership_monthly',
		priceYuan: 9.9,
		durationDays: 30,
	},
	membership_quarterly: {
		code: 'membership_quarterly',
		priceYuan: 25.9,
		durationDays: 90,
	},
	membership_yearly: {
		code: 'membership_yearly',
		priceYuan: 99.9,
		durationDays: 365,
	},
};

export const MEMBERSHIP_PLAN_LIST = MEMBERSHIP_PLAN_CODES.map(
	(code) => MEMBERSHIP_PLANS[code],
);

export const DEFAULT_MEMBERSHIP_PLAN: MembershipPlanCode = 'membership_monthly';

export function formatMembershipPriceYuan(priceYuan: number): string {
	return priceYuan.toFixed(1);
}
