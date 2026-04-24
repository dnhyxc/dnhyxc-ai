export type ProjectSchemaVersion = '1.0';

export type ProjectMeta = {
	projectId: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	appVersion?: string;
};

export type ProjectSettings = {
	timelineFps: number;
	resolution: { width: number; height: number };
	audioSampleRate: number;
	defaultExportPresetId: string | null;
};

export type AssetType = 'video' | 'audio' | 'image';

export type AssetFileSignature = {
	sizeBytes: number;
	mtimeMs: number;
	sha256?: string;
};

export type Asset = {
	assetId: string;
	type: AssetType;
	sourcePath: string;
	importMode: 'reference' | 'copy';
	fileSignature: AssetFileSignature;
	durationMs: number | null;
	width: number | null;
	height: number | null;
	fps: string | null;
	audioChannels: number | null;
	sampleRate: number | null;
	createdAt: string;
};

export type TrackKind = 'video' | 'audio' | 'subtitle' | 'sticker';

export type Track = {
	trackId: string;
	kind: TrackKind;
	name: string;
	muted: boolean;
	locked: boolean;
	hidden: boolean;
	order: number;
};

export type ClipTransform = {
	x: number;
	y: number;
	scale: number;
	rotate: number;
	anchorX: number;
	anchorY: number;
};

export type Clip = {
	clipId: string;
	trackId: string;
	kind: TrackKind;
	assetId: string | null;
	startMs: number;
	durationMs: number;
	trimInMs: number;
	trimOutMs: number;
	speed: number;
	opacity: number;
	volume: number;
	transform: ClipTransform;
	createdAt: string;
};

export type OperationBase = {
	opId: string;
	ts: string;
	actor: 'user' | 'assistant';
	reason?: string;
};

export type OpTrackAdd = OperationBase & {
	type: 'track.add';
	payload: { track: Track };
};

export type OpAssetUpsert = OperationBase & {
	type: 'asset.upsert';
	payload: { asset: Asset };
};

export type OpClipAdd = OperationBase & {
	type: 'clip.add';
	payload: { clip: Clip };
};

export type OpClipMove = OperationBase & {
	type: 'clip.move';
	payload: { clipId: string; startMs: number; trackId?: string };
};

export type OpClipSplit = OperationBase & {
	type: 'clip.split';
	payload: { clipId: string; atMs: number };
};

export type OpClipTrim = OperationBase & {
	type: 'clip.trim';
	payload: { clipId: string; trimInMs: number; trimOutMs: number };
};

export type Operation =
	| OpTrackAdd
	| OpAssetUpsert
	| OpClipAdd
	| OpClipMove
	| OpClipSplit
	| OpClipTrim;

export type ProjectDoc = {
	schemaVersion: ProjectSchemaVersion;
	meta: ProjectMeta;
	settings: ProjectSettings;
	assets: Record<string, Asset>;
	tracks: Track[];
	clips: Record<string, Clip>;
	oplog: Operation[];
};
