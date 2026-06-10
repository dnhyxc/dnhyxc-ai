import { Button } from '@ui/button';
import { CreatableCombobox } from '@ui/combobox';
import { Spinner, Switch, Toast } from '@ui/index';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	clearLlmSettings,
	getLlmSettings,
	type LlmSettingsView,
	updateLlmSettings,
} from '@/service/llmSettings';
import useStore from '@/store';

const fieldInputClass =
	'flex-1 min-w-0 border border-theme/20 bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-theme/40';

function readEnvTrimmed(key: keyof ImportMetaEnv): string {
	const raw = import.meta.env[key];
	return typeof raw === 'string' ? raw.trim() : '';
}

function readEnvGlmBaseUrl(): string {
	return (
		readEnvTrimmed('VITE_GLM_BASE_URL') ||
		'https://open.bigmodel.cn/api/paas/v4'
	);
}

function readEnvGlmModelName(): string {
	return readEnvTrimmed('VITE_GLM_MODEL_NAME') || 'glm-4.7-flash';
}

function readEnvSiliconflowBaseUrl(): string {
	return (
		readEnvTrimmed('VITE_SILICONFLOW_BASE_URL') ||
		'https://api.siliconflow.cn/v1'
	);
}

function readEnvSiliconflowModelName(): string {
	return readEnvTrimmed('VITE_SILICONFLOW_MODEL_NAME') || 'Pro/zai-org/GLM-4.7';
}

/** 与后端 UserService.isMembershipActive 对齐 */
function isMembershipActiveFromUserInfo(u: object): boolean {
	const r = u as Record<string, unknown>;
	if (r.isMember !== true) return false;
	const expiresRaw = r.memberExpiresAt ?? r.memberExpireAt;
	if (expiresRaw == null || String(expiresRaw).trim() === '') return true;
	const exp = new Date(String(expiresRaw));
	return !Number.isNaN(exp.getTime()) && exp.getTime() > Date.now();
}

type LlmProviderDefaults = {
	baseUrl: string;
	modelName: string;
	apiKey: string;
};

/** 有效会员默认硅基流动，否则默认 GLM（与后端 createLlm 一致） */
function getProviderDefaults(isMember: boolean): LlmProviderDefaults {
	if (isMember) {
		return {
			baseUrl: readEnvSiliconflowBaseUrl(),
			modelName: readEnvSiliconflowModelName(),
			apiKey: readEnvSiliconflowApiKey(),
		};
	}
	return {
		baseUrl: readEnvGlmBaseUrl(),
		modelName: readEnvGlmModelName(),
		apiKey: readEnvGlmApiKey(),
	};
}

/** 服务商联动预设：选 Base URL 或模型名称中的任一项时，另一项同步为配对值 */
const LLM_PROVIDER_PRESETS = [
	{
		baseUrl: readEnvGlmBaseUrl(),
		modelName: readEnvGlmModelName(),
		baseUrlLabelKey: 'setting.llm.baseUrlOption.glm' as const,
		modelLabelKey: 'setting.llm.modelOption.glmFlash' as const,
	},
	{
		baseUrl: 'https://api.siliconflow.cn/v1',
		modelName: 'Pro/zai-org/GLM-4.7',
		baseUrlLabelKey: 'setting.llm.baseUrlOption.siliconflow' as const,
		modelLabelKey: 'setting.llm.modelOption.glm47' as const,
	},
	{
		baseUrl: 'https://api.deepseek.com',
		modelName: 'deepseek-chat',
		baseUrlLabelKey: 'setting.llm.baseUrlOption.deepseek' as const,
		modelLabelKey: 'setting.llm.modelOption.deepseekChat' as const,
	},
] as const;

const LLM_BASE_URL_TO_MODEL: ReadonlyMap<string, string> = new Map(
	LLM_PROVIDER_PRESETS.map((p) => [p.baseUrl, p.modelName]),
);

const LLM_MODEL_TO_BASE_URL: ReadonlyMap<string, string> = new Map(
	LLM_PROVIDER_PRESETS.map((p) => [p.modelName, p.baseUrl]),
);

function resolveTextField(raw: string | undefined, fallback: string): string {
	const trimmed = raw?.trim() ?? '';
	return trimmed.length > 0 ? trimmed : fallback;
}

function readEnvSiliconflowApiKey(): string {
	return readEnvTrimmed('VITE_SILICONFLOW_API_KEY');
}

function readEnvGlmApiKey(): string {
	return readEnvTrimmed('VITE_GLM_API_KEY');
}

function resolveApiKeyFields(
	savedFromServer: string | undefined | null,
	defaultApiKey: string,
): {
	displayKey: string;
	savedKey: string;
} {
	const saved = (savedFromServer ?? '').trim();
	if (saved) {
		return { displayKey: saved, savedKey: saved };
	}
	return {
		displayKey: defaultApiKey,
		savedKey: '',
	};
}

