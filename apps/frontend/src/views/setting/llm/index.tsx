import { Button } from '@ui/button';
import { Spinner, Switch, Toast } from '@ui/index';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	clearLlmSettings,
	getLlmSettings,
	getLlmSettingsDefaults,
	type LlmSettingsView,
	updateLlmSettings,
} from '@/service/llmSettings';

const fieldInputClass =
	'flex-1 min-w-0 border border-theme/20 bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-theme/40';

const LlmSetting = () => {
	const { t } = useI18n();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [view, setView] = useState<LlmSettingsView | null>(null);
	const [enabled, setEnabled] = useState(false);
	const [baseUrl, setBaseUrl] = useState('');
	const [modelName, setModelName] = useState('');
	const [apiKey, setApiKey] = useState('');
	const [savedApiKey, setSavedApiKey] = useState('');
	const [showApiKey, setShowApiKey] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [res, defaultsRes] = await Promise.all([
				getLlmSettings(),
				getLlmSettingsDefaults(),
			]);
			if (res.success && res.data) {
				setView(res.data);
				setEnabled(res.data.enabled);
				const fallbackBase =
					defaultsRes.success && defaultsRes.data?.baseUrl
						? defaultsRes.data.baseUrl
						: 'https://api.siliconflow.cn/v1';
				setBaseUrl(res.data.baseUrl || fallbackBase);
				setModelName(res.data.modelName || 'Pro/zai-org/GLM-4.7');
				const key = res.data.apiKey ?? '';
				setSavedApiKey(key);
				setApiKey(key);
				setShowApiKey(false);
			}
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const canSave = useMemo(() => {
		return (
			apiKey.trim().length > 0 &&
			baseUrl.trim().length > 0 &&
			modelName.trim().length > 0
		);
	}, [apiKey, baseUrl, modelName]);

	const onSave = async () => {
		setSaving(true);
		try {
			const trimmedKey = apiKey.trim();
			const keyUnchanged = trimmedKey === savedApiKey.trim();
			const res = await updateLlmSettings({
				enabled,
				baseUrl: baseUrl.trim(),
				modelName: modelName.trim(),
				...(!keyUnchanged && trimmedKey ? { apiKey: trimmedKey } : {}),
			});
			if (res.success && res.data) {
				setView(res.data);
				const key = res.data.apiKey ?? '';
				setSavedApiKey(key);
				setApiKey(key);
				setShowApiKey(false);
				Toast({
					type: 'success',
					title: t('setting.llm.saveSuccess'),
				});
			}
		} finally {
			setSaving(false);
		}
	};

	const onClear = async () => {
		setSaving(true);
		try {
			const res = await clearLlmSettings();
			if (res.success && res.data) {
				setView(res.data);
				setEnabled(false);
				setBaseUrl('');
				setModelName('');
				setSavedApiKey('');
				setApiKey('');
				setShowApiKey(false);
				Toast({
					type: 'success',
					title: t('setting.llm.clearSuccess'),
				});
				void load();
			}
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="m-2 mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center">
			<div className="w-full">
				<div className="w-full border-b border-theme/20 pb-4.5">
					<div className="text-md font-bold">{t('setting.llm.title')}</div>
					<div className="my-2 px-8.5 text-xs text-textcolor/55">
						{t('setting.llm.desc')}
					</div>

					{loading ? (
						<p className="mt-3.5 px-8.5 text-sm text-textcolor/70">
							{t('common.loading')}
						</p>
					) : (
						<div className="mt-3.5 flex items-center justify-between gap-4 px-8.5 text-sm">
							<div className="min-w-0 flex-1">
								<Label
									htmlFor="llm-enabled"
									className="cursor-pointer text-sm font-medium"
								>
									{t('setting.llm.enabledLabel')}
								</Label>
								<p className="mt-1 text-xs text-textcolor/55">
									{t('setting.llm.enabledHelp')}
								</p>
							</div>
							<Switch
								id="llm-enabled"
								checked={enabled}
								onCheckedChange={setEnabled}
							/>
						</div>
					)}
				</div>

				{!loading ? (
					<>
						<div className="my-3.5 w-full border-b border-theme/20 pb-4.5">
							<div className="text-md font-bold">
								{t('setting.llm.connectionTitle')}
							</div>
							<div className="my-2 px-8.5 text-xs text-textcolor/55">
								{t('setting.llm.connectionDesc')}
							</div>

							<div className="mt-3.5 flex flex-col gap-4 px-8.5 text-sm">
								<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
									<Label
										htmlFor="llm-api-key"
										className="shrink-0 pt-2 sm:w-15"
									>
										{t('setting.llm.apiKey')}
									</Label>
									<div className="relative min-w-0 flex-1">
										<Input
											id="llm-api-key"
											type={showApiKey ? 'text' : 'password'}
											value={apiKey}
											onChange={(e) => setApiKey(e.target.value)}
											placeholder={t('setting.llm.apiKeyPlaceholder')}
											disabled={!enabled || saving}
											autoComplete="new-password"
											className={cn(fieldInputClass, 'pr-10')}
										/>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="absolute top-1/2 right-1.5 size-6 -translate-y-1/2 text-textcolor/55 hover:text-textcolor"
											disabled={!enabled || saving || !apiKey}
											aria-label={
												showApiKey
													? t('setting.llm.hideApiKey')
													: t('setting.llm.showApiKey')
											}
											onClick={() => setShowApiKey((v) => !v)}
										>
											{showApiKey ? (
												<EyeOff className="size-4" aria-hidden />
											) : (
												<Eye className="size-4" aria-hidden />
											)}
										</Button>
									</div>
								</div>

								<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
									<Label htmlFor="llm-base-url" className="shrink-0 sm:w-15">
										{t('setting.llm.baseUrl')}
									</Label>
									<Input
										id="llm-base-url"
										value={baseUrl}
										onChange={(e) => setBaseUrl(e.target.value)}
										placeholder="https://api.siliconflow.cn/v1"
										disabled={!enabled || saving}
										autoComplete="off"
										className={fieldInputClass}
									/>
								</div>

								<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
									<Label htmlFor="llm-model" className="shrink-0 sm:w-15">
										{t('setting.llm.modelName')}
									</Label>
									<Input
										id="llm-model"
										value={modelName}
										onChange={(e) => setModelName(e.target.value)}
										placeholder="Pro/zai-org/GLM-4.7"
										disabled={!enabled || saving}
										autoComplete="off"
										className={fieldInputClass}
									/>
								</div>
							</div>
						</div>

						<div className="mt-3.5 w-full pb-4.5">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<p className="min-w-0 flex-1 text-sm">
									{view?.active ? (
										<span className="text-teal-500">
											{t('setting.llm.activeHint')}
										</span>
									) : view?.enabled && !view.active ? (
										<span className="text-textcolor/60">
											{t('setting.llm.incompleteHint')}
										</span>
									) : null}
								</p>
								<div className="flex shrink-0 flex-wrap items-center">
									<Button
										size="sm"
										variant="outline"
										className={cn(
											'min-w-24 cursor-pointer border border-theme/20',
											saving && 'disabled:opacity-100',
										)}
										disabled={saving}
										onClick={() => void onClear()}
									>
										{t('setting.llm.clear')}
									</Button>
									<Button
										size="sm"
										className={cn(
											'ml-3 min-w-24 cursor-pointer',
											saving && 'disabled:opacity-100',
										)}
										disabled={saving || !canSave}
										onClick={() => void onSave()}
									>
										{saving ? <Spinner className="size-4" /> : null}
										{t('setting.llm.save')}
									</Button>
								</div>
							</div>
						</div>
					</>
				) : null}
			</div>
		</div>
	);
};

export default LlmSetting;
