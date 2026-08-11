import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import { Toast } from '@ui/sonner';
import { ImageUp, ListRestart, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Loading from '@/components/design/Loading';
import MarkdownEditor from '@/components/design/Monaco';
import Upload from '@/components/design/Upload';
import { Spinner } from '@/components/ui';
import { Button } from '@/components/ui/button';
import {
	applyPluginIconUrl,
	fetchPluginRegistryRawText,
	PLUGIN_REGISTRY_FILENAME,
	PluginIcon,
	type PluginRegistry,
	pluginManager,
	savePluginRegistry,
} from '@/federation';
import { useI18n, useTheme } from '@/hooks';
import { uploadCosFile } from '@/service';
import type { FileWithPreview } from '@/types';
import { copyToClipboard, pasteFromClipboard } from '@/utils/clipboard';
import { RegistryFieldsHelp } from './RegistryFieldsHelp';

/** 固定 16×16；颜色继承按钮 hover:text-teal-500，勿在子 svg 写死 text-textcolor */
const titleIconSlot =
	'relative inline-flex size-4 shrink-0 items-center justify-center overflow-hidden [&_svg]:size-4';

const titleBarBtn =
	'lucide-stroke-draw-hover px-0! gap-1 text-textcolor transition-none hover:text-teal-500 focus-visible:border-transparent focus-visible:ring-0';

type PluginListItem = {
	id: string;
	title: string;
	/** menu.icon ?? host.icon；无 URL 时 PluginIcon 兜底 Puzzle */
	icon?: string;
};

export default function PluginRegistryEditorPage() {
	const { t, locale } = useI18n();
	const { theme } = useTheme();

	const monacoTheme = useMemo(
		() => (theme === 'black' ? 'vs-dark' : 'vs'),
		[theme],
	);
	const monacoClipboardAdapter = useMemo(
		() => ({
			copyToClipboard,
			pasteFromClipboard,
		}),
		[],
	);

	const [text, setText] = useState('');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [uploadingPluginId, setUploadingPluginId] = useState<string | null>(
		null,
	);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [docEpoch, setDocEpoch] = useState(0);
	const textRef = useRef(text);
	const getEditorTextRef = useRef<(() => string) | null>(null);
	const textLiveRef = useRef(text);
	textLiveRef.current = text;
	const uploadOpenRef = useRef<(() => void) | null>(null);
	const pendingIconPluginIdRef = useRef('');

	const jsonParseError = useMemo(() => {
		if (!text.trim()) return true;
		try {
			const data = JSON.parse(text) as { plugins?: unknown };
			return !Array.isArray(data.plugins);
		} catch {
			return true;
		}
	}, [text]);

	const pluginList = useMemo((): PluginListItem[] => {
		if (jsonParseError) return [];
		try {
			const data = JSON.parse(text) as PluginRegistry;
			const list: PluginListItem[] = [];
			for (const p of data.plugins) {
				if (!p.id) continue;
				list.push({
					id: p.id,
					title: p.title?.[locale] || p.id,
					icon: p.menu?.icon ?? p.host?.icon,
				});
			}
			return list;
		} catch {
			return [];
		}
	}, [text, jsonParseError, locale]);

	const textDiff = useMemo(() => textRef.current !== text, [text]);

	const load = useCallback(async () => {
		setLoading(true);
		setLoadError(null);
		try {
			const raw = await fetchPluginRegistryRawText();
			setText(raw);
			textRef.current = raw;
			setDocEpoch((n) => n + 1);
		} catch (e) {
			setLoadError(e instanceof Error ? e.message : String(e));
			setText('');
			textRef.current = '';
			setDocEpoch((n) => n + 1);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const persistRegistry = useCallback(
		async (data: PluginRegistry, okTitle: string) => {
			const saved = await savePluginRegistry(data);
			const payload = `${JSON.stringify(saved, null, 2)}\n`;
			setText(payload);
			textRef.current = payload;
			setDocEpoch((n) => n + 1);
			await pluginManager.init();
			Toast({ type: 'success', title: okTitle });
		},
		[],
	);

	const onSave = useCallback(async () => {
		if (loading || saving || uploadingPluginId) return;
		const latest = getEditorTextRef.current?.() ?? text;
		if (latest === textRef.current) {
			Toast({ type: 'info', title: t('plugins.registry.noChanges') });
			return;
		}
		let data: PluginRegistry;
		try {
			data = JSON.parse(latest) as PluginRegistry;
		} catch {
			Toast({ type: 'warning', title: t('plugins.registry.invalidJson') });
			return;
		}
		if (!Array.isArray(data.plugins)) {
			Toast({ type: 'warning', title: t('plugins.registry.invalidJson') });
			return;
		}
		setSaving(true);
		try {
			await persistRegistry(data, t('plugins.registry.saveOk'));
		} catch (e) {
			Toast({
				type: 'error',
				title: t('plugins.registry.saveFail'),
				message:
					e instanceof Error ? e.message : t('plugins.registry.saveFail'),
			});
		} finally {
			setSaving(false);
		}
	}, [loading, saving, uploadingPluginId, t, text, persistRegistry]);

	const onUploadIcon = useCallback(
		async (pluginId: string, picked: FileWithPreview | FileWithPreview[]) => {
			const item = Array.isArray(picked) ? picked[0] : picked;
			const file = item?.file;
			if (!file || !pluginId || loading || saving || uploadingPluginId) return;

			const latest = getEditorTextRef.current?.() ?? textLiveRef.current;
			let data: PluginRegistry;
			try {
				data = JSON.parse(latest) as PluginRegistry;
			} catch {
				Toast({ type: 'warning', title: t('plugins.registry.invalidJson') });
				return;
			}
			if (!data.plugins.some((p) => p.id === pluginId)) {
				Toast({
					type: 'warning',
					title: t('plugins.registry.pluginNotFound', { id: pluginId }),
				});
				return;
			}

			setUploadingPluginId(pluginId);
			try {
				const res = await uploadCosFile(file);
				const url = res?.data?.url as string | undefined;
				if (!url) {
					Toast({
						type: 'error',
						title: t('plugins.registry.iconUploadFail'),
					});
					return;
				}
				const { next, wrote } = applyPluginIconUrl(data, pluginId, url);
				if (wrote.length === 0) {
					Toast({
						type: 'warning',
						title: t('plugins.registry.iconNoTarget'),
					});
					return;
				}
				await persistRegistry(next, t('plugins.registry.iconUploadOk'));
			} catch (e) {
				Toast({
					type: 'error',
					title: t('plugins.registry.iconUploadFail'),
					message:
						e instanceof Error
							? e.message
							: t('plugins.registry.iconUploadFail'),
				});
			} finally {
				setUploadingPluginId(null);
			}
		},
		[loading, saving, uploadingPluginId, t, persistRegistry],
	);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
			if (e.key.toLowerCase() !== 's') return;
			e.preventDefault();
			void onSave();
		};
		window.addEventListener('keydown', onKeyDown, true);
		return () => window.removeEventListener('keydown', onKeyDown, true);
	}, [onSave]);

	const busy = loading || saving || !!uploadingPluginId;

	const onPickPluginIcon = useCallback(
		(id: string) => {
			if (busy || jsonParseError) return;
			pendingIconPluginIdRef.current = id;
			uploadOpenRef.current?.();
		},
		[busy, jsonParseError],
	);

	return (
		<div className="box-border flex h-full min-h-0 w-full flex-col p-5.5 pt-0">
			{/* Upload 挂在菜单外：系统文件框抢焦点会关掉 Dropdown，菜单内 Upload 会被卸载 */}
			<Upload
				t={t}
				uploadType="button"
				className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
				accept=".svg,image/svg+xml"
				validTypes={['image/svg+xml']}
				validExtensions={['.svg']}
				maxCount={1}
				maxSize={2 * 1024 * 1024}
				disabled={busy || jsonParseError}
				loading={!!uploadingPluginId}
				openRef={uploadOpenRef}
				onUpload={(picked) =>
					onUploadIcon(pendingIconPluginIdRef.current, picked)
				}
			/>
			{loadError ? (
				<p className="text-destructive mb-2 shrink-0 text-sm">{loadError}</p>
			) : null}
			{!loading && jsonParseError && text.trim() ? (
				<p className="text-destructive mb-2 shrink-0">
					{t('plugins.registry.invalidJson')}
				</p>
			) : null}

			<div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col">
				<div className="bg-theme/5 min-h-0 min-w-0 flex-1 basis-0 overflow-hidden rounded-md">
					{loading ? (
						<Loading text={t('plugins.registry.loading')} />
					) : (
						<MarkdownEditor
							className="h-full min-h-0"
							value={text}
							readOnly={saving || !!uploadingPluginId}
							onChange={setText}
							language="json"
							theme={monacoTheme}
							height="100%"
							documentIdentity={`plugins-registry-editor-${docEpoch}`}
							getMarkdownFromEditorRef={getEditorTextRef}
							placeholder=""
							enableMarkdownBottomBar={false}
							showTabBar={false}
							stickyScrollEnabled={false}
							clipboardAdapter={monacoClipboardAdapter}
							t={t}
							title={
								<div className="flex flex-1 items-center justify-between gap-2 pl-1.5">
									<div className="flex min-w-0 items-center gap-1.5">
										<RegistryFieldsHelp dirty={textDiff} />
										<span className="text-textcolor truncate base font-medium">
											{PLUGIN_REGISTRY_FILENAME}
										</span>
									</div>
									<div className="flex shrink-0 items-center gap-2 pr-1 sm:gap-3">
										{pluginList.length !== 0 ? (
											<DropdownMenu>
												<DropdownMenuTrigger
													asChild
													disabled={busy || pluginList.length === 0}
												>
													<Button
														type="button"
														variant="link"
														size="sm"
														disabled={busy}
														aria-busy={!!uploadingPluginId}
														title={
															uploadingPluginId
																? t('plugins.registry.iconUploading')
																: undefined
														}
														className={titleBarBtn}
													>
														<span className={titleIconSlot}>
															{uploadingPluginId ? (
																<Spinner
																	className="size-4 text-textcolor"
																	aria-hidden
																/>
															) : (
																<ImageUp className="size-4" aria-hidden />
															)}
														</span>
														{t('plugins.registry.iconUploadLabel')}
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent
													align="end"
													className="min-w-50"
													viewportClassName="max-h-80"
												>
													{pluginList.map((data) => (
														<DropdownMenuItem
															key={data.id}
															className="gap-3 py-1 pr-0"
															onClick={(e) => {
																e.stopPropagation();
																onPickPluginIcon(data.id);
															}}
														>
															<span className="min-w-0 flex-1 truncate">
																{data.title}
															</span>
															<div
																className="shrink-0 size-7 flex items-center justify-center"
																onPointerDown={(e) => {
																	e.preventDefault();
																	e.stopPropagation();
																}}
															>
																<PluginIcon
																	name={data.icon}
																	className="size-4 text-textcolor"
																/>
															</div>
														</DropdownMenuItem>
													))}
												</DropdownMenuContent>
											</DropdownMenu>
										) : null}

										<Button
											type="button"
											variant="link"
											size="sm"
											disabled={busy || jsonParseError || !text.trim()}
											aria-busy={saving}
											title={saving ? t('plugins.registry.saving') : undefined}
											className={titleBarBtn}
											onClick={() => void onSave()}
										>
											<span className={titleIconSlot}>
												{saving ? (
													<Spinner
														className="size-4 text-textcolor"
														aria-hidden
													/>
												) : (
													<Save className="size-4" aria-hidden />
												)}
											</span>
											{t('plugins.registry.save')}
										</Button>
										<Button
											type="button"
											variant="link"
											size="sm"
											disabled={busy}
											aria-busy={loading}
											className={titleBarBtn}
											onClick={() => void load()}
										>
											<span className={titleIconSlot}>
												{loading ? (
													<Spinner
														className="size-4 text-textcolor"
														aria-hidden
													/>
												) : (
													<ListRestart className="size-4" aria-hidden />
												)}
											</span>
											{t('plugins.registry.reload')}
										</Button>
									</div>
								</div>
							}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
