/** 学习笔记：经 HostBridge 调用主站 `/english-learning/notes/*` */

import { translateSync } from '@/i18n';

export type HostHttp = {
	get: <T = unknown>(url: string) => Promise<T>;
	post: <T = unknown>(url: string, body?: unknown) => Promise<T>;
	put: <T = unknown>(url: string, body?: unknown) => Promise<T>;
	delete: <T = unknown>(url: string) => Promise<T>;
};

const BASE = '/english-learning/notes';

/** 列表默认每页条数 */
export const NOTES_PAGE_SIZE = 10;

export type NoteRecord = {
	id: string;
	title: string | null;
	content: string;
	userId?: number;
	createdAt?: string;
	updatedAt?: string;
};

export type NoteListItem = Omit<NoteRecord, 'content'>;

export type Note = {
	id: string;
	title: string;
	html: string;
	at: number;
};

export type NoteListPage = {
	list: Note[];
	total: number;
	pageNo: number;
	pageSize: number;
};

function unwrapData<T>(res: unknown): T {
	if (res && typeof res === 'object' && 'data' in res) {
		return (res as { data: T }).data;
	}
	return res as T;
}

function toNote(row: NoteListItem | NoteRecord): Note {
	const html =
		'content' in row && typeof row.content === 'string' ? row.content : '';
	const atRaw = row.updatedAt ?? row.createdAt;
	const at = atRaw ? new Date(atRaw).getTime() : Date.now();
	return {
		id: row.id,
		title: (row.title ?? '').trim() || translateSync('common.untitledNote'),
		html,
		at: Number.isFinite(at) ? at : Date.now(),
	};
}

export function createNotesApi(http: HostHttp) {
	return {
		async list(pageNo = 1, pageSize = NOTES_PAGE_SIZE): Promise<NoteListPage> {
			const res = await http.get(
				`${BASE}/list?pageNo=${pageNo}&pageSize=${pageSize}`,
			);
			const page = unwrapData<{ list: NoteListItem[]; total: number }>(res);
			const rows = Array.isArray(page?.list) ? page.list : [];
			return {
				list: rows.map(toNote),
				total: typeof page?.total === 'number' ? page.total : rows.length,
				pageNo,
				pageSize,
			};
		},

		async detail(id: string): Promise<Note> {
			const res = await http.get(`${BASE}/detail/${id}`);
			return toNote(unwrapData<NoteRecord>(res));
		},

		/** 拉取单篇笔记 DOCX 二进制（服务端生成） */
		async exportDocx(id: string): Promise<ArrayBuffer> {
			const res = await http.get(`${BASE}/export-docx/${id}`);
			const data = unwrapData<unknown>(res);
			if (data instanceof ArrayBuffer) return data;
			if (ArrayBuffer.isView(data)) {
				const v = data as ArrayBufferView;
				return v.buffer.slice(
					v.byteOffset,
					v.byteOffset + v.byteLength,
				) as ArrayBuffer;
			}
			throw new Error(translateSync('learningNotes.toast.exportInvalid'));
		},

		async save(input: {
			title: string;
			html: string;
		}): Promise<{ id: string }> {
			const res = await http.post(`${BASE}/save`, {
				title: input.title.trim() || null,
				content: input.html,
			});
			return unwrapData<{ id: string }>(res);
		},

		async update(
			id: string,
			input: { title: string; html: string },
		): Promise<Note> {
			const res = await http.put(`${BASE}/update/${id}`, {
				id,
				title: input.title.trim() || null,
				content: input.html,
			});
			return toNote(unwrapData<NoteRecord>(res));
		},

		async remove(id: string): Promise<void> {
			await http.delete(`${BASE}/delete/${id}`);
		},
	};
}

export type NotesApi = ReturnType<typeof createNotesApi>;
