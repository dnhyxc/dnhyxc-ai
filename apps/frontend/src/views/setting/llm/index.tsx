import { Button } from '@ui/button';
import { CreatableCombobox } from '@ui/combobox';
import { Spinner, Switch, Toast } from '@ui/index';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n, useIsSuperAdmin, useMembershipActive } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	clearLlmSettings,
	clearLlmVectorSettings,
	getLlmSettings,
	getLlmSettingsDefaults,
	type LlmSettingsView,
	updateLlmSettings,
	updateLlmVectorSettings,
} from '@/service/llmSettings';

const fieldInputClass =
	'flex-1 min-w-0 border border-theme/20 bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-theme/40';

/** 大模型 / 向量设置表单项：label 固定宽度、单行、与输入框间距一致 */
const LLM_FORM_ROW_CLASS =
	'flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4';

function getLlmFormLabelClass(locale: string) {
	return locale === 'zh-CN'
		? 'shrink-0 inline-block whitespace-nowrap sm:w-[6.5em] sm:min-w-[6.5em] text-justify [text-align-last:justify]'
		: 'shrink-0 inline-block whitespace-nowrap sm:w-32 sm:min-w-32 text-end';
}

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
	return readEnvTrimmed('VITE_SILICONFLOW_MODEL_NAME') || 'Pro/zai-org/GLM-5.1';
}

type LlmProviderDefaults = {
	baseUrl: string;
	modelName: string;
};

