import { makeAutoObservable, runInAction } from 'mobx';
import { authApi } from '@/service';
import type { LoginResponse, User } from '@/types';

const TOKEN_KEY = 'admin_access_token';
const USER_KEY = 'admin_user';

class AuthStore {
	accessToken: string | null = null;
	user: User | null = null;

	constructor() {
		makeAutoObservable(this);
		this.initFromStorage();
	}

	private initFromStorage() {
		try {
			this.accessToken = localStorage.getItem(TOKEN_KEY);
			const userStr = localStorage.getItem(USER_KEY);
			if (userStr) {
				this.user = JSON.parse(userStr);
			}
		} catch (e) {
			console.error('Failed to restore auth state:', e);
		}
	}

	get isLoggedIn(): boolean {
		return !!this.accessToken && !!this.user;
	}

	/** 是否拥有管理员角色（Role.ADMIN = 1） */
	get isAdmin(): boolean {
		return !!this.user?.roles?.some((r) => r.id === 1);
	}

	/** 是否拥有管理员或更高权限 */
	get isSuperAdmin(): boolean {
		return this.isAdmin;
	}

	/**
	 * 登录成功后设置状态
	 * 后端 login 返回 { access_token, ...userInfo }
	 */
	setLoginResponse(res: LoginResponse) {
		const { access_token, ...userInfo } = res;
		this.accessToken = access_token;
		this.user = userInfo as User;
		localStorage.setItem(TOKEN_KEY, access_token);
		localStorage.setItem(USER_KEY, JSON.stringify(userInfo));
	}

	/**
	 * 用户名 + 密码 + 图形验证码登录
	 */
	async login(
		username: string,
		password: string,
		captchaText: string,
		captchaId: string,
	) {
		const res = await authApi.login({
			username,
			password,
			captchaText,
			captchaId,
		});
		runInAction(() => {
			this.setLoginResponse(res);
		});
		return res;
	}

	logout() {
		this.accessToken = null;
		this.user = null;
		localStorage.removeItem(TOKEN_KEY);
		localStorage.removeItem(USER_KEY);
		try {
			authApi.logout().catch(() => {});
		} catch {
			// ignore
		}
	}
}

export const authStore = new AuthStore();
