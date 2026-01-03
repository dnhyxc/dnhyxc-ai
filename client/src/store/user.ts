import { makeAutoObservable } from 'mobx';

class UserStore {
	constructor() {
		makeAutoObservable(this);
	}

	userInfo = {
		id: 0,
		username: '',
		email: '',
		roles: [
			{ id: 1, name: '超级管理员', menus: [] },
			{ id: 2, name: '管理员', menus: [] },
		],
		profile: {
			id: 0,
			gender: 0,
			email: '',
			avatar: '',
		},
	};

	setUserInfo(userInfo: any) {
		console.log('setUserInfo', userInfo);
		this.userInfo = userInfo;
	}
}

export default new UserStore();