const LlmSetting = observer(() => {
	const { t } = useI18n();
	const { userStore } = useStore();
	const isMember = useMemo(
		() => isMembershipActiveFromUserInfo(userStore.userInfo),
		[userStore.userInfo],
	);
	const providerDefaults = useMemo(
		() => getProviderDefaults(isMember),
		[isMember],
	);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [view, setView] = useState<LlmSettingsView | null>(null);
	const [enabled, setEnabled] = useState(false);
	const [baseUrl, setBaseUrl] = useState(providerDefaults.baseUrl);
	const [modelName, setModelName] = useState(providerDefaults.modelName);
	const [apiKey, setApiKey] = useState(providerDefaults.apiKey);
	const [savedApiKey, setSavedApiKey] = useState('');
	const [showApiKey, setShowApiKey] = useState(false);

	const baseUrlOptions = useMemo(
		() =>
			LLM_PROVIDER_PRESETS.map((preset) => ({
				value: preset.baseUrl,
				label: t(preset.baseUrlLabelKey),
			})),
		[t],
	);

	const modelOptions = useMemo(
		() =>
			LLM_PROVIDER_PRESETS.map((preset) => ({
				value: preset.modelName,
				label: t(preset.modelLabelKey),
			})),
		[t],
	);

	const resetApiKey = useCallback(() => {
		setApiKey('');
		setSavedApiKey('');
		setShowApiKey(false);
	}, []);

	const onBaseUrlChange = useCallback(
		(next: string) => {
			if (next.trim() === baseUrl.trim()) return;
			setBaseUrl(next);
			resetApiKey();
			const pairedModel = LLM_BASE_URL_TO_MODEL.get(next.trim());
			if (pairedModel) setModelName(pairedModel);
		},
		[baseUrl, resetApiKey],
	);

	const onModelNameChange = useCallback(
		(next: string) => {
			if (next.trim() === modelName.trim()) return;
			setModelName(next);
			resetApiKey();
			const pairedBase = LLM_MODEL_TO_BASE_URL.get(next.trim());
			if (pairedBase) setBaseUrl(pairedBase);
		},
		[modelName, resetApiKey],
	);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [res] = await Promise.all([getLlmSettings()]);
			if (res.success && res.data) {
				setView(res.data);
				setEnabled(res.data.enabled);
				setBaseUrl(
					resolveTextField(res.data.baseUrl, providerDefaults.baseUrl),
				);
				setModelName(
					resolveTextField(res.data.modelName, providerDefaults.modelName),
				);
				const { displayKey, savedKey } = resolveApiKeyFields(
					res.data.apiKey,
					providerDefaults.apiKey,
				);
				setSavedApiKey(savedKey);
				setApiKey(displayKey);
				setShowApiKey(false);
			}
		} finally {
			setLoading(false);
		}
	}, [providerDefaults]);

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
				const { displayKey, savedKey } = resolveApiKeyFields(
					res.data.apiKey,
					providerDefaults.apiKey,
				);
				setSavedApiKey(savedKey);
				setApiKey(displayKey);
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
				setBaseUrl(providerDefaults.baseUrl);
				setModelName(providerDefaults.modelName);
				setSavedApiKey('');
				setApiKey(providerDefaults.apiKey);
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
									<div className="min-w-0 flex-1">
										<CreatableCombobox
											id="llm-base-url"
											value={baseUrl}
											onChange={onBaseUrlChange}
											options={baseUrlOptions}
											placeholder={t('setting.llm.baseUrlPlaceholder')}
											presetsAriaLabel={t('setting.llm.openPresets')}
											disabled={!enabled || saving}
											inputClassName={fieldInputClass}
										/>
									</div>
								</div>

								<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
									<Label htmlFor="llm-model" className="shrink-0 sm:w-15">
										{t('setting.llm.modelName')}
									</Label>
									<div className="min-w-0 flex-1">
										<CreatableCombobox
											id="llm-model"
											value={modelName}
											onChange={onModelNameChange}
											options={modelOptions}
											placeholder={t('setting.llm.modelNamePlaceholder')}
											presetsAriaLabel={t('setting.llm.openPresets')}
											disabled={!enabled || saving}
											inputClassName={fieldInputClass}
										/>
									</div>
								</div>
							</div>
						</div>

						<div className="mt-3.5 w-full pb-4.5">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<p className="min-w-0 flex-1 text-sm">
									{view?.active ? (
										<span className="text-teal-500">
											{t('setting.llm.activeHint', {
												modelName:
													view.modelName?.trim() || modelName.trim() || '—',
											})}
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
});

export default LlmSetting;
