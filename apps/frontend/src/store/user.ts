import { makeAutoObservable } from 'mobx';

import { getStorage, removeStorage, setStorage } from '@/utils';

import { USER_INFO_STORAGE_KEY } from './loggedInUserId';
import { resetUserState } from './resetUserState';

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
			avatar: '',
			address: '',
		},
	};
}

type UserInfoShape = ReturnType<typeof createDefaultUserInfo>;

function normalizeUserId(info: UserInfoShape | null | undefined): number {
	const id = Number(info?.id);
	return Number.isFinite(id) && id > 0 ? id : 0;
}

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
		const prevId = normalizeUserId(this.userInfo);
		const nextId = normalizeUserId(userInfo as UserInfoShape);
		if (prevId !== nextId) {
			resetUserState();
		}
		this.userInfo = userInfo as UserInfoShape;
		setStorage(USER_INFO_STORAGE_KEY, JSON.stringify(userInfo));
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new Event('userInfoChanged'));
		}
	}

	/** 登出等场景：清空内存并与 localStorage 一致 */
	clearUserInfo() {
		const hadUser = normalizeUserId(this.userInfo) > 0;
		this.userInfo = createDefaultUserInfo();
		removeStorage(USER_INFO_STORAGE_KEY);
		if (hadUser) {
			resetUserState();
		}
	}
}

export default new UserStore();
