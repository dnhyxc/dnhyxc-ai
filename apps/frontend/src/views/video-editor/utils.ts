import { invoke } from '@tauri-apps/api/core';
import type { ProbeMediaOutput } from './types';

/**
 * 选择媒体文件（一期先支持多选文件）。
 * Rust 侧命令：select_media_files
 */
export async function invokeSelectMediaFiles(): Promise<string[]> {
	return invoke<string[]>('select_media_files');
}

/**
 * 读取媒体元数据（基于 ffprobe）。
 * Rust 侧命令：probe_media
 */
export async function invokeProbeMedia(
	path: string,
): Promise<ProbeMediaOutput> {
	return invoke<ProbeMediaOutput>('probe_media', { path });
}

/**
 * 将媒体文件 stage 到应用缓存目录，返回可播放的路径（位于 AppCache）。
 * Rust 侧命令：stage_media_for_playback
 */
export async function invokeStageMediaForPlayback(
	path: string,
): Promise<string> {
	return invoke<string>('stage_media_for_playback', { path });
}
