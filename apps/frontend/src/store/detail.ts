import { makeAutoObservable } from 'mobx';

class DetailStore {
	constructor() {
		makeAutoObservable(this);
	}

	markdown = '';

	setMarkdown(value: string) {
		this.markdown = value;
	}

	get getMarkdown() {
		return this.markdown;
	}
}

export default new DetailStore();
