import type {
	Asset,
	Clip,
	Operation,
	ProjectDoc,
	ProjectMeta,
	ProjectSettings,
} from './types';

function nowIso() {
	return new Date().toISOString();
}

export function createDefaultProjectDoc(input?: {
	projectId?: string;
	title?: string;
	appVersion?: string;
}): ProjectDoc {
	const ts = nowIso();
	const meta: ProjectMeta = {
		projectId: input?.projectId ?? crypto.randomUUID(),
		title: input?.title ?? '未命名工程',
		createdAt: ts,
		updatedAt: ts,
		...(input?.appVersion ? { appVersion: input.appVersion } : {}),
	};
	const settings: ProjectSettings = {
		timelineFps: 30,
		resolution: { width: 1920, height: 1080 },
		audioSampleRate: 48_000,
		defaultExportPresetId: null,
	};
	return {
		schemaVersion: '1.0',
		meta,
		settings,
		assets: {},
		tracks: [],
		clips: {},
		oplog: [],
	};
}

export type ApplyResult = { doc: ProjectDoc; warnings: string[] };

export function applyOperation(doc: ProjectDoc, op: Operation): ApplyResult {
	const warnings: string[] = [];
	const next: ProjectDoc = {
		...doc,
		meta: { ...doc.meta, updatedAt: op.ts },
		assets: { ...doc.assets },
		tracks: [...doc.tracks],
		clips: { ...doc.clips },
		oplog: [...doc.oplog, op],
	};

	switch (op.type) {
		case 'track.add': {
			const exists = next.tracks.some(
				(t) => t.trackId === op.payload.track.trackId,
			);
			if (exists) {
				warnings.push(`轨道已存在：${op.payload.track.trackId}`);
				return { doc: next, warnings };
			}
			next.tracks.push(op.payload.track);
			next.tracks.sort((a, b) => a.order - b.order);
			return { doc: next, warnings };
		}
		case 'asset.upsert': {
			const a: Asset = op.payload.asset;
			next.assets[a.assetId] = a;
			return { doc: next, warnings };
		}
		case 'clip.add': {
			const c: Clip = op.payload.clip;
			if (next.clips[c.clipId]) {
				warnings.push(`片段已存在：${c.clipId}`);
				return { doc: next, warnings };
			}
			const track = next.tracks.find((t) => t.trackId === c.trackId);
			if (!track) {
				warnings.push(`轨道不存在：${c.trackId}`);
				return { doc: next, warnings };
			}
			if (track.locked) {
				warnings.push(`轨道已锁定：${c.trackId}`);
				return { doc: next, warnings };
			}
			if (c.startMs < 0 || c.durationMs <= 0) {
				warnings.push('片段时间范围非法');
				return { doc: next, warnings };
			}
			next.clips[c.clipId] = c;
			return { doc: next, warnings };
		}
		case 'clip.move': {
			const c = next.clips[op.payload.clipId];
			if (!c) {
				warnings.push(`片段不存在：${op.payload.clipId}`);
				return { doc: next, warnings };
			}
			const targetTrackId = op.payload.trackId ?? c.trackId;
			const track = next.tracks.find((t) => t.trackId === targetTrackId);
			if (!track) {
				warnings.push(`轨道不存在：${targetTrackId}`);
				return { doc: next, warnings };
			}
			if (track.locked) {
				warnings.push(`轨道已锁定：${targetTrackId}`);
				return { doc: next, warnings };
			}
			next.clips[c.clipId] = {
				...c,
				startMs: Math.max(0, op.payload.startMs),
				trackId: targetTrackId,
			};
			return { doc: next, warnings };
		}
		case 'clip.trim': {
			const c = next.clips[op.payload.clipId];
			if (!c) {
				warnings.push(`片段不存在：${op.payload.clipId}`);
				return { doc: next, warnings };
			}
			const track = next.tracks.find((t) => t.trackId === c.trackId);
			if (track?.locked) {
				warnings.push(`轨道已锁定：${c.trackId}`);
				return { doc: next, warnings };
			}
			const trimInMs = Math.max(0, Math.floor(op.payload.trimInMs));
			const trimOutMs = Math.max(0, Math.floor(op.payload.trimOutMs));
			if (trimInMs + trimOutMs >= c.durationMs) {
				warnings.push('裁剪后片段时长为 0');
				return { doc: next, warnings };
			}
			next.clips[c.clipId] = { ...c, trimInMs, trimOutMs };
			return { doc: next, warnings };
		}
		case 'clip.split': {
			const c = next.clips[op.payload.clipId];
			if (!c) {
				warnings.push(`片段不存在：${op.payload.clipId}`);
				return { doc: next, warnings };
			}
			const track = next.tracks.find((t) => t.trackId === c.trackId);
			if (track?.locked) {
				warnings.push(`轨道已锁定：${c.trackId}`);
				return { doc: next, warnings };
			}
			const at = Math.floor(op.payload.atMs);
			const rel = at - c.startMs;
			if (rel <= 0 || rel >= c.durationMs) {
				warnings.push('分割点在片段边界，未执行分割');
				return { doc: next, warnings };
			}
			const leftId = crypto.randomUUID();
			const rightId = crypto.randomUUID();
			const left: Clip = { ...c, clipId: leftId, durationMs: rel };
			const right: Clip = {
				...c,
				clipId: rightId,
				startMs: c.startMs + rel,
				durationMs: c.durationMs - rel,
			};
			delete next.clips[c.clipId];
			next.clips[leftId] = left;
			next.clips[rightId] = right;
			return { doc: next, warnings };
		}
		default: {
			const _exhaustive: never = op;
			void _exhaustive;
			return { doc: next, warnings };
		}
	}
}