/** 有效会员默认硅基流动，否则默认 GLM（与后端 createLlm 一致；不含 API Key） */
function getProviderDefaults(isMember: boolean): LlmProviderDefaults {
	if (isMember) {
		return {
			baseUrl: readEnvSiliconflowBaseUrl(),
			modelName: readEnvSiliconflowModelName(),
		};
	}
	return {
		baseUrl: readEnvGlmBaseUrl(),
		modelName: readEnvGlmModelName(),
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
		modelName: 'Pro/zai-org/GLM-5.1',
		baseUrlLabelKey: 'setting.llm.baseUrlOption.siliconflow' as const,
		modelLabelKey: 'setting.llm.modelOption.glm51' as const,
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

const FALLBACK_VECTOR_DEFAULTS: {
	baseUrl: string;
	rerankUrl: string;
	embeddingModel: string;
	rerankModel: string;
	collectionName: string;
} = {
	baseUrl: 'https://api.siliconflow.cn/v1/embeddings',
	rerankUrl: 'https://api.siliconflow.cn/v1/rerank',
	embeddingModel: 'BAAI/bge-large-zh-v1.5',
	rerankModel: 'BAAI/bge-reranker-v2-m3',
	collectionName: 'knowledge_chunks_v2',
};

const VECTOR_EMBEDDING_URL_PRESETS = [
	{
		baseUrl: FALLBACK_VECTOR_DEFAULTS.baseUrl,
		labelKey: 'setting.llm.vectorEmbeddingUrlOption.siliconflow' as const,
	},
] as const;

const VECTOR_RERANK_URL_PRESETS = [
	{
		rerankUrl: FALLBACK_VECTOR_DEFAULTS.rerankUrl,
		labelKey: 'setting.llm.vectorRerankUrlOption.siliconflow' as const,
	},
] as const;

/** 向量 embedding / rerank / collection 三套预设联动 */
const VECTOR_TIER_PRESETS = [
	{
		embeddingModel: 'BAAI/bge-large-zh-v1.5',
		rerankModel: 'BAAI/bge-reranker-v2-m3',
		collectionName: 'knowledge_chunks_v2',
		embeddingLabelKey: 'setting.llm.vectorModelOption.bgeLargeZh' as const,
		rerankLabelKey: 'setting.llm.vectorRerankOption.bgeReranker' as const,
		collectionLabelKey: 'setting.llm.vectorCollectionOption.default' as const,
	},
	{
		embeddingModel: 'Qwen/Qwen3-Embedding-4B',
		rerankModel: 'Qwen/Qwen3-Reranker-4B',
		collectionName: 'knowledge_chunks_qwen3_2560',
		embeddingLabelKey: 'setting.llm.vectorModelOption.qwen3Emb' as const,
		rerankLabelKey: 'setting.llm.vectorRerankOption.qwen3Rerank' as const,
		collectionLabelKey: 'setting.llm.vectorCollectionOption.qwen3' as const,
	},
] as const;

type VectorTierPreset = (typeof VECTOR_TIER_PRESETS)[number];

const VECTOR_EMBEDDING_MODEL_PRESETS = VECTOR_TIER_PRESETS.map((p) => ({
	modelName: p.embeddingModel,
	labelKey: p.embeddingLabelKey,
	collectionName: p.collectionName,
}));

const VECTOR_RERANK_MODEL_PRESETS = VECTOR_TIER_PRESETS.map((p) => ({
	modelName: p.rerankModel,
	labelKey: p.rerankLabelKey,
}));

const VECTOR_COLLECTION_PRESETS = VECTOR_TIER_PRESETS.map((p) => ({
	collectionName: p.collectionName,
	labelKey: p.collectionLabelKey,
}));

const VECTOR_TIER_BY_EMBEDDING: ReadonlyMap<string, VectorTierPreset> = new Map(
	VECTOR_TIER_PRESETS.map((p) => [p.embeddingModel, p]),
);

const VECTOR_TIER_BY_RERANK: ReadonlyMap<string, VectorTierPreset> = new Map(
	VECTOR_TIER_PRESETS.map((p) => [p.rerankModel, p]),
);

const VECTOR_TIER_BY_COLLECTION: ReadonlyMap<string, VectorTierPreset> =
	new Map(VECTOR_TIER_PRESETS.map((p) => [p.collectionName, p]));

function resolveVectorTierByEmbedding(
	model: string,
): VectorTierPreset | undefined {
	return VECTOR_TIER_BY_EMBEDDING.get(model.trim());
}

function resolveVectorTierByRerank(
	model: string,
): VectorTierPreset | undefined {
	return VECTOR_TIER_BY_RERANK.get(model.trim());
}

function resolveVectorTierByCollection(
	name: string,
): VectorTierPreset | undefined {
	return VECTOR_TIER_BY_COLLECTION.get(name.trim());
}

function resolveTextField(raw: string | undefined, fallback: string): string {
	const trimmed = raw?.trim() ?? '';
	return trimmed.length > 0 ? trimmed : fallback;
}

function resolveApiKeyFields(savedFromServer: string | undefined | null): {
	displayKey: string;
	savedKey: string;
} {
	const saved = (savedFromServer ?? '').trim();
	return { displayKey: saved, savedKey: saved };
}

const LlmSetting = observer(() => {
	const { t, locale } = useI18n();
	const llmFormLabelClass = useMemo(
		() => getLlmFormLabelClass(locale),
		[locale],
	);
	const { isMemberActive: isMember } = useMembershipActive();
	const isSuperAdmin = useIsSuperAdmin();
	const providerDefaults = useMemo(
		() => getProviderDefaults(isMember),
		[isMember],
	);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [view, setView] = useState<LlmSettingsView | null>(null);
	const showVectorSection = useMemo(
		() => isSuperAdmin || !view?.vectorBgeOnlyGlobal,
		[isSuperAdmin, view?.vectorBgeOnlyGlobal],
	);
	const [baseUrl, setBaseUrl] = useState(providerDefaults.baseUrl);
	const [modelName, setModelName] = useState(providerDefaults.modelName);
	const [apiKey, setApiKey] = useState('');
	const [savedApiKey, setSavedApiKey] = useState('');
	const [showApiKey, setShowApiKey] = useState(false);

	const [vectorDefaults, setVectorDefaults] = useState(
		FALLBACK_VECTOR_DEFAULTS,
	);
	const [vectorBaseUrl, setVectorBaseUrl] = useState(
		FALLBACK_VECTOR_DEFAULTS.baseUrl,
	);
	const [vectorRerankUrl, setVectorRerankUrl] = useState(
		FALLBACK_VECTOR_DEFAULTS.rerankUrl,
	);
	const [vectorEmbeddingModel, setVectorEmbeddingModel] = useState(
		FALLBACK_VECTOR_DEFAULTS.embeddingModel,
	);
	const [vectorRerankModel, setVectorRerankModel] = useState(
		FALLBACK_VECTOR_DEFAULTS.rerankModel,
	);
	const [vectorCollectionName, setVectorCollectionName] = useState(
		FALLBACK_VECTOR_DEFAULTS.collectionName,
	);
	const [vectorApiKey, setVectorApiKey] = useState('');
	const [savedVectorApiKey, setSavedVectorApiKey] = useState('');
	const [showVectorApiKey, setShowVectorApiKey] = useState(false);
	const [vectorSaving, setVectorSaving] = useState(false);
	const [vectorBgeOnly, setVectorBgeOnly] = useState(false);

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

	const vectorBaseUrlOptions = useMemo(
		() =>
			VECTOR_EMBEDDING_URL_PRESETS.map((preset) => ({
				value: preset.baseUrl,
				label: t(preset.labelKey),
			})),
		[t],
	);

	const vectorRerankUrlOptions = useMemo(
		() =>
			VECTOR_RERANK_URL_PRESETS.map((preset) => ({
				value: preset.rerankUrl,
				label: t(preset.labelKey),
			})),
		[t],
	);

	const vectorEmbeddingModelOptions = useMemo(
		() =>
			VECTOR_EMBEDDING_MODEL_PRESETS.map((preset) => ({
				value: preset.modelName,
				label: t(preset.labelKey),
			})),
		[t],
	);

	const vectorRerankModelOptions = useMemo(
		() =>
			VECTOR_RERANK_MODEL_PRESETS.map((preset) => ({
				value: preset.modelName,
				label: t(preset.labelKey),
			})),
		[t],
	);

	const vectorCollectionOptions = useMemo(
		() =>
			VECTOR_COLLECTION_PRESETS.map((preset) => ({
				value: preset.collectionName,
				label: t(preset.labelKey),
			})),
		[t],
	);

	const onBaseUrlChange = useCallback(
		(next: string) => {
			if (next.trim() === baseUrl.trim()) return;
			setBaseUrl(next);
			const pairedModel = LLM_BASE_URL_TO_MODEL.get(next.trim());
			if (pairedModel) setModelName(pairedModel);
		},
		[baseUrl],
	);

	const onModelNameChange = useCallback(
		(next: string) => {
			if (next.trim() === modelName.trim()) return;
			setModelName(next);
			const pairedBase = LLM_MODEL_TO_BASE_URL.get(next.trim());
			if (pairedBase) setBaseUrl(pairedBase);
		},
		[modelName],
	);

	const onVectorEmbeddingModelChange = useCallback(
		(next: string) => {
			if (next.trim() === vectorEmbeddingModel.trim()) return;
			const tier = resolveVectorTierByEmbedding(next);
			if (tier) {
				setVectorEmbeddingModel(tier.embeddingModel);
				setVectorRerankModel(tier.rerankModel);
				setVectorCollectionName(tier.collectionName);
				return;
			}
			setVectorEmbeddingModel(next);
		},
		[vectorEmbeddingModel],
	);

	const onVectorRerankModelChange = useCallback(
		(next: string) => {
			if (next.trim() === vectorRerankModel.trim()) return;
			const tier = resolveVectorTierByRerank(next);
			if (tier) {
				setVectorEmbeddingModel(tier.embeddingModel);
				setVectorRerankModel(tier.rerankModel);
				setVectorCollectionName(tier.collectionName);
				return;
			}
			setVectorRerankModel(next);
		},
		[vectorRerankModel],
	);

	const onVectorCollectionNameChange = useCallback(
		(next: string) => {
			if (next.trim() === vectorCollectionName.trim()) return;
			const tier = resolveVectorTierByCollection(next);
			if (tier) {
				setVectorEmbeddingModel(tier.embeddingModel);
				setVectorRerankModel(tier.rerankModel);
				setVectorCollectionName(tier.collectionName);
				return;
			}
			setVectorCollectionName(next);
		},
		[vectorCollectionName],
	);

	const applyVectorDefaults = useCallback(
		(defaults: {
			baseUrl: string;
			rerankUrl: string;
			embeddingModel: string;
			rerankModel: string;
			collectionName: string;
		}) => {
			setVectorDefaults(defaults);
			setVectorBaseUrl(defaults.baseUrl);
			setVectorRerankUrl(defaults.rerankUrl);
			setVectorEmbeddingModel(defaults.embeddingModel);
			setVectorRerankModel(defaults.rerankModel);
			setVectorCollectionName(defaults.collectionName);
		},
		[],
	);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			let vd = { ...FALLBACK_VECTOR_DEFAULTS };
			const defaultsRes = await getLlmSettingsDefaults();
			if (defaultsRes.success && defaultsRes.data?.vector) {
				vd = {
					baseUrl:
						defaultsRes.data.vector.baseUrl || FALLBACK_VECTOR_DEFAULTS.baseUrl,
					rerankUrl:
						defaultsRes.data.vector.rerankUrl ||
						FALLBACK_VECTOR_DEFAULTS.rerankUrl,
					embeddingModel:
						defaultsRes.data.vector.embeddingModel ||
						FALLBACK_VECTOR_DEFAULTS.embeddingModel,
					rerankModel:
						defaultsRes.data.vector.rerankModel ||
						FALLBACK_VECTOR_DEFAULTS.rerankModel,
					collectionName:
						defaultsRes.data.vector.collectionName ||
						FALLBACK_VECTOR_DEFAULTS.collectionName,
				};
				applyVectorDefaults(vd);
			}
			const res = await getLlmSettings();
			if (res.success && res.data) {
				setView(res.data);
				setBaseUrl(
					resolveTextField(res.data.baseUrl, providerDefaults.baseUrl),
				);
				setModelName(
					resolveTextField(res.data.modelName, providerDefaults.modelName),
				);
				const { displayKey, savedKey } = resolveApiKeyFields(res.data.apiKey);
				setSavedApiKey(savedKey);
				setApiKey(displayKey);
				setShowApiKey(false);

				setVectorBaseUrl(resolveTextField(res.data.vectorBaseUrl, vd.baseUrl));
				setVectorRerankUrl(
					resolveTextField(res.data.vectorRerankUrl, vd.rerankUrl),
				);
				setVectorEmbeddingModel(
					resolveTextField(res.data.vectorEmbeddingModel, vd.embeddingModel),
				);
				setVectorRerankModel(
					resolveTextField(res.data.vectorRerankModel, vd.rerankModel),
				);
				setVectorCollectionName(
					resolveTextField(res.data.vectorCollectionName, vd.collectionName),
				);
				const vectorKey = resolveApiKeyFields(res.data.vectorApiKey);
				setSavedVectorApiKey(vectorKey.savedKey);
				setVectorApiKey(vectorKey.displayKey);
				setShowVectorApiKey(false);
				setVectorBgeOnly(Boolean(res.data.vectorBgeOnly));
			}
		} finally {
			setLoading(false);
		}
	}, [applyVectorDefaults, providerDefaults]);

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

	const hasUnsavedChanges = useMemo(() => {
		if (!view?.active) return false;
		const savedBase = resolveTextField(view.baseUrl, providerDefaults.baseUrl);
		const savedModel = resolveTextField(
			view.modelName,
			providerDefaults.modelName,
		);
		const savedKeyDisplay = savedApiKey;
		return (
			baseUrl.trim() !== savedBase.trim() ||
			modelName.trim() !== savedModel.trim() ||
			apiKey.trim() !== savedKeyDisplay.trim()
		);
	}, [
		apiKey,
		baseUrl,
		modelName,
		providerDefaults.baseUrl,
		providerDefaults.modelName,
		savedApiKey,
		view,
	]);

	/** 未启用自定义时，表单与基线一致则视为「无待保存修改」（含恢复默认后的预填项） */
	const inactiveFormBaseline = useMemo(() => {
		const hasStoredFields =
			Boolean(view?.baseUrl?.trim()) ||
			Boolean(view?.modelName?.trim()) ||
			Boolean(savedApiKey);
		if (hasStoredFields) {
			return {
				baseUrl: resolveTextField(view?.baseUrl, providerDefaults.baseUrl),
				modelName: resolveTextField(
					view?.modelName,
					providerDefaults.modelName,
				),
				apiKey: savedApiKey,
			};
		}
		return {
			baseUrl: providerDefaults.baseUrl,
			modelName: providerDefaults.modelName,
			apiKey: '',
		};
	}, [providerDefaults, savedApiKey, view?.baseUrl, view?.modelName]);

	const hasDraftChanges = useMemo(() => {
		if (view?.active) return hasUnsavedChanges;
		return (
			baseUrl.trim() !== inactiveFormBaseline.baseUrl.trim() ||
			modelName.trim() !== inactiveFormBaseline.modelName.trim() ||
			apiKey.trim() !== inactiveFormBaseline.apiKey.trim()
		);
	}, [
		apiKey,
		baseUrl,
		hasUnsavedChanges,
		inactiveFormBaseline,
		modelName,
		view?.active,
	]);

	const canSubmitSave = canSave && hasDraftChanges;

	const canSaveVector = useMemo(() => {
		return (
			vectorApiKey.trim().length > 0 &&
			vectorBaseUrl.trim().length > 0 &&
			vectorRerankUrl.trim().length > 0 &&
			vectorEmbeddingModel.trim().length > 0 &&
			vectorRerankModel.trim().length > 0 &&
			vectorCollectionName.trim().length > 0
		);
	}, [
		vectorApiKey,
		vectorBaseUrl,
		vectorCollectionName,
		vectorEmbeddingModel,
		vectorRerankModel,
		vectorRerankUrl,
	]);

	const hasVectorUnsavedChanges = useMemo(() => {
		if (!view?.vectorActive) return false;
		const savedBase = resolveTextField(
			view.vectorBaseUrl,
			vectorDefaults.baseUrl,
		);
		const savedRerankUrl = resolveTextField(
			view.vectorRerankUrl,
			vectorDefaults.rerankUrl,
		);
		const savedEmb = resolveTextField(
			view.vectorEmbeddingModel,
			vectorDefaults.embeddingModel,
		);
		const savedRerank = resolveTextField(
			view.vectorRerankModel,
			vectorDefaults.rerankModel,
		);
		const savedCollection = resolveTextField(
			view.vectorCollectionName,
			vectorDefaults.collectionName,
		);
		const savedKeyDisplay = savedVectorApiKey;
		return (
			vectorBgeOnly !== Boolean(view.vectorBgeOnly) ||
			vectorBaseUrl.trim() !== savedBase.trim() ||
			vectorRerankUrl.trim() !== savedRerankUrl.trim() ||
			vectorEmbeddingModel.trim() !== savedEmb.trim() ||
			vectorRerankModel.trim() !== savedRerank.trim() ||
			vectorCollectionName.trim() !== savedCollection.trim() ||
			vectorApiKey.trim() !== savedKeyDisplay.trim()
		);
	}, [
		savedVectorApiKey,
		vectorApiKey,
		vectorBaseUrl,
		vectorBgeOnly,
		vectorCollectionName,
		vectorDefaults,
		vectorEmbeddingModel,
		vectorRerankModel,
		vectorRerankUrl,
		view,
	]);

	const inactiveVectorBaseline = useMemo(() => {
		const hasStored =
			Boolean(view?.vectorBaseUrl?.trim()) ||
			Boolean(view?.vectorRerankUrl?.trim()) ||
			Boolean(view?.vectorEmbeddingModel?.trim()) ||
			Boolean(view?.vectorRerankModel?.trim()) ||
			Boolean(view?.vectorCollectionName?.trim()) ||
			Boolean(savedVectorApiKey);
		if (hasStored) {
			return {
				baseUrl: resolveTextField(view?.vectorBaseUrl, vectorDefaults.baseUrl),
				rerankUrl: resolveTextField(
					view?.vectorRerankUrl,
					vectorDefaults.rerankUrl,
				),
				embeddingModel: resolveTextField(
					view?.vectorEmbeddingModel,
					vectorDefaults.embeddingModel,
				),
				rerankModel: resolveTextField(
					view?.vectorRerankModel,
					vectorDefaults.rerankModel,
				),
				collectionName: resolveTextField(
					view?.vectorCollectionName,
					vectorDefaults.collectionName,
				),
				apiKey: savedVectorApiKey,
			};
		}
		return {
			baseUrl: vectorDefaults.baseUrl,
			rerankUrl: vectorDefaults.rerankUrl,
			embeddingModel: vectorDefaults.embeddingModel,
			rerankModel: vectorDefaults.rerankModel,
			collectionName: vectorDefaults.collectionName,
			apiKey: '',
			bgeOnly: false,
		};
	}, [savedVectorApiKey, vectorDefaults, view]);

	const hasVectorDraftChanges = useMemo(() => {
		if (view?.vectorActive) return hasVectorUnsavedChanges;
		return (
			vectorBgeOnly !== inactiveVectorBaseline.bgeOnly ||
			vectorBaseUrl.trim() !== inactiveVectorBaseline.baseUrl.trim() ||
			vectorRerankUrl.trim() !== inactiveVectorBaseline.rerankUrl.trim() ||
			vectorEmbeddingModel.trim() !==
				inactiveVectorBaseline.embeddingModel.trim() ||
			vectorRerankModel.trim() !== inactiveVectorBaseline.rerankModel.trim() ||
			vectorCollectionName.trim() !==
				inactiveVectorBaseline.collectionName.trim() ||
			vectorApiKey.trim() !== inactiveVectorBaseline.apiKey.trim()
		);
	}, [
		hasVectorUnsavedChanges,
		inactiveVectorBaseline,
		vectorApiKey,
		vectorBaseUrl,
		vectorBgeOnly,
		vectorCollectionName,
		vectorEmbeddingModel,
		vectorRerankModel,
		vectorRerankUrl,
		view?.vectorActive,
	]);

	const canSubmitVectorSave = canSaveVector && hasVectorDraftChanges;

	const footerHint = useMemo(() => {
		if (view?.active && !hasDraftChanges) {
			return {
				tone: 'active' as const,
				message: t('setting.llm.activeHint', {
					modelName: view.modelName?.trim() || modelName.trim() || '—',
				}),
			};
		}
		if (!hasDraftChanges) {
			return {
				tone: 'default' as const,
				message: t('setting.llm.defaultHint', {
					modelName: providerDefaults.modelName.trim() || '—',
				}),
			};
		}
		if (!canSave) {
			return {
				tone: 'default' as const,
				message: t('setting.llm.incompleteDraftHint'),
			};
		}
		return {
			tone: 'pending' as const,
			message: view?.active
				? t('setting.llm.unsavedHint')
				: t('setting.llm.readyToSaveHint'),
		};
	}, [
		canSave,
		hasDraftChanges,
		modelName,
		providerDefaults.modelName,
		t,
		view?.active,
		view?.modelName,
	]);

	const vectorFooterHint = useMemo(() => {
		if (view?.vectorActive && view.vectorBgeOnly && !hasVectorDraftChanges) {
			return {
				tone: 'active' as const,
				message: t('setting.llm.vectorBgeOnlyActiveHint'),
			};
		}
		if (view?.vectorActive && !hasVectorDraftChanges) {
			return {
				tone: 'active' as const,
				message: t('setting.llm.vectorActiveHint', {
					embeddingModel:
						view.vectorEmbeddingModel?.trim() ||
						vectorEmbeddingModel.trim() ||
						'—',
				}),
			};
		}
		if (!hasVectorDraftChanges) {
			return {
				tone: 'default' as const,
				message: t('setting.llm.vectorDefaultHint', {
					embeddingModel: vectorDefaults.embeddingModel.trim() || '—',
				}),
			};
		}
		if (!canSaveVector) {
			return {
				tone: 'default' as const,
				message: t('setting.llm.vectorIncompleteDraftHint'),
			};
		}
		return {
			tone: 'pending' as const,
			message: view?.vectorActive
				? t('setting.llm.vectorUnsavedHint')
				: t('setting.llm.vectorReadyToSaveHint'),
		};
	}, [
		canSaveVector,
		hasVectorDraftChanges,
		t,
		vectorDefaults.embeddingModel,
		vectorEmbeddingModel,
		view?.vectorActive,
		view?.vectorEmbeddingModel,
	]);

	const onSave = async () => {
		setSaving(true);
		try {
			const trimmedKey = apiKey.trim();
			const keyUnchanged = trimmedKey === savedApiKey.trim();
			const res = await updateLlmSettings({
				enabled: true,
				baseUrl: baseUrl.trim(),
				modelName: modelName.trim(),
				...(!keyUnchanged && trimmedKey ? { apiKey: trimmedKey } : {}),
			});
			if (res.success && res.data) {
				setView(res.data);
				const { displayKey, savedKey } = resolveApiKeyFields(res.data.apiKey);
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
				setBaseUrl(providerDefaults.baseUrl);
				setModelName(providerDefaults.modelName);
				setSavedApiKey('');
				setApiKey('');
				setShowApiKey(false);
				Toast({
					type: 'success',
					title: t('setting.llm.clearSuccess'),
				});
			}
		} finally {
			setSaving(false);
		}
	};

	const onSaveVector = async () => {
		setVectorSaving(true);
		try {
			const trimmedKey = vectorApiKey.trim();
			const keyUnchanged = trimmedKey === savedVectorApiKey.trim();
			const res = await updateLlmVectorSettings({
				enabled: true,
				baseUrl: vectorBaseUrl.trim(),
				rerankUrl: vectorRerankUrl.trim(),
				embeddingModel: vectorEmbeddingModel.trim(),
				rerankModel: vectorRerankModel.trim(),
				collectionName: vectorCollectionName.trim(),
				...(isSuperAdmin ? { bgeOnly: vectorBgeOnly } : {}),
				...(!keyUnchanged && trimmedKey ? { apiKey: trimmedKey } : {}),
			});
			if (res.success && res.data) {
				setView(res.data);
				const vectorKey = resolveApiKeyFields(res.data.vectorApiKey);
				setSavedVectorApiKey(vectorKey.savedKey);
				setVectorApiKey(vectorKey.displayKey);
				setShowVectorApiKey(false);
				setVectorBgeOnly(Boolean(res.data.vectorBgeOnly));
				Toast({
					type: 'success',
					title: t('setting.llm.vectorSaveSuccess'),
				});
			}
		} finally {
			setVectorSaving(false);
		}
	};

	const onClearVector = async () => {
		setVectorSaving(true);
		try {
			const res = await clearLlmVectorSettings();
			if (res.success && res.data) {
				setView(res.data);
				setVectorBaseUrl(vectorDefaults.baseUrl);
				setVectorRerankUrl(vectorDefaults.rerankUrl);
				setVectorEmbeddingModel(vectorDefaults.embeddingModel);
				setVectorRerankModel(vectorDefaults.rerankModel);
				setVectorCollectionName(vectorDefaults.collectionName);
				setSavedVectorApiKey('');
				setVectorApiKey('');
				setShowVectorApiKey(false);
				setVectorBgeOnly(false);
				Toast({
					type: 'success',
					title: t('setting.llm.vectorClearSuccess'),
				});
			}
		} finally {
			setVectorSaving(false);
		}
	};

	return (
		<div className="m-2 mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-start py-4">
			<div className="w-full">
				<div className="w-full border-b border-theme/20 pb-4.5">
					<div className="text-md font-bold">{t('setting.llm.title')}</div>
					<div className="my-2 px-8.5 text-xs text-textcolor/55">
						{t('setting.llm.desc')}
					</div>
				</div>

				{loading ? (
					<p className="mt-3.5 px-8.5 text-sm text-textcolor/70">
						{t('common.loading')}
					</p>
				) : (
					<>
						<div className="my-3.5 w-full border-b border-theme/20 pb-4.5">
							<div className="text-md font-bold">
								{t('setting.llm.connectionTitle')}
							</div>
							<div className="my-2 px-8.5 text-xs text-textcolor/55">
								{t('setting.llm.connectionDesc')}
							</div>

							<div className="mt-3.5 flex flex-col gap-4 px-8.5 text-sm">
								<div className={LLM_FORM_ROW_CLASS}>
									<Label htmlFor="llm-base-url" className={llmFormLabelClass}>
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
											disabled={saving}
											inputClassName={fieldInputClass}
										/>
									</div>
								</div>

								<div className={LLM_FORM_ROW_CLASS}>
									<Label htmlFor="llm-model" className={llmFormLabelClass}>
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
											disabled={saving}
											inputClassName={fieldInputClass}
										/>
									</div>
								</div>

								<div className={LLM_FORM_ROW_CLASS}>
									<Label htmlFor="llm-api-key" className={llmFormLabelClass}>
										{t('setting.llm.apiKey')}
									</Label>
									<div className="relative min-w-0 flex-1">
										<Input
											id="llm-api-key"
											type={showApiKey ? 'text' : 'password'}
											value={apiKey}
											onChange={(e) => setApiKey(e.target.value)}
											placeholder={t('setting.llm.apiKeyPlaceholder')}
											disabled={saving}
											autoComplete="new-password"
											className={cn(fieldInputClass, 'pr-10')}
										/>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="absolute top-1/2 right-1.5 size-6 -translate-y-1/2 text-textcolor/55 hover:text-textcolor"
											disabled={saving || !apiKey}
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
							</div>
						</div>

						<div className="mt-3.5 w-full pb-4.5">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<p className="min-w-0 flex-1 text-sm">
									<span
										className={cn(
											footerHint.tone === 'active' && 'text-teal-500',
											footerHint.tone === 'pending' &&
												'text-amber-600 dark:text-amber-400',
											footerHint.tone === 'default' && 'text-textcolor/60',
										)}
									>
										{footerHint.message}
									</span>
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
										disabled={saving || !canSubmitSave}
										onClick={() => void onSave()}
									>
										{saving ? <Spinner className="size-4" /> : null}
										{t('setting.llm.save')}
									</Button>
								</div>
							</div>
						</div>

						{showVectorSection ? (
							<>
								<div className="my-3.5 w-full border-b border-theme/20 pb-4.5">
									<div className="text-md font-bold">
										{t('setting.llm.vectorTitle')}
									</div>
									<div className="my-2 px-8.5 text-xs text-textcolor/55">
										{t('setting.llm.vectorDesc')}
									</div>

									{isSuperAdmin ? (
										<div className="mx-8.5 mb-3 mt-4 flex items-start justify-between gap-4 rounded-md border border-theme/15 bg-theme/5 px-3 py-2.5">
											<div className="min-w-0">
												<Label
													htmlFor="vector-bge-only"
													className="text-sm font-medium text-textcolor/85"
												>
													{t('setting.llm.vectorBgeOnlyLabel')}
												</Label>
												<p className="mt-1 text-xs text-textcolor/55">
													{t('setting.llm.vectorBgeOnlyDesc')}
												</p>
											</div>
											<Switch
												id="vector-bge-only"
												checked={vectorBgeOnly}
												onCheckedChange={(checked) => {
													setVectorBgeOnly(checked);
													if (checked) {
														const bgeTier = resolveVectorTierByEmbedding(
															FALLBACK_VECTOR_DEFAULTS.embeddingModel,
														);
														if (bgeTier) {
															setVectorEmbeddingModel(bgeTier.embeddingModel);
															setVectorRerankModel(bgeTier.rerankModel);
															setVectorCollectionName(bgeTier.collectionName);
														}
													}
												}}
												disabled={saving || vectorSaving}
											/>
										</div>
									) : null}

									<div className="mt-3.5 flex flex-col gap-4 px-8.5 text-sm">
										<div className={LLM_FORM_ROW_CLASS}>
											<Label
												htmlFor="vector-base-url"
												className={llmFormLabelClass}
											>
												{t('setting.llm.vectorEmbeddingUrl')}
											</Label>
											<div className="min-w-0 flex-1">
												<CreatableCombobox
													id="vector-base-url"
													value={vectorBaseUrl}
													onChange={(next) => {
														if (next.trim() === vectorBaseUrl.trim()) return;
														setVectorBaseUrl(next);
													}}
													options={vectorBaseUrlOptions}
													placeholder={t(
														'setting.llm.vectorEmbeddingUrlPlaceholder',
													)}
													presetsAriaLabel={t('setting.llm.openPresets')}
													disabled={saving || vectorSaving}
													inputClassName={fieldInputClass}
												/>
											</div>
										</div>

										<div className={LLM_FORM_ROW_CLASS}>
											<Label
												htmlFor="vector-rerank-url"
												className={llmFormLabelClass}
											>
												{t('setting.llm.vectorRerankUrl')}
											</Label>
											<div className="min-w-0 flex-1">
												<CreatableCombobox
													id="vector-rerank-url"
													value={vectorRerankUrl}
													onChange={(next) => {
														if (next.trim() === vectorRerankUrl.trim()) return;
														setVectorRerankUrl(next);
													}}
													options={vectorRerankUrlOptions}
													placeholder={t(
														'setting.llm.vectorRerankUrlPlaceholder',
													)}
													presetsAriaLabel={t('setting.llm.openPresets')}
													disabled={saving || vectorSaving}
													inputClassName={fieldInputClass}
												/>
											</div>
										</div>

										<div className={LLM_FORM_ROW_CLASS}>
											<Label
												htmlFor="vector-embedding-model"
												className={llmFormLabelClass}
											>
												{t('setting.llm.vectorEmbeddingModel')}
											</Label>
											<div className="min-w-0 flex-1">
												<CreatableCombobox
													id="vector-embedding-model"
													value={vectorEmbeddingModel}
													onChange={onVectorEmbeddingModelChange}
													options={vectorEmbeddingModelOptions}
													placeholder={t(
														'setting.llm.vectorEmbeddingModelPlaceholder',
													)}
													presetsAriaLabel={t('setting.llm.openPresets')}
													disabled={saving || vectorSaving || vectorBgeOnly}
													inputClassName={fieldInputClass}
												/>
											</div>
										</div>

										<div className={LLM_FORM_ROW_CLASS}>
											<Label
												htmlFor="vector-rerank-model"
												className={llmFormLabelClass}
											>
												{t('setting.llm.vectorRerankModel')}
											</Label>
											<div className="min-w-0 flex-1">
												<CreatableCombobox
													id="vector-rerank-model"
													value={vectorRerankModel}
													onChange={onVectorRerankModelChange}
													options={vectorRerankModelOptions}
													placeholder={t(
														'setting.llm.vectorRerankModelPlaceholder',
													)}
													presetsAriaLabel={t('setting.llm.openPresets')}
													disabled={saving || vectorSaving || vectorBgeOnly}
													inputClassName={fieldInputClass}
												/>
											</div>
										</div>

										<div className={LLM_FORM_ROW_CLASS}>
											<Label
												htmlFor="vector-collection"
												className={llmFormLabelClass}
											>
												{t('setting.llm.vectorCollectionName')}
											</Label>
											<div className="min-w-0 flex-1">
												<CreatableCombobox
													id="vector-collection"
													value={vectorCollectionName}
													onChange={onVectorCollectionNameChange}
													options={vectorCollectionOptions}
													placeholder={t(
														'setting.llm.vectorCollectionNamePlaceholder',
													)}
													presetsAriaLabel={t('setting.llm.openPresets')}
													disabled={saving || vectorSaving || vectorBgeOnly}
													inputClassName={fieldInputClass}
												/>
											</div>
										</div>

										<div className={LLM_FORM_ROW_CLASS}>
											<Label
												htmlFor="vector-api-key"
												className={llmFormLabelClass}
											>
												{t('setting.llm.vectorApiKey')}
											</Label>
											<div className="relative min-w-0 flex-1">
												<Input
													id="vector-api-key"
													type={showVectorApiKey ? 'text' : 'password'}
													value={vectorApiKey}
													onChange={(e) => setVectorApiKey(e.target.value)}
													placeholder={t('setting.llm.apiKeyPlaceholder')}
													disabled={saving || vectorSaving}
													autoComplete="new-password"
													className={cn(fieldInputClass, 'pr-10')}
												/>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="absolute top-1/2 right-1.5 size-6 -translate-y-1/2 text-textcolor/55 hover:text-textcolor"
													disabled={vectorSaving || saving || !vectorApiKey}
													aria-label={
														showVectorApiKey
															? t('setting.llm.hideApiKey')
															: t('setting.llm.showApiKey')
													}
													onClick={() => setShowVectorApiKey((v) => !v)}
												>
													{showVectorApiKey ? (
														<EyeOff className="size-4" aria-hidden />
													) : (
														<Eye className="size-4" aria-hidden />
													)}
												</Button>
											</div>
										</div>

										{!vectorBgeOnly &&
											view?.vectorSearchProfiles &&
											view.vectorSearchProfiles.length > 0 && (
												<div className="rounded-md border border-theme/15 bg-theme/5 px-3 py-2.5">
													<div className="text-sm font-medium text-textcolor/80">
														{t('setting.llm.vectorSearchProfilesTitle')}
													</div>
													<p className="mt-2 text-xs text-textcolor/55">
														{t('setting.llm.vectorSearchProfilesDesc')}
													</p>
													<div className="mt-2 space-y-1.5 text-xs text-textcolor/75">
														{view.vectorSearchProfiles.map((p) => (
															<div
																key={p.collectionName}
																className="font-mono leading-relaxed"
															>
																<span className="text-textcolor/90">
																	{p.collectionName}
																</span>
																<span className="text-textcolor/50">
																	{' '}
																	· {p.embeddingModel}
																</span>
															</div>
														))}
													</div>
												</div>
											)}
									</div>
								</div>

								<div className="mt-3.5 w-full pb-4.5">
									<div className="flex flex-wrap items-center justify-between gap-3">
										<p className="min-w-0 flex-1 text-sm">
											<span
												className={cn(
													vectorFooterHint.tone === 'active' && 'text-teal-500',
													vectorFooterHint.tone === 'pending' &&
														'text-amber-600 dark:text-amber-400',
													vectorFooterHint.tone === 'default' &&
														'text-textcolor/60',
												)}
											>
												{vectorFooterHint.message}
											</span>
										</p>
										<div className="flex shrink-0 flex-wrap items-center">
											<Button
												size="sm"
												variant="outline"
												className={cn(
													'min-w-24 cursor-pointer border border-theme/20',
													vectorSaving && 'disabled:opacity-100',
												)}
												disabled={saving || vectorSaving}
												onClick={() => void onClearVector()}
											>
												{t('setting.llm.vectorClear')}
											</Button>
											<Button
												size="sm"
												className={cn(
													'ml-3 min-w-24 cursor-pointer',
													vectorSaving && 'disabled:opacity-100',
												)}
												disabled={
													saving || vectorSaving || !canSubmitVectorSave
												}
												onClick={() => void onSaveVector()}
											>
												{vectorSaving ? <Spinner className="size-4" /> : null}
												{t('setting.llm.vectorSave')}
											</Button>
										</div>
									</div>
								</div>
							</>
						) : null}
					</>
				)}
			</div>
		</div>
	);
});

export default LlmSetting;
