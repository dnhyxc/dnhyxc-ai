import { useMemo } from 'react';
import useStore from '@/store';

/** userInfo 上可能出现的会员相关字段（含历史命名） */
export type MembershipUserInfoLike = Record<string, unknown>;

function levelPositive(v: unknown): boolean {
	return (
		(typeof v === 'number' && v > 0) ||
		(typeof v === 'string' &&
			v.trim() !== '' &&
			v !== '0' &&
			!/^(free|none)$/i.test(v.trim()))
	);
}

/** 读取会员到期时间原始字符串（兼容 memberExpireAt） */
export function getMemberExpiresAtRaw(
	user: MembershipUserInfoLike | null | undefined,
): string | null {
	if (!user || typeof user !== 'object') return null;
	const raw = user.memberExpiresAt ?? user.memberExpireAt;
	if (raw == null) return null;
	const s = String(raw).trim();
	return s === '' ? null : s;
}

/** 解析会员到期时间为 Date；无效则 null */
export function parseMemberExpiresAt(
	user: MembershipUserInfoLike | null | undefined,
): Date | null {
	const raw = getMemberExpiresAtRaw(user);
	if (!raw) return null;
	const exp = new Date(raw);
	return Number.isNaN(exp.getTime()) ? null : exp;
}

/**
 * 当前用户是否为有效会员。
 * 优先与后端 `UserService.isMembershipActive` 对齐（isMember + memberExpiresAt）；
 * 并兼容本地缓存中仅有到期时间或旧字段（member / vip / membershipLevel 等）的情况。
 */
export function isMembershipActiveFromUserInfo(
	user: MembershipUserInfoLike | null | undefined,
	now: Date = new Date(),
): boolean {
	if (!user || typeof user !== 'object') return false;

	const expiresRaw = getMemberExpiresAtRaw(user);
	if (expiresRaw) {
		const exp = new Date(expiresRaw);
		if (!Number.isNaN(exp.getTime())) {
			return exp.getTime() > now.getTime();
		}
	}

	if (user.isMember === true) return true;
	if (user.isMember === false) return false;

	if (user.member === true || user.vip === true) return true;

	if (
		levelPositive(user.membershipLevel) ||
		levelPositive(user.memberLevel) ||
		levelPositive(user.vipLevel)
	) {
		return true;
	}

	const typeRaw = user.membershipType ?? user.memberType ?? user.userMemberType;
	if (typeof typeRaw === 'string') {
		const s = typeRaw.trim().toLowerCase();
		if (['vip', 'pro', 'paid', 'premium', 'plus'].includes(s)) return true;
	}

	return false;
}

/** 从 userStore 读取当前登录用户的会员状态（需在 observer 组件内使用以响应 MobX 更新） */
export function useMembershipActive() {
	const { userStore } = useStore();
	const userInfo = userStore.userInfo;

	const isMemberActive = useMemo(
		() => isMembershipActiveFromUserInfo(userInfo),
		[userInfo],
	);

	const memberExpiresAt = useMemo(
		() => parseMemberExpiresAt(userInfo),
		[userInfo],
	);

	return {
		isMemberActive,
		memberExpiresAt,
		userInfo,
	};
}
