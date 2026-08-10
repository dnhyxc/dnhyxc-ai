import { Toast } from '@ui/sonner';
import { ListRestart, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MarkdownEditor from '@/components/design/Monaco';
import { Button } from '@/components/ui/button';
import {
	fetchPluginRegistryRawText,
	PLUGIN_REGISTRY_FILENAME,
	type PluginRegistry,
	pluginManager,
	savePluginRegistry,
} from '@/federation';
import { useI18n, useTheme } from '@/hooks';
import { copyToClipboard, pasteFromClipboard } from '@/utils/clipboard';
import { RegistryFieldsHelp } from './RegistryFieldsHelp';

export default function PluginRegistryEditorPage() {
	const { t } = useI18n();
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
	const [loadError, setLoadError] = useState<string | null>(null);
	/** 递增以强制 Monaco 在仍有焦点时也写入外部 value（含保存后的 updatedAt） */
	const [docEpoch, setDocEpoch] = useState(0);
	const textRef = useRef<string>(text);
	const getEditorTextRef = useRef<(() => string) | null>(null);

	const jsonParseError = useMemo(() => {
		if (!text.trim()) return true;
		try {
			const data = JSON.parse(text) as { plugins?: unknown };
			return !Array.isArray(data.plugins);
		} catch {
			return true;
		}
	}, [text]);

	const textDiff = useMemo(() => {
		return textRef.current !== text;
	}, [text, textRef.current]);

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

	const onSave = useCallback(async () => {
		if (loading || saving) return;
		// 从 Monaco 刷出最新正文（onChange 有 rAF 合并，父级 text 可能滞后）
		const latest = getEditorTextRef.current?.() ?? text;
		if (latest === textRef.current) {
			Toast({
				type: 'info',
				title: t('plugins.registry.noChanges'),
			});
			return;
		}
		let data: PluginRegistry;
		try {
			data = JSON.parse(latest) as PluginRegistry;
		} catch {
			Toast({
				type: 'warning',
				title: t('plugins.registry.invalidJson'),
			});
			return;
		}
		if (!Array.isArray(data.plugins)) {
			Toast({
				type: 'warning',
				title: t('plugins.registry.invalidJson'),
			});
			return;
		}
		setSaving(true);
		try {
			// updatedAt 由 savePluginRegistry 统一写成当前时间
			const saved = await savePluginRegistry(data);
			const payload = `${JSON.stringify(saved, null, 2)}\n`;
			setText(payload);
			textRef.current = payload;
			setDocEpoch((n) => n + 1);
			await pluginManager.init(); // 与 mf.start() 相同
			Toast({
				type: 'success',
				title: t('plugins.registry.saveOk'),
			});
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
	}, [loading, saving, t, text]);

	// ⌘/Ctrl+S → 保存到服务器（捕获阶段，避免 Monaco/浏览器默认另存为）
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

	return (
		<div className="box-border flex h-full min-h-0 w-full flex-col p-5.5 pt-0">
			{loadError ? (
				<p className="text-destructive mb-2 shrink-0 text-sm">{loadError}</p>
			) : null}
			{!loading && jsonParseError && text.trim() ? (
				<p className="text-destructive mb-2 shrink-0">
					{t('plugins.registry.invalidJson')}
				</p>
			) : null}

			<div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col">
				<div className="border-theme-border min-h-0 min-w-0 flex-1 basis-0 overflow-hidden rounded-md border">
					{loading ? (
						<p className="text-textcolor/55 p-4 text-sm">
							{t('plugins.registry.loading')}
						</p>
					) : (
						<MarkdownEditor
							className="h-full min-h-0"
							value={text}
							readOnly={saving}
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
									<div className="flex shrink-0 items-center gap-3 pr-1">
										<Button
											type="button"
											variant="link"
											size="sm"
											disabled={loading || saving}
											className="text-textcolor px-0! gap-1 lucide-stroke-draw-hover"
											onClick={() => void load()}
										>
											<ListRestart className="size-4.5" />
											{t('plugins.registry.reload')}
										</Button>
										<Button
											type="button"
											variant="link"
											size="sm"
											disabled={
												loading || saving || jsonParseError || !text.trim()
											}
											className="text-textcolor px-0! gap-1 lucide-stroke-draw-hover"
											onClick={() => void onSave()}
										>
											<Save className="size-4" />
											{saving
												? t('plugins.registry.saving')
												: t('plugins.registry.save')}
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
