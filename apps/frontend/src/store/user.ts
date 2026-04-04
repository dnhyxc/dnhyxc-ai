import { makeAutoObservable } from 'mobx';

import { getStorage, removeStorage, setStorage } from '@/utils';

const USER_INFO_STORAGE_KEY = 'userInfo';

function createDefaultUserInfo() {
	return {
		id: 0,
		username: '',
		email: '',
		roles: [
			{ id: 1, name: '超级管理员', menus: [] as unknown[] },
			{ id: 2, name: '管理员', menus: [] as unknown[] },
		],
		profile: {
			id: 0,
			gender: 0,
			email: '',
			avatar: '',
		},
	};
}

type UserInfoShape = ReturnType<typeof createDefaultUserInfo>;

function readUserInfoFromStorage(): UserInfoShape | null {
	const raw = getStorage(USER_INFO_STORAGE_KEY);
	if (!raw?.trim()) return null;
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		if (!parsed || typeof parsed !== 'object') return null;
		const base = createDefaultUserInfo();
		const profile =
			parsed.profile && typeof parsed.profile === 'object'
				? { ...base.profile, ...(parsed.profile as object) }
				: base.profile;
		const roles = Array.isArray(parsed.roles) ? parsed.roles : base.roles;
		return {
			...base,
			...parsed,
			roles: roles as UserInfoShape['roles'],
			profile,
		} as UserInfoShape;
	} catch {
		return null;
	}
}

class UserStore {
	userInfo: UserInfoShape = createDefaultUserInfo();

	constructor() {
		makeAutoObservable(this);
		const stored = readUserInfoFromStorage();
		if (stored) {
			this.userInfo = stored;
		}
	}

	setUserInfo(userInfo: any) {
		this.userInfo = userInfo as UserInfoShape;
		setStorage(USER_INFO_STORAGE_KEY, JSON.stringify(userInfo));
	}

	/** 登出等场景：清空内存并与 localStorage 一致 */
	clearUserInfo() {
		this.userInfo = createDefaultUserInfo();
		removeStorage(USER_INFO_STORAGE_KEY);
	}
}

export default new UserStore();
