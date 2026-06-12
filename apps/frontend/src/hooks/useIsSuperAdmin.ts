import { useEffect, useState } from 'react';
import { USER_INFO_STORAGE_KEY } from '@/store/loggedInUserId';
import { getStorage } from '@/utils';

type UserRoleLike = { id?: number; name?: string };

type UserInfoLike = {
	id?: number;
	roles?: UserRoleLike[] | null;
};

/** 根据 userInfo 判断是否超级管理员（与后端 userHasSuperAdminRole 对齐） */
export function checkIsSuperAdmin(
	userInfo: UserInfoLike | null | undefined,
): boolean {
	const id = Number(userInfo?.id);
	if (!Number.isFinite(id) || id <= 0) return false;
	const roles = userInfo?.roles;
	if (!Array.isArray(roles) || roles.length === 0) return false;
	return roles.some(
		(r) => r?.id === 1 || r?.name === '超级管理员' || r?.name === 'Super Admin',
	);
}

/** 当前登录用户是否为超级管理员（随 userInfo 变更自动更新） */
export function useIsSuperAdmin(): boolean {
	const [userInfo, setUserInfo] = useState(() =>
		JSON.parse(getStorage(USER_INFO_STORAGE_KEY) || '{}'),
	);

	useEffect(() => {
		const sync = () =>
			setUserInfo(JSON.parse(getStorage(USER_INFO_STORAGE_KEY) || '{}'));
		window.addEventListener('storage', sync);
		window.addEventListener('userInfoChanged', sync);
		return () => {
			window.removeEventListener('storage', sync);
			window.removeEventListener('userInfoChanged', sync);
		};
	}, []);

	return checkIsSuperAdmin(userInfo);
}
