import { makeAutoObservable } from 'mobx';

class AuthStore {
	constructor() {
		makeAutoObservable(this);
	}

	token = '';

	setToken(token: string) {
		this.token = token;
	}

	get getToken() {
		return this.token;
	}
}

export default new AuthStore();
