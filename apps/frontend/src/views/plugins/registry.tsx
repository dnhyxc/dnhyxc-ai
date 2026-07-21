import { Toast } from '@ui/sonner';
import { FileJson2, ListRestart, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MarkdownEditor from '@/components/design/Monaco';
import { Button } from '@/components/ui/button';
import { useI18n, useTheme } from '@/hooks';
import {
	fetchPluginRegistryRawText,
	formatRegistryUpdatedAt,
	PLUGIN_REGISTRY_FILENAME,
	type PluginRegistry,
	pluginManager,
	savePluginRegistry,
} from '@/plugins';
import { copyToClipboard, pasteFromClipboard } from '@/utils/clipboard';

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
	const textRef = useRef<string>(text);

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
		} catch (e) {
			setLoadError(e instanceof Error ? e.message : String(e));
			setText('');
			textRef.current = '';
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const onSave = async () => {
		if (!textDiff) {
			Toast({
				type: 'info',
				title: t('plugins.registry.noChanges'),
			});
			return;
		}
		if (jsonParseError) {
			Toast({
				type: 'warning',
				title: t('plugins.registry.invalidJson'),
			});
			return;
		}
		setSaving(true);
		try {
			const data = JSON.parse(text) as PluginRegistry;
			data.updatedAt = formatRegistryUpdatedAt();
			const saved = await savePluginRegistry(data);
			const payload = `${JSON.stringify(saved, null, 2)}\n`;
			setText(payload);
			textRef.current = payload;
			await pluginManager.init();
			Toast({
				type: 'success',
				title: t('plugins.registry.saveOk'),
			});
		} catch (e) {
			Toast({
				type: 'error',
				title: e instanceof Error ? e.message : t('plugins.registry.saveFail'),
			});
		} finally {
			setSaving(false);
		}
	};

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
							documentIdentity="plugins-registry-editor"
							placeholder=""
							enableMarkdownBottomBar={false}
							showTabBar={false}
							stickyScrollEnabled={false}
							clipboardAdapter={monacoClipboardAdapter}
							t={t}
							title={
								<div className="flex flex-1 items-center justify-between gap-2 pl-3">
									<div className=" flex items-center gap-2.5">
										<div className="relative">
											<FileJson2 size={16} className="text-textcolor" />
											{textDiff ? (
												<span
													className="pointer-events-none absolute -right-0.5 -top-0.5 size-2 rounded-full bg-orange-500"
													aria-hidden
												/>
											) : null}
										</div>
										<span className="text-textcolor text-sm font-medium">
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
