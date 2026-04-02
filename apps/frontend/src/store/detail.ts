import { makeAutoObservable } from 'mobx';

import type { SaveKnowledgeMarkdownPayload } from '@/utils/knowledge-save';

/** 知识编辑：与上次保存或从列表载入对齐的快照，用于脏检查 */
export type KnowledgePersistedSnapshot = { title: string; content: string };

class DetailStore {
	constructor() {
		makeAutoObservable(this);
	}

	markdown = '';

	/** 知识编辑页标题（与 markdown 同存于 store，路由切换不丢失） */
	knowledgeTitle = '';

	/** 正在编辑的云端知识 id；null 表示新建草稿 */
	knowledgeEditingKnowledgeId: string | null = null;

	/** 桌面端：打开该条时的原标题，用于本地 .md 重命名 */
	knowledgeLocalDiskTitle: string | null = null;

	/** 上次成功保存或载入后的标题 trim + 正文 */
	knowledgePersistedSnapshot: KnowledgePersistedSnapshot = {
		title: '',
		content: '',
	};

	/** Tauri 覆盖确认弹窗：与草稿同在 store，离开知识页再进入仍可继续确认 */
	knowledgeOverwriteOpen = false;

	knowledgeOverwriteTargetPath = '';

	knowledgePendingSavePayload: SaveKnowledgeMarkdownPayload | null = null;

	setMarkdown(value: string) {
		this.markdown = value;
	}

	setKnowledgeTitle(value: string) {
		this.knowledgeTitle = value;
	}

	setKnowledgeEditingKnowledgeId(id: string | null) {
		this.knowledgeEditingKnowledgeId = id;
	}

	setKnowledgeLocalDiskTitle(value: string | null) {
		this.knowledgeLocalDiskTitle = value;
	}

	setKnowledgePersistedSnapshot(snapshot: KnowledgePersistedSnapshot) {
		this.knowledgePersistedSnapshot = snapshot;
	}

	/** 打开「覆盖已有文件」确认（桌面端保存冲突时） */
	openKnowledgeOverwriteConfirm(
		targetPath: string,
		payload: SaveKnowledgeMarkdownPayload,
	) {
		this.knowledgeOverwriteTargetPath = targetPath;
		this.knowledgePendingSavePayload = payload;
		this.knowledgeOverwriteOpen = true;
	}

	/** 关闭覆盖确认并清空挂起的保存入参 */
	setKnowledgeOverwriteOpen(open: boolean) {
		this.knowledgeOverwriteOpen = open;
		if (!open) {
			this.knowledgeOverwriteTargetPath = '';
			this.knowledgePendingSavePayload = null;
		}
	}

	/** 清空知识草稿（标题、编辑 id、快照、正文、覆盖弹窗状态） */
	clearKnowledgeDraft() {
		this.knowledgeTitle = '';
		this.knowledgeEditingKnowledgeId = null;
		this.knowledgeLocalDiskTitle = null;
		this.knowledgePersistedSnapshot = { title: '', content: '' };
		this.markdown = '';
		this.knowledgeOverwriteOpen = false;
		this.knowledgeOverwriteTargetPath = '';
		this.knowledgePendingSavePayload = null;
	}

	get getMarkdown() {
		return this.markdown;
	}
}

export default new DetailStore();
