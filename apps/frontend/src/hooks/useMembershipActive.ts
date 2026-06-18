import { useMemo } from 'react';
import useStore from '@/store';
import {
	isMembershipActiveFromUserInfo,
	type MembershipUserInfoLike,
	parseMemberExpiresAt,
} from '@/utils/membershipActive';

export {
	getMemberExpiresAtRaw,
	isMembershipActiveFromUserInfo,
	parseMemberExpiresAt,
} from '@/utils/membershipActive';
export type { MembershipUserInfoLike };

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
