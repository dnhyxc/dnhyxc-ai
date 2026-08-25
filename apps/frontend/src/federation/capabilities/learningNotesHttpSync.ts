import type { HostHttpClient } from '@dnhyxc-ai/federation-kit';
import { BASE_URL } from '@/constants';
import {
	getLearningNotesWindowId,
	publishLearningNotesSync,
} from './learningNotesSyncBus';

const NOTES_API_PREFIX = '/english-learning/notes';
const NOTES_BASE = `${NOTES_API_PREFIX}`;

let trackedNoteId: string | null = null;

export function getTrackedLearningNotesNoteId(): string | null {
	return trackedNoteId;
}

export function setTrackedLearningNotesNoteId(noteId: string | null): void {
	trackedNoteId = noteId;
}

/** 关窗/刷新：keepalive 保存（async http 会被 WebView 销毁掐断） */
export function saveLearningNoteKeepalive(input: {
	id?: string | null;
	title: string;
	html: string;
	uploadSessionId?: string | null;
}): void {
	if (typeof window === 'undefined') return;
	const token = localStorage.getItem('token')?.trim();
	const base = BASE_URL?.trim();
	if (!token || !base) return;
	const title = input.title.trim() || '未命名笔记';
	const payload: Record<string, string> = {
		title,
		content: input.html,
	};
	const sid = input.uploadSessionId?.trim();
	if (sid) payload.uploadSessionId = sid;
	const headers = {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json',
	};
	const id = input.id?.trim();
	if (id) {
		void fetch(`${base}${NOTES_BASE}/update/${encodeURIComponent(id)}`, {
			method: 'PUT',
			headers,
			body: JSON.stringify({ id, ...payload }),
			keepalive: true,
		});
		return;
	}
	void fetch(`${base}${NOTES_BASE}/save`, {
		method: 'POST',
		headers,
		body: JSON.stringify(payload),
		keepalive: true,
	});
}

function noteIdFromSaveResponse(
	body: unknown,
	fallbackId?: string | null,
): string | null {
	if (!body || typeof body !== 'object') return fallbackId?.trim() || null;
	const row =
		'data' in (body as object) && (body as { data?: unknown }).data
			? (body as { data: unknown }).data
			: body;
	if (!row || typeof row !== 'object') return fallbackId?.trim() || null;
	const id = (row as { id?: unknown }).id;
	return typeof id === 'string' ? id : fallbackId?.trim() || null;
}

/** 托管关窗：await 保存成功（窗口 prevent_close 期间 WebView 仍存活） */
export async function saveLearningNoteAwait(input: {
	id?: string | null;
	title: string;
	html: string;
	uploadSessionId?: string | null;
}): Promise<boolean> {
	if (typeof window === 'undefined') return false;
	const token = localStorage.getItem('token')?.trim();
	const base = BASE_URL?.trim();
	if (!token || !base) return false;
	const title = input.title.trim() || '未命名笔记';
	const payload: Record<string, string> = {
		title,
		content: input.html,
	};
	const sid = input.uploadSessionId?.trim();
	if (sid) payload.uploadSessionId = sid;
	const headers = {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json',
	};
	const id = input.id?.trim();
	try {
		const res = await fetch(
			id
				? `${base}${NOTES_BASE}/update/${encodeURIComponent(id)}`
				: `${base}${NOTES_BASE}/save`,
			{
				method: id ? 'PUT' : 'POST',
				headers,
				body: JSON.stringify(id ? { id, ...payload } : payload),
			},
		);
		if (!res.ok) return false;
		const body = await res.json().catch(() => null);
		const savedId = noteIdFromSaveResponse(body, id);
		if (savedId) trackedNoteId = savedId;
		return true;
	} catch {
		return false;
	}
}

function isNotesMutation(method: string, url: string): boolean {
	if (!url.includes(NOTES_API_PREFIX)) return false;
	return method === 'post' || method === 'put' || method === 'delete';
}

function noteIdFromUrl(url: string): string | null {
	const m = url.match(
		/\/english-learning\/notes\/(?:delete|detail|update|export-docx)\/([0-9a-f-]{36})/i,
	);
	return m?.[1] ?? null;
}

function unwrapBody(body: unknown): Record<string, unknown> | null {
	if (!body || typeof body !== 'object') return null;
	return body as Record<string, unknown>;
}

/** 包装 Host HTTP：笔记增删改成功后自动广播跨窗同步 */
export function wrapLearningNotesHttp(
	http: HostHttpClient | undefined,
): HostHttpClient | undefined {
	if (!http) return http;
	const windowId = getLearningNotesWindowId();

	const afterMutation = (
		method: string,
		url: string,
		body: unknown,
		result: unknown,
	) => {
		if (!isNotesMutation(method, url)) return;
		const id = noteIdFromUrl(url);
		const payload = unwrapBody(body);

		if (method === 'delete' && id) {
			publishLearningNotesSync({ type: 'deleted', noteId: id, windowId });
			publishLearningNotesSync({
				type: 'list-changed',
				reason: 'delete',
				windowId,
			});
			return;
		}

		const data =
			result && typeof result === 'object' && 'data' in (result as object)
				? (result as { data?: unknown }).data
				: result;
		const row =
			data && typeof data === 'object'
				? (data as Record<string, unknown>)
				: null;
		const noteId =
			(typeof row?.id === 'string' ? row.id : null) ??
			id ??
			(typeof payload?.id === 'string' ? payload.id : null);

		if (noteId) {
			trackedNoteId = noteId;
			const html =
				(typeof row?.html === 'string' ? row.html : null) ??
				(typeof row?.content === 'string' ? row.content : null) ??
				(typeof payload?.html === 'string' ? payload.html : null) ??
				(typeof payload?.content === 'string' ? payload.content : '');
			const title =
				(typeof row?.title === 'string' ? row.title : null) ??
				(typeof payload?.title === 'string' ? payload.title : '');
			publishLearningNotesSync({
				type: 'saved',
				noteId,
				html,
				title,
				windowId,
				updatedAt:
					typeof row?.updatedAt === 'string' ? row.updatedAt : undefined,
			});
		}
		publishLearningNotesSync({
			type: 'list-changed',
			reason: method,
			windowId,
		});
	};

	const trackDetail = (url: string) => {
		const id = noteIdFromUrl(url);
		if (id && url.includes(NOTES_API_PREFIX) && !url.includes('?')) {
			trackedNoteId = id;
		}
	};

	return {
		get: (async (url: string) => {
			const res = await http.get(url);
			trackDetail(url);
			return res;
		}) as HostHttpClient['get'],
		post: (async (url: string, body?: unknown) => {
			const res = await http.post(url, body);
			afterMutation('post', url, body, res);
			return res;
		}) as HostHttpClient['post'],
		put: (async (url: string, body?: unknown) => {
			const res = await http.put(url, body);
			afterMutation('put', url, body, res);
			return res;
		}) as HostHttpClient['put'],
		delete: (async (url: string) => {
			const res = await http.delete(url);
			afterMutation('delete', url, undefined, res);
			return res;
		}) as HostHttpClient['delete'],
	};
}
