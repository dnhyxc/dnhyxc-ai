/**
 * 今日记词：待学词数。首页侧栏加载后写入，记词页直接读。
 */
import { makeAutoObservable } from 'mobx';

class EnglishDailyStore {
	constructor() {
		makeAutoObservable(this);
	}

	/** null：还没加载过 */
	libraryCount: number | null = null;
	libraryCountLoading = false;

	beginLibraryCount() {
		this.libraryCountLoading = true;
	}

	setLibraryCount(n: number) {
		this.libraryCount = n;
		this.libraryCountLoading = false;
	}
}

export default new EnglishDailyStore();
