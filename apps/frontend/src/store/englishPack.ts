/**
 * 英语学习包（单词包/经典句）流式拉取的 UI 状态 Store（跨路由持久）。
 * - 进入英语包页面会用到此 Store，页面即使离开且 SSE 流未断开时，也能持续接收流式内容，保证 UI 状态完整。
 * - 再次进入英语学习页时，可以无缝展示当前进度与历史。
 */
import { makeAutoObservable, runInAction } from 'mobx';
import type { EnglishClassicQuoteItem, EnglishVocabularyItem } from '@/service';
import type { SearchOrganicItem } from '@/types/chat';

/**
 * UI 端进度的基础结构
 * - collected: 当前已收集条数
 * - target：目标条数
 * - round：当前询问轮次（用于“迭代”生成时UI进度展示）
 */
export type EnglishPackUiProgress = {
	collected: number;
	target: number;
	round: number;
};

/**
 * 跨路由持久化数据管理 - 维护单词包、经典句两类流式任务的 UI 状态。
 */
class EnglishPack {
	// —— 单词包相关 observables ——
	vocabStreamGenId = 0; // 流式拉取会话版本，每次新请求递增，用于判定回调归属
	vocabLoading = false; // 当前是否正在加载（流处理中）
	vocabProgress: EnglishPackUiProgress | null = null; // 当前拉取进度（流信息）
	vocabItems: EnglishVocabularyItem[] = []; // 当前已收集的单词包条目
	vocabAgentToolLine: string | null = null; // 工具响应行文案
	vocabMasterSearchOrganic: SearchOrganicItem[] = []; // 搜索引擎结果
	vocabAbort: ((fromUser?: boolean) => void) | null = null; // 存储当前流的 abort 回调（用于手动/自动终止 SSE）

	// —— 经典句相关 observables ——
	classicStreamGenId = 0; // 同理：经典句流式拉取会话版本
	classicLoading = false; // 经典句流是否正在加载
	classicProgress: EnglishPackUiProgress | null = null; // 经典句流进度
	classicItems: EnglishClassicQuoteItem[] = []; // 当前已收集的经典句条目
	classicAgentToolLine: string | null = null; // 工具响应行
	classicMasterSearchOrganic: SearchOrganicItem[] = []; // 搜索引擎结果
	classicAbort: ((fromUser?: boolean) => void) | null = null; // 当前经典句流终止回调

	constructor() {
		// 使所有状态自动响应式，并绑定 this
		makeAutoObservable(this);
	}

	// ——— 单词包逻辑方法 ———

	/**
	 * 启动一个新的流式单词包请求。
	 * 步骤：
	 * 1. 拉高 genId，使旧连接回调全部失效（只处理新 genId 的流事件）。
	 * 2. 如果有旧的 abort 回调，先调用终止上一次流。
	 * 3. 清理所有 UI相关状态到初始态，并设置 loading、进度等。
	 * 4. 返回本次流的 genId。
	 */
	startVocabStream(effectiveTarget: number): number {
		runInAction(() => {
			this.vocabStreamGenId += 1; // 新会话 genId 增
			this.vocabAbort?.(); // 如果有旧流 callback，先终止
			this.vocabAbort = null; // 清空 callback
			this.vocabLoading = true; // 进入 loading 状态
			this.vocabAgentToolLine = null; // 清工具文案
			this.vocabMasterSearchOrganic = []; // 清网页搜索
			this.vocabProgress = {
				collected: 0,
				target: effectiveTarget,
				round: 0,
			}; // 初始化进度
			this.vocabItems = []; // 清已收集词条
		});
		return this.vocabStreamGenId;
	}

	/**
	 * 设置当前词包流的 abort 终止回调。
	 * - 拉流请求由外部生成 abort 方法传入
	 */
	setVocabAbort(fn: ((fromUser?: boolean) => void) | null) {
		this.vocabAbort = fn;
	}

	/**
	 * 拉词包流途中，收到进度更新。
	 * - 若 genId 匹配，更新进度；否则忽略（防止竞态）。
	 */
	vocabOnProgress(gen: number, p: EnglishPackUiProgress) {
		if (gen !== this.vocabStreamGenId) return;
		runInAction(() => {
			this.vocabProgress = p;
		});
	}

