/**
 * Skill / Prompt：列表、编辑草稿、知识库 `/` 多选芯片。
 * 页面可直接 import，不必挂 root store（同 assistantStore）。
 */
import { Toast } from '@ui/index';
import { makeAutoObservable, runInAction } from 'mobx';
import { translateSync } from '@/i18n';
import {
	deleteSkill,
	getSkillDetail,
	listSkills,
	type SkillRecord,
	saveSkill,
	updateSkill,
} from '@/service';
import skillTryStore from '@/store/skillTry';

class SkillStore {
	list: SkillRecord[] = [];
	/** 知识库助手 `/` 选中的 Skill（发送 Agent 时带 skillIds） */
	selectedSkillIds: string[] = [];
	editingId: string | null = null;
	title = '';
	content = '';
	/** 上次载入/保存后的标题（trim 比对） */
	persistedTitle = '';
	/** 上次载入/保存后的正文（原文比对） */
	persistedContent = '';
	loadingList = false;
	saving = false;
	loadingDetail = false;

	constructor() {
		makeAutoObservable(this);
	}

	get selectedSkills(): SkillRecord[] {
		const map = new Map(this.list.map((s) => [s.id, s]));
		return this.selectedSkillIds
			.map((id) => map.get(id))
			.filter((s): s is SkillRecord => Boolean(s));
	}

	/** 标题或正文相对 persisted 快照有未保存变更（含新建已输入） */
	get isDraftDirty(): boolean {
		return (
			this.title.trim() !== this.persistedTitle ||
			this.content !== this.persistedContent
		);
	}

	private markPersisted(title: string, content: string): void {
		this.persistedTitle = title.trim();
		this.persistedContent = content;
	}

	async loadList(): Promise<void> {
		if (this.loadingList) return;
		this.loadingList = true;
		try {
			const res = await listSkills();
			runInAction(() => {
				this.list = Array.isArray(res.data) ? res.data : [];
			});
		} catch {
			Toast({ type: 'error', title: '加载 Skill 列表失败' });
		} finally {
			runInAction(() => {
				this.loadingList = false;
			});
		}
	}

	createNew(): void {
		this.editingId = null;
		this.title = '';
		this.content = '';
		this.markPersisted('', '');
		skillTryStore.syncEditorBaseline('', '');
	}

	async openSkill(id: string): Promise<void> {
		const cached = this.list.find((s) => s.id === id);
		if (cached) {
			this.editingId = cached.id;
			this.title = cached.title;
			this.content = cached.content;
			this.markPersisted(cached.title, cached.content);
			skillTryStore.syncEditorBaseline(cached.title, cached.content);
		}
		this.loadingDetail = true;
		try {
			const res = await getSkillDetail(id);
			const row = res.data;
			if (!row?.id) return;
			runInAction(() => {
				this.editingId = row.id;
				this.title = row.title ?? '';
				this.content = row.content ?? '';
				this.markPersisted(this.title, this.content);
				const idx = this.list.findIndex((s) => s.id === row.id);
				if (idx >= 0) this.list[idx] = row;
				else this.list = [row, ...this.list];
			});
			skillTryStore.syncEditorBaseline(row.title ?? '', row.content ?? '');
		} catch {
			Toast({ type: 'error', title: '加载 Skill 失败' });
		} finally {
			runInAction(() => {
				this.loadingDetail = false;
			});
		}
	}

	setTitle(v: string): void {
		this.title = v;
	}

	setContent(v: string): void {
		this.content = v;
	}

	async save(): Promise<boolean> {
		const title = this.title.trim();
		const content = this.content.trim();
		if (!title) {
			Toast({
				type: 'warning',
				title: translateSync('knowledge.validation.titleRequired'),
			});
			return false;
		}
		if (!content) {
			Toast({
				type: 'warning',
				title: translateSync('knowledge.validation.contentRequired'),
			});
			return false;
		}
		if (!this.isDraftDirty) return false;
		if (this.saving) return false;
		this.saving = true;
		try {
			if (this.editingId) {
				const res = await updateSkill(this.editingId, { title, content });
				const row = res.data;
				runInAction(() => {
					if (row?.id) {
						const idx = this.list.findIndex((s) => s.id === row.id);
						if (idx >= 0) this.list[idx] = row;
						this.title = row.title;
						this.content = row.content;
						this.markPersisted(row.title, row.content);
					}
				});
				if (row?.id) {
					skillTryStore.syncEditorBaseline(row.title, row.content);
				}
			} else {
				const res = await saveSkill({ title, content });
				const row = res.data;
				if (!row?.id) {
					Toast({ type: 'error', title: '保存失败' });
					return false;
				}
				// 先回填生成会话，再写 editingId，避免面板 bindSkill 清空当前对话
				await skillTryStore.attachDraftToSkill(row.id);
				runInAction(() => {
					const now = new Date().toISOString();
					const next: SkillRecord = {
						id: row.id,
						title: row.title ?? title,
						content: row.content ?? content,
						authorId: row.authorId ?? 0,
						createdAt: row.createdAt ?? now,
						updatedAt: row.updatedAt ?? now,
					};
					this.editingId = next.id;
					this.list = [next, ...this.list];
					this.title = next.title;
					this.content = next.content;
					this.markPersisted(next.title, next.content);
				});
				skillTryStore.syncEditorBaseline(
					row.title ?? title,
					row.content ?? content,
				);
			}
			Toast({ type: 'success', title: '已保存' });
			return true;
		} catch {
			Toast({ type: 'error', title: '保存失败' });
			return false;
		} finally {
			runInAction(() => {
				this.saving = false;
			});
		}
	}

	async remove(id?: string): Promise<boolean> {
		const target = (id ?? this.editingId ?? '').trim();
		if (!target) return false;
		try {
			await deleteSkill(target);
			runInAction(() => {
				this.list = this.list.filter((s) => s.id !== target);
				this.selectedSkillIds = this.selectedSkillIds.filter(
					(x) => x !== target,
				);
				if (this.editingId === target) this.createNew();
			});
			Toast({ type: 'success', title: '已删除' });
			return true;
		} catch {
			Toast({ type: 'error', title: '删除失败' });
			return false;
		}
	}

	toggleSelectedSkillId(id: string): void {
		const sid = id.trim();
		if (!sid) return;
		if (this.selectedSkillIds.includes(sid)) {
			this.selectedSkillIds = this.selectedSkillIds.filter((x) => x !== sid);
		} else if (this.selectedSkillIds.length < 8) {
			this.selectedSkillIds = [...this.selectedSkillIds, sid];
		}
	}

	setSelectedSkillIds(ids: string[]): void {
		const uniq: string[] = [];
		for (const id of ids) {
			const sid = (id ?? '').trim();
			if (!sid || uniq.includes(sid)) continue;
			uniq.push(sid);
			if (uniq.length >= 8) break;
		}
		this.selectedSkillIds = uniq;
	}

	clearSelected(): void {
		this.selectedSkillIds = [];
	}

	resetOnUserSwitch(): void {
		this.list = [];
		this.selectedSkillIds = [];
		this.editingId = null;
		this.title = '';
		this.content = '';
		this.persistedTitle = '';
		this.persistedContent = '';
		this.loadingList = false;
		this.saving = false;
		this.loadingDetail = false;
	}
}

const skillStore = new SkillStore();
export default skillStore;
