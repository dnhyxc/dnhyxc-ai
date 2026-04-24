import { convertFileSrc } from '@tauri-apps/api/core';
import { Button, Input, Toast } from '@ui/index';
import { ScrollArea } from '@ui/scroll-area';
import {
	ChevronLeft,
	ChevronRight,
	Film,
	Import,
	Play,
	Scissors,
	Square,
	Undo2,
	Upload,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { isTauriRuntime } from '@/utils';
import { createDefaultProjectDoc } from '@/video-editor/core/doc';
import {
	createHistoryState,
	pushOperation,
	redo,
	undo,
} from '@/video-editor/core/history';
import type { Clip, Operation, Track } from '@/video-editor/core/types';
import type { ProbeMediaOutput, VideoAsset } from './types.ts';
import {
	invokeProbeMedia,
	invokeSelectMediaFiles,
	invokeStageMediaForPlayback,
} from './utils.ts';

type PanelTab = 'assets' | 'jobs';

function nowIso() {
	return new Date().toISOString();
}

function formatMs(ms: number) {
	const s = Math.max(0, Math.floor(ms / 1000));
	const m = Math.floor(s / 60);
	const ss = String(s % 60).padStart(2, '0');
	return `${m}:${ss}`;
}

const VideoEditor = () => {
	const [tab, setTab] = useState<PanelTab>('assets');
	const [assets, setAssets] = useState<VideoAsset[]>([]);
	const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
	const [importing, setImporting] = useState(false);
	const [keyword, setKeyword] = useState('');

	const playerRef = useRef<HTMLVideoElement | null>(null);
	const [playing, setPlaying] = useState(false);
	const [playbackSrc, setPlaybackSrc] = useState<string | null>(null);

	// ---- ProjectDoc + undo/redo（一期：回放重建）----
	const seedRef = useRef(createDefaultProjectDoc({ title: '视频工程' }));
	const [history, setHistory] = useState(() =>
		createHistoryState(seedRef.current),
	);
	const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
	const [playheadMs, setPlayheadMs] = useState(0);

	// 默认创建两条轨道（视频/音频），只做一次
	useEffect(() => {
		if (history.doc.tracks.length > 0) return;
		const baseTs = nowIso();
		const videoTrack: Track = {
			trackId: crypto.randomUUID(),
			kind: 'video',
			name: '视频轨道',
			muted: false,
			locked: false,
			hidden: false,
			order: 1,
		};
		const audioTrack: Track = {
			trackId: crypto.randomUUID(),
			kind: 'audio',
			name: '音频轨道',
			muted: false,
			locked: false,
			hidden: false,
			order: 2,
		};
		const ops: Operation[] = [
			{
				opId: crypto.randomUUID(),
				ts: baseTs,
				actor: 'user',
				type: 'track.add',
				payload: { track: videoTrack },
			},
			{
				opId: crypto.randomUUID(),
				ts: baseTs,
				actor: 'user',
				type: 'track.add',
				payload: { track: audioTrack },
			},
		];
		setHistory((prev) => {
			let st = prev;
			for (const op of ops) {
				st = pushOperation(st, op).state;
			}
			return st;
		});
	}, [history.doc.tracks.length]);

	const filteredAssets = useMemo(() => {
		const k = keyword.trim().toLowerCase();
		if (!k) return assets;
		return assets.filter((a) => {
			const t = `${a.title ?? ''} ${a.sourcePath}`.toLowerCase();
			return t.includes(k);
		});
	}, [assets, keyword]);

	const selectedAsset = useMemo(
		() => assets.find((a) => a.assetId === selectedAssetId) ?? null,
		[assets, selectedAssetId],
	);

	const clips = useMemo(
		() => Object.values(history.doc.clips),
		[history.doc.clips],
	);
	const clipsOnTracks = useMemo(() => {
		const byTrack = new Map<string, Clip[]>();
		for (const c of clips) {
			const arr = byTrack.get(c.trackId) ?? [];
			arr.push(c);
			byTrack.set(c.trackId, arr);
		}
		for (const [k, arr] of byTrack) {
			arr.sort((a, b) => a.startMs - b.startMs);
			byTrack.set(k, arr);
		}
		return byTrack;
	}, [clips]);

	const timelineEndMs = useMemo(() => {
		let end = 30_000;
		for (const c of clips) end = Math.max(end, c.startMs + c.durationMs);
		return end;
	}, [clips]);

	const selectedClip = useMemo(
		() => (selectedClipId ? (history.doc.clips[selectedClipId] ?? null) : null),
		[history.doc.clips, selectedClipId],
	);

	const applyOp = useCallback(
		(op: Operation) => {
			const res = pushOperation(history, op);
			setHistory(res.state);
			if (res.warnings.length > 0) {
				Toast({
					type: 'warning',
					title: '操作被忽略',
					message: res.warnings[0],
				});
			}
		},
		[history],
	);

	const onUndo = useCallback(() => {
		const res = undo(history, seedRef.current);
		setHistory(res.state);
		if (res.warnings.length > 0) {
			Toast({ type: 'warning', title: '撤销提示', message: res.warnings[0] });
		}
	}, [history]);

	const onRedo = useCallback(() => {
		const res = redo(history);
		setHistory(res.state);
		if (res.warnings.length > 0) {
			Toast({ type: 'warning', title: '重做提示', message: res.warnings[0] });
		}
	}, [history]);

	// 选中素材时，先 stage 到 AppCache，再用 convertFileSrc 生成可播放 URL
	const refreshPlaybackSrc = useCallback(async () => {
		if (!selectedAsset || !isTauriRuntime()) {
			setPlaybackSrc(null);
			return;
		}
		try {
			const stagedPath = await invokeStageMediaForPlayback(
				selectedAsset.sourcePath,
			);
			setPlaybackSrc(convertFileSrc(stagedPath));
		} catch (e) {
			setPlaybackSrc(null);
			Toast({
				type: 'error',
				title: '准备预览失败',
				message: e instanceof Error ? e.message : String(e),
			});
		}
	}, [selectedAsset]);

	useEffect(() => {
		void refreshPlaybackSrc();
	}, [refreshPlaybackSrc]);

	// 监看器时间同步 playhead
	useEffect(() => {
		const el = playerRef.current;
		if (!el) return;
		const onTime = () => setPlayheadMs(Math.floor(el.currentTime * 1000));
		el.addEventListener('timeupdate', onTime);
		return () => el.removeEventListener('timeupdate', onTime);
	}, []);

	const onImport = useCallback(async () => {
		if (!isTauriRuntime()) {
			Toast({
				type: 'warning',
				title: '当前不是桌面端',
				message: '视频剪辑工具需要在 Tauri 桌面端运行以访问本地文件与 FFmpeg。',
			});
			return;
		}
		setImporting(true);
		try {
			const paths = await invokeSelectMediaFiles();
			if (!paths || paths.length === 0) return;

			const probed: Array<{ path: string; meta: ProbeMediaOutput | null }> = [];
			for (const p of paths) {
				try {
					const meta = await invokeProbeMedia(p);
					probed.push({ path: p, meta });
				} catch {
					probed.push({ path: p, meta: null });
				}
			}

			setAssets((prev) => {
				const map = new Map(prev.map((x) => [x.sourcePath, x]));
				for (const { path, meta } of probed) {
					const next: VideoAsset = {
						assetId: map.get(path)?.assetId ?? crypto.randomUUID(),
						sourcePath: path,
						title: meta?.format?.filename
							? (meta.format.filename.split(/[/\\]/).filter(Boolean).pop() ??
								path)
							: (path.split(/[/\\]/).filter(Boolean).pop() ?? path),
						type: meta?.streams?.some(
							(s: { codec_type?: string | null }) => s.codec_type === 'video',
						)
							? 'video'
							: meta?.streams?.some(
										(s: { codec_type?: string | null }) =>
											s.codec_type === 'audio',
									)
								? 'audio'
								: 'video',
						durationMs: meta?.format?.duration
							? Math.round(Number(meta.format.duration) * 1000)
							: null,
						width:
							meta?.streams?.find(
								(s: { codec_type?: string | null; width?: number | null }) =>
									s.codec_type === 'video',
							)?.width ?? null,
						height:
							meta?.streams?.find(
								(s: { codec_type?: string | null; height?: number | null }) =>
									s.codec_type === 'video',
							)?.height ?? null,
						fps: meta?.streams?.find(
							(s: {
								codec_type?: string | null;
								r_frame_rate?: string | null;
							}) => s.codec_type === 'video',
						)?.r_frame_rate
							? (meta.streams.find(
									(s: {
										codec_type?: string | null;
										r_frame_rate?: string | null;
									}) => s.codec_type === 'video',
								)?.r_frame_rate ?? null)
							: null,
						probe: meta,
					};
					map.set(path, next);
				}
				return Array.from(map.values()).sort((a, b) =>
					String(a.title ?? '').localeCompare(String(b.title ?? '')),
				);
			});
			Toast({
				type: 'success',
				title: '导入完成',
				message: `已导入 ${paths.length} 个文件`,
			});
		} catch (e) {
			Toast({
				type: 'error',
				title: '导入失败',
				message: e instanceof Error ? e.message : String(e),
			});
		} finally {
			setImporting(false);
		}
	}, []);

	const onAddClipFromSelectedAsset = useCallback(() => {
		if (!selectedAsset) {
			Toast({ type: 'warning', title: '请先选择一个素材' });
			return;
		}
		const videoTrack =
			history.doc.tracks.find((t) => t.kind === 'video' && !t.hidden) ??
			history.doc.tracks[0];
		if (!videoTrack) {
			Toast({ type: 'error', title: '未找到可用轨道' });
			return;
		}
		const dur = selectedAsset.durationMs ?? 5_000;
		const clip: Clip = {
			clipId: crypto.randomUUID(),
			trackId: videoTrack.trackId,
			kind: 'video',
			assetId: selectedAsset.assetId,
			startMs: playheadMs,
			durationMs: dur,
			trimInMs: 0,
			trimOutMs: 0,
			speed: 1,
			opacity: 1,
			volume: 1,
			transform: {
				x: 0,
				y: 0,
				scale: 1,
				rotate: 0,
				anchorX: 0.5,
				anchorY: 0.5,
			},
			createdAt: nowIso(),
		};
		const op: Operation = {
			opId: crypto.randomUUID(),
			ts: nowIso(),
			actor: 'user',
			type: 'clip.add',
			payload: { clip },
		};
		applyOp(op);
		setSelectedClipId(clip.clipId);
	}, [selectedAsset, history.doc.tracks, playheadMs, applyOp]);

	const onSplitSelectedClip = useCallback(() => {
		if (!selectedClipId) {
			Toast({ type: 'warning', title: '请先选择一个片段' });
			return;
		}
		const op: Operation = {
			opId: crypto.randomUUID(),
			ts: nowIso(),
			actor: 'user',
			type: 'clip.split',
			payload: { clipId: selectedClipId, atMs: playheadMs },
		};
		applyOp(op);
	}, [selectedClipId, playheadMs, applyOp]);

	const togglePlay = useCallback(() => {
		const el = playerRef.current;
		if (!el) return;
		if (el.paused) {
			void el.play();
		} else {
			el.pause();
		}
	}, []);

	return (
		<div className="w-full h-full min-h-0 min-w-0 flex flex-col gap-3 p-4">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2 min-w-0">
					<div className="flex items-center gap-2 text-textcolor">
						<Film size={18} />
						<span className="font-medium">视频剪辑</span>
					</div>
					<span className="text-xs text-textcolor/50 truncate">
						{isTauriRuntime()
							? '桌面端剪辑（Tauri + FFmpeg）'
							: '请在桌面端打开以启用导入与预览'}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="secondary"
						size="sm"
						onClick={onUndo}
						disabled={history.undo.length === 0}
					>
						<Undo2 size={16} />
						<span>撤销</span>
					</Button>
					<Button
						variant="secondary"
						size="sm"
						onClick={onRedo}
						disabled={history.redo.length === 0}
					>
						<Undo2 size={16} className="rotate-180" />
						<span>重做</span>
					</Button>
					<Button
						variant="secondary"
						size="sm"
						onClick={onImport}
						disabled={importing}
						aria-busy={importing}
					>
						<Import size={16} />
						<span>导入</span>
					</Button>
					<Button variant="secondary" size="sm" disabled>
						<Upload size={16} />
						<span>导出</span>
					</Button>
				</div>
			</div>

			<div className="flex min-h-0 flex-1 gap-3">
				{/* 左侧：素材库 / 任务 */}
				<div className="w-[320px] min-w-[280px] max-w-[420px] min-h-0 flex flex-col rounded-md border border-theme/10 bg-theme/5 overflow-hidden">
					<div className="flex items-center gap-1 p-2 border-b border-theme/10">
						<button
							type="button"
							className={cn(
								'px-2 py-1 rounded-md text-sm transition-colors',
								tab === 'assets'
									? 'bg-theme/15 text-textcolor'
									: 'text-textcolor/70 hover:bg-theme/10',
							)}
							onClick={() => setTab('assets')}
						>
							素材
						</button>
						<button
							type="button"
							className={cn(
								'px-2 py-1 rounded-md text-sm transition-colors',
								tab === 'jobs'
									? 'bg-theme/15 text-textcolor'
									: 'text-textcolor/70 hover:bg-theme/10',
							)}
							onClick={() => setTab('jobs')}
						>
							任务
						</button>
					</div>

					{tab === 'assets' ? (
						<>
							<div className="p-2 border-b border-theme/10">
								<Input
									value={keyword}
									onChange={(e) => setKeyword(e.target.value)}
									placeholder="搜索素材…"
									className="h-9"
								/>
							</div>
							<ScrollArea className="min-h-0 flex-1">
								<div className="p-2 flex flex-col gap-1">
									{filteredAssets.length === 0 ? (
										<div className="text-sm text-textcolor/60 p-2">
											暂无素材。点击右上角「导入」添加视频/音频文件。
										</div>
									) : null}
									{filteredAssets.map((a) => {
										const selected = a.assetId === selectedAssetId;
										return (
											<button
												key={a.assetId}
												type="button"
												className={cn(
													'w-full text-left rounded-md p-2 transition-colors border',
													selected
														? 'bg-theme/15 border-theme/20'
														: 'bg-transparent border-transparent hover:bg-theme/10',
												)}
												onClick={() => setSelectedAssetId(a.assetId)}
											>
												<div className="text-sm text-textcolor font-medium truncate">
													{a.title ?? '未命名'}
												</div>
												<div className="text-xs text-textcolor/50 truncate">
													{a.durationMs != null
														? `时长 ${Math.round(a.durationMs / 1000)}s`
														: '时长未知'}
													{a.width && a.height
														? ` · ${a.width}×${a.height}`
														: ''}
												</div>
											</button>
										);
									})}
								</div>
							</ScrollArea>
						</>
					) : (
						<div className="p-3 text-sm text-textcolor/60">
							导出/代理/波形等任务队列将在下一步接入（Render Queue）。
						</div>
					)}
				</div>

				{/* 中间：监看器 */}
				<div className="min-h-0 min-w-0 flex-1 flex flex-col rounded-md border border-theme/10 bg-theme/5 overflow-hidden">
					<div className="flex items-center justify-between gap-2 p-2 border-b border-theme/10">
						<div className="text-sm text-textcolor/80 truncate">
							{selectedAsset?.title ?? '监看器'}{' '}
							<span className="text-xs text-textcolor/50">
								· playhead {formatMs(playheadMs)}
							</span>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="secondary"
								size="sm"
								onClick={togglePlay}
								disabled={!selectedAsset || !isTauriRuntime()}
							>
								{playing ? <Square size={16} /> : <Play size={16} />}
								<span>{playing ? '暂停' : '播放'}</span>
							</Button>
							<Button
								variant="secondary"
								size="sm"
								onClick={onAddClipFromSelectedAsset}
								disabled={!selectedAsset}
							>
								<span>上轨</span>
							</Button>
						</div>
					</div>
					<div className="min-h-0 flex-1 p-3 flex items-center justify-center">
						{selectedAsset && isTauriRuntime() ? (
							<video
								ref={playerRef}
								controls={false}
								className="max-h-full max-w-full rounded-md bg-black/60"
								src={playbackSrc ?? undefined}
								onLoadedData={() => {
									// 避免切换素材后保持 paused 状态但 UI 仍显示播放
									setPlaying(false);
								}}
								onPlay={() => setPlaying(true)}
								onPause={() => setPlaying(false)}
							>
								<track kind="captions" />
							</video>
						) : (
							<div className="text-sm text-textcolor/60 text-center max-w-lg">
								<div className="mb-2">选择左侧素材以预览。</div>
								<div className="text-xs text-textcolor/50">
									预览播放需要在桌面端通过 Tauri/FFmpeg
									管线接入本地解码代理。当前先提供 UI 骨架与 probe 导入闭环。
								</div>
							</div>
						)}
					</div>
				</div>

				{/* 右侧：时间线（最小可用） */}
				<div className="w-[420px] min-w-[360px] max-w-[560px] min-h-0 flex flex-col rounded-md border border-theme/10 bg-theme/5 overflow-hidden">
					<div className="flex items-center justify-between gap-2 p-2 border-b border-theme/10">
						<div className="flex items-center gap-2 text-sm text-textcolor/80">
							<Scissors size={16} />
							<span>时间线</span>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="secondary"
								size="sm"
								onClick={() => setPlayheadMs((t) => Math.max(0, t - 1000))}
							>
								<ChevronLeft size={16} />
								<span>-1s</span>
							</Button>
							<Button
								variant="secondary"
								size="sm"
								onClick={() =>
									setPlayheadMs((t) => Math.min(timelineEndMs, t + 1000))
								}
							>
								<ChevronRight size={16} />
								<span>+1s</span>
							</Button>
							<Button
								variant="secondary"
								size="sm"
								onClick={onSplitSelectedClip}
								disabled={!selectedClipId}
							>
								<span>拆分</span>
							</Button>
						</div>
					</div>
					<div className="min-h-0 flex-1 flex flex-col">
						<div className="p-2 border-b border-theme/10 text-xs text-textcolor/60 flex items-center justify-between">
							<span>总时长：{formatMs(timelineEndMs)}</span>
							<span>已上轨：{clips.length} 段</span>
						</div>
						<ScrollArea className="min-h-0 flex-1">
							<div className="p-2 flex flex-col gap-2">
								{history.doc.tracks.map((t) => {
									const trackClips = clipsOnTracks.get(t.trackId) ?? [];
									return (
										<div
											key={t.trackId}
											className="rounded-md border border-theme/10 bg-theme/5"
										>
											<div className="px-2 py-1 text-xs text-textcolor/70 border-b border-theme/10 flex items-center justify-between">
												<span>{t.name}</span>
												<span>{t.kind}</span>
											</div>
											<div className="p-2">
												<div className="relative h-10 rounded-md bg-black/20 overflow-hidden">
													{/* playhead */}
													<div
														className="absolute top-0 bottom-0 w-0.5 bg-teal-400/80"
														style={{
															left: `${Math.min(100, (playheadMs / Math.max(1, timelineEndMs)) * 100)}%`,
														}}
													/>
													{trackClips.map((c) => {
														const leftPct =
															(c.startMs / Math.max(1, timelineEndMs)) * 100;
														const widthPct =
															(c.durationMs / Math.max(1, timelineEndMs)) * 100;
														const selected = c.clipId === selectedClipId;
														return (
															<button
																key={c.clipId}
																type="button"
																className={cn(
																	'absolute top-1 bottom-1 rounded-md px-2 text-xs truncate border',
																	selected
																		? 'bg-teal-500/20 border-teal-400/40 text-textcolor'
																		: 'bg-theme/10 border-theme/10 text-textcolor/80 hover:bg-theme/15',
																)}
																style={{
																	left: `${leftPct}%`,
																	width: `${Math.max(1.2, widthPct)}%`,
																}}
																onClick={() => setSelectedClipId(c.clipId)}
															>
																{c.assetId ?? 'clip'}
															</button>
														);
													})}
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</ScrollArea>

						{/* 片段属性（最小） */}
						<div className="border-t border-theme/10 p-2">
							{selectedClip ? (
								<div className="flex flex-col gap-2">
									<div className="text-xs text-textcolor/70">
										已选片段：{selectedClip.clipId.slice(0, 8)} · start{' '}
										{formatMs(selectedClip.startMs)} · dur{' '}
										{formatMs(selectedClip.durationMs)}
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div className="flex flex-col gap-1">
											<span className="text-xs text-textcolor/60">
												起始（ms）
											</span>
											<Input
												value={String(selectedClip.startMs)}
												onChange={(e) => {
													const n = Number.parseInt(e.target.value || '0', 10);
													if (!Number.isFinite(n)) return;
													applyOp({
														opId: crypto.randomUUID(),
														ts: nowIso(),
														actor: 'user',
														type: 'clip.move',
														payload: {
															clipId: selectedClip.clipId,
															startMs: n,
														},
													});
												}}
												className="h-9"
											/>
										</div>
										<div className="flex flex-col gap-1">
											<span className="text-xs text-textcolor/60">
												时长（ms）
											</span>
											<Input
												value={String(selectedClip.durationMs)}
												disabled
												className="h-9"
											/>
										</div>
										<div className="flex flex-col gap-1">
											<span className="text-xs text-textcolor/60">
												Trim In（ms）
											</span>
											<Input
												value={String(selectedClip.trimInMs)}
												onChange={(e) => {
													const n = Number.parseInt(e.target.value || '0', 10);
													if (!Number.isFinite(n)) return;
													applyOp({
														opId: crypto.randomUUID(),
														ts: nowIso(),
														actor: 'user',
														type: 'clip.trim',
														payload: {
															clipId: selectedClip.clipId,
															trimInMs: n,
															trimOutMs: selectedClip.trimOutMs,
														},
													});
												}}
												className="h-9"
											/>
										</div>
										<div className="flex flex-col gap-1">
											<span className="text-xs text-textcolor/60">
												Trim Out（ms）
											</span>
											<Input
												value={String(selectedClip.trimOutMs)}
												onChange={(e) => {
													const n = Number.parseInt(e.target.value || '0', 10);
													if (!Number.isFinite(n)) return;
													applyOp({
														opId: crypto.randomUUID(),
														ts: nowIso(),
														actor: 'user',
														type: 'clip.trim',
														payload: {
															clipId: selectedClip.clipId,
															trimInMs: selectedClip.trimInMs,
															trimOutMs: n,
														},
													});
												}}
												className="h-9"
											/>
										</div>
									</div>
								</div>
							) : (
								<div className="text-sm text-textcolor/60">
									点击时间线中的片段以编辑属性。
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default VideoEditor;
