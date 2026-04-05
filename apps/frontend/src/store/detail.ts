import { makeAutoObservable } from 'mobx';

import type { SaveKnowledgeMarkdownPayload } from '@/utils/knowledge-save';

/** 知识编辑：与上次保存或从列表载入对齐的快照，用于脏检查 */
export type KnowledgePersistedSnapshot = { title: string; content: string };

/** 从 Markdown 正文推断默认标题：优先首条非空标题行，否则带时间戳的「对话摘录」 */
function deriveKnowledgeTitleFromMarkdown(markdown: string): string {
	const lines = markdown.split(/\r?\n/);
	for (const line of lines) {
		const t = line.trim();
		if (!t) continue;
		const withoutHash = t.replace(/^#{1,6}\s*/, '').trim();
		if (withoutHash) {
			return withoutHash.length > 80
				? `${withoutHash.slice(0, 80)}…`
				: withoutHash;
		}
	}
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `对话摘录-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

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

	/**
	 * 从本地文件夹列表打开时：保存/解析冲突时使用的目录（该文件所在目录）；
	 * 云端条目为 null，沿用 TAURI_KNOWLEDGE_DIR
	 */
	knowledgeLocalDirPath: string | null = null;

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

	setKnowledgeLocalDirPath(value: string | null) {
		this.knowledgeLocalDirPath = value;
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
		this.knowledgeLocalDirPath = null;
		this.knowledgePersistedSnapshot = { title: '', content: '' };
		this.markdown = '';
		this.knowledgeOverwriteOpen = false;
		this.knowledgeOverwriteTargetPath = '';
		this.knowledgePendingSavePayload = null;
	}

	/**
	 * 用助手回复填充知识库草稿（新条目），不调用接口。
	 * 用于聊天页「保存到知识库」后跳转编辑。
	 */
	applyKnowledgeDraftFromChatReply(markdown: string) {
		const body = markdown.trim();
		if (!body) return;
		this.setKnowledgeOverwriteOpen(false);
		this.knowledgeEditingKnowledgeId = null;
		this.knowledgeLocalDiskTitle = null;
		this.knowledgeLocalDirPath = null;
		this.markdown = body;
		this.knowledgeTitle = deriveKnowledgeTitleFromMarkdown(body);
		// 空快照：与当前内容不一致，展示未保存标识并允许保存
		this.knowledgePersistedSnapshot = { title: '', content: '' };
	}

	get getMarkdown() {
		return this.markdown;
	}
}

export default new DetailStore();