	/**
	 * 工具状态同步。
	 * - organic 数组不为空时，仅更新网页搜索内容
	 * - 否则更新工具响应行文案（如提示，辅助信息等）
	 */
	vocabOnAgentTool(
		gen: number,
		line: string | null,
		organic: SearchOrganicItem[],
	) {
		if (gen !== this.vocabStreamGenId) return;
		runInAction(() => {
			if (organic.length) {
				this.vocabMasterSearchOrganic = organic;
				return;
			}
			this.vocabAgentToolLine = line;
		});
	}

	/**
	 * 拉流中收到一批新词条 chunk。
	 * - 若 gen 匹配，则将 delta 末尾追加到 items，并清空工具状态文案
	 */
	vocabOnChunk(gen: number, delta: EnglishVocabularyItem[]) {
		if (gen !== this.vocabStreamGenId || !delta.length) return;
		runInAction(() => {
			this.vocabAgentToolLine = null;
			this.vocabItems = [...this.vocabItems, ...delta];
		});
	}

	/**
	 * 拉词包流完成（服务端 end）。
	 * - 收到完整列表后，重设 loading 状态及所有 callback/UI 状态
	 * - items 以最终列表覆盖
	 */
	vocabOnDone(gen: number, list: EnglishVocabularyItem[]) {
		if (gen !== this.vocabStreamGenId) return;
		runInAction(() => {
			this.vocabAbort = null;
			this.vocabLoading = false;
			this.vocabAgentToolLine = null;
			this.vocabProgress = null;
			this.vocabItems = list;
		});
	}

	/**
	 * 拉词包遇到错误（如 SSE 断线等）。
	 * - 清除 abort、loading 状态、辅助行、进度等
	 */
	vocabOnError(gen: number) {
		if (gen !== this.vocabStreamGenId) return;
		runInAction(() => {
			this.vocabAbort = null;
			this.vocabLoading = false;
			this.vocabAgentToolLine = null;
			this.vocabProgress = null;
		});
	}

	/**
	 * 用户主动终止词包拉流。
	 * - UI 上与 vocabOnError 逻辑一致，仅区分来源
	 */
	vocabOnUserAbort(gen: number) {
		if (gen !== this.vocabStreamGenId) return;
		runInAction(() => {
			this.vocabAbort = null;
			this.vocabLoading = false;
			this.vocabAgentToolLine = null;
			this.vocabProgress = null;
		});
	}

	/**
	 * 拉词包服务端返回 incomplete（即任务中断，非正常完结）。
	 * - 处理同上
	 */
	vocabOnIncomplete(gen: number) {
		if (gen !== this.vocabStreamGenId) return;
		runInAction(() => {
			this.vocabAbort = null;
			this.vocabLoading = false;
			this.vocabAgentToolLine = null;
			this.vocabProgress = null;
		});
	}

	/**
	 * 用户点击“停止”按钮主动终止 SSE，与 vocabOnUserAbort 逻辑配合。
	 * - 首先通知后端/断开 SSE
	 * - 然后清理 UI 各项状态（loading/辅助行/搜索/进度等）
	 */
	vocabCancelByUser() {
		this.vocabAbort?.(true);
		runInAction(() => {
			this.vocabAbort = null;
			this.vocabLoading = false;
			this.vocabAgentToolLine = null;
			this.vocabMasterSearchOrganic = [];
			this.vocabProgress = null;
		});
	}

	/**
	 * 从历史详情页载入词包及相关网页搜索内容，复现之前的展示。
	 * - 主用于“历史记录”详情页面复用此 Store
	 */
	vocabLoadHistoryDetail(
		items: EnglishVocabularyItem[],
		organic: SearchOrganicItem[],
	) {
		runInAction(() => {
			this.vocabItems = items;
			this.vocabMasterSearchOrganic = organic;
			this.vocabLoading = false;
			this.vocabAgentToolLine = null;
			this.vocabProgress = null;
		});
	}

	// ——— 经典句逻辑方法 ———

