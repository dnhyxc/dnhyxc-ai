/**
 * 今日记词：待学词数 / 已练数。首页侧栏加载后写入，记词页直接读。
 */
import { makeAutoObservable } from 'mobx';

class EnglishDailyStore {
	constructor() {
		makeAutoObservable(this);
	}

	/** null：还没加载过 */
	libraryCount: number | null = null;
	/** 已写入记词记录数；null：还没加载过 */
	memorizedCount: number | null = null;
	libraryCountLoading = false;

	beginLibraryCount() {
		this.libraryCountLoading = true;
	}

	setLibraryCount(n: number) {
		this.libraryCount = n;
		this.libraryCountLoading = false;
	}

	setMemorizedCount(n: number) {
		this.memorizedCount = n;
	}

	/** 词库总量 ≈ 已练 + 待学（与首页侧栏同口径） */
	get poolTotal(): number | null {
		if (this.memorizedCount == null || this.libraryCount == null) return null;
		return this.memorizedCount + this.libraryCount;
	}
}

export default new EnglishDailyStore();
