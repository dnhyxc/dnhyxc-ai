export type MediaStreamInfo = {
	index?: number;
	codec_type?: 'video' | 'audio' | 'subtitle' | string;
	codec_name?: string | null;
	width?: number | null;
	height?: number | null;
	r_frame_rate?: string | null;
	sample_rate?: string | null;
	channels?: number | null;
};

export type MediaFormatInfo = {
	filename?: string | null;
	duration?: string | null;
	size?: string | null;
	format_name?: string | null;
};

/** ffprobe 的最小可用输出（按需扩展） */
export type ProbeMediaOutput = {
	format?: MediaFormatInfo | null;
	streams?: MediaStreamInfo[] | null;
};

export type VideoAssetType = 'video' | 'audio' | 'image';

export type VideoAsset = {
	assetId: string;
	sourcePath: string;
	title: string | null;
	type: VideoAssetType;
	durationMs: number | null;
	width: number | null;
	height: number | null;
	/** 先按字符串透传（如 30000/1001），后续引擎层再解析 */
	fps: string | null;
	probe: ProbeMediaOutput | null;
};