	/**
	 * 启动新的经典句任务流。
	 * 步骤同 vocab，见注释。
	 */
	startClassicStream(effectiveTarget: number): number {
		runInAction(() => {
			this.classicStreamGenId += 1;
			this.classicAbort?.();
			this.classicAbort = null;
			this.classicLoading = true;
			this.classicAgentToolLine = null;
			this.classicMasterSearchOrganic = [];
			this.classicProgress = {
				collected: 0,
				target: effectiveTarget,
				round: 0,
			};
			this.classicItems = [];
		});
		return this.classicStreamGenId;
	}

	/**
	 * 设置当前经典句流的 abort 终止函数
	 */
	setClassicAbort(fn: ((fromUser?: boolean) => void) | null) {
		this.classicAbort = fn;
	}

	/**
	 * 经典句流：进度回调
	 */
	classicOnProgress(gen: number, p: EnglishPackUiProgress) {
		if (gen !== this.classicStreamGenId) return;
		runInAction(() => {
			this.classicProgress = p;
		});
	}

	/**
	 * 经典句流：工具行和 organic 更新
	 */
	classicOnAgentTool(
		gen: number,
		line: string | null,
		organic: SearchOrganicItem[],
	) {
		if (gen !== this.classicStreamGenId) return;
		runInAction(() => {
			if (organic.length) {
				this.classicMasterSearchOrganic = organic;
				return;
			}
			this.classicAgentToolLine = line;
		});
	}

	/**
	 * 经典句流：新 chunk 增量
	 */
	classicOnChunk(gen: number, delta: EnglishClassicQuoteItem[]) {
		if (gen !== this.classicStreamGenId || !delta.length) return;
		runInAction(() => {
			this.classicAgentToolLine = null;
			this.classicItems = [...this.classicItems, ...delta];
		});
	}

	/**
	 * 经典句流完成处理
	 */
	classicOnDone(gen: number, list: EnglishClassicQuoteItem[]) {
		if (gen !== this.classicStreamGenId) return;
		runInAction(() => {
			this.classicAbort = null;
			this.classicLoading = false;
			this.classicAgentToolLine = null;
			this.classicProgress = null;
			this.classicItems = list;
		});
	}

	/**
	 * 经典句流错误
	 */
	classicOnError(gen: number) {
		if (gen !== this.classicStreamGenId) return;
		runInAction(() => {
			this.classicAbort = null;
			this.classicLoading = false;
			this.classicAgentToolLine = null;
			this.classicProgress = null;
		});
	}

	/**
	 * 经典句流被用户终止
	 */
	classicOnUserAbort(gen: number) {
		if (gen !== this.classicStreamGenId) return;
		runInAction(() => {
			this.classicAbort = null;
			this.classicLoading = false;
			this.classicAgentToolLine = null;
			this.classicProgress = null;
		});
	}

	/**
	 * 经典句流 incomplete 处理
	 */
	classicOnIncomplete(gen: number) {
		if (gen !== this.classicStreamGenId) return;
		runInAction(() => {
			this.classicAbort = null;
			this.classicLoading = false;
			this.classicAgentToolLine = null;
			this.classicProgress = null;
		});
	}

	/**
	 * 用户手动点击“停止”经典句流
	 * - 类似 vocabCancelByUser
	 */
	classicCancelByUser() {
		this.classicAbort?.(true);
		runInAction(() => {
			this.classicAbort = null;
			this.classicLoading = false;
			this.classicAgentToolLine = null;
			this.classicMasterSearchOrganic = [];
			this.classicProgress = null;
		});
	}

	/**
	 * 经典句历史详情加载
	 */
	classicLoadHistoryDetail(
		items: EnglishClassicQuoteItem[],
		organic: SearchOrganicItem[],
	) {
		runInAction(() => {
			this.classicItems = items;
			this.classicMasterSearchOrganic = organic;
			this.classicLoading = false;
			this.classicAgentToolLine = null;
			this.classicProgress = null;
		});
	}
}

// 单例导出，始终唯一
export const EnglishPackStore = new EnglishPack();
export default EnglishPackStore;
