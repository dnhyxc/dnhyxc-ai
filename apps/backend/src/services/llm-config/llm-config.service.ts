import {
	BadRequestException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigEnum } from '../../enum/config.enum';
import {
	DEFAULT_GLM_BASE_URL,
	DEFAULT_KNOWLEDGE_EMBEDDING_MODEL,
	DEFAULT_KNOWLEDGE_RERANK_MODEL,
	DEFAULT_SILICONFLOW_EMBEDDING_URL,
	DEFAULT_SILICONFLOW_RERANK_URL,
	type KnowledgeVectorApiConfig,
	memberSiliconFlowResolvePresetsForPreset,
	resolveSiliconFlowCredentials as resolveEnvSiliconFlowCredentials,
	type SiliconFlowCredentials,
	type SiliconFlowLlmPreset,
	siliconFlowResolvePresetsForPreset,
} from '../../utils/create-llm';
import { UserService } from '../user/user.service';
import type { UpsertLlmConfigDto } from './dto/upsert-llm-config.dto';
import type { UpsertLlmVectorConfigDto } from './dto/upsert-llm-vector-config.dto';
import { decryptApiKey, encryptApiKey, maskApiKey } from './llm-config-crypto';
import { LlmRuntimeConfig } from './llm-runtime-config.entity';
import {
	getLlmRuntimeSnapshot,
	getVectorRuntimeSnapshot,
	hasLlmRuntimeSnapshot,
	hasVectorRuntimeSnapshot,
	type LlmRuntimeSnapshot,
	setLlmRuntimeSnapshot,
	setVectorRuntimeSnapshot,
	type VectorRuntimeSnapshot,
} from './llm-runtime-snapshot.store';
import {
	buildVectorSearchProfile,
	mergeVectorSearchProfile,
	parseVectorSearchProfilesJson,
	type VectorSearchProfile,
} from './llm-vector-profile';

export type LlmConfigPublicView = {
	enabled: boolean;
	baseUrl: string;
	modelName: string;
	apiKeyConfigured: boolean;
	/** 已保存的完整 API Key（仅登录用户设置页回显；传输需 HTTPS） */
	apiKey: string;
	apiKeyMask: string | null;
	/** 当前是否会对 createLlm 生效（enabled 且三字段 + 密钥齐全） */
	active: boolean;
	vectorEnabled: boolean;
	vectorBaseUrl: string;
	vectorRerankUrl: string;
	vectorEmbeddingModel: string;
	vectorRerankModel: string;
	vectorCollectionName: string;
	vectorSearchProfiles: VectorSearchProfile[];
	vectorApiKeyConfigured: boolean;
	vectorApiKey: string;
	vectorApiKeyMask: string | null;
	/** 当前是否会对知识库向量链路生效 */
	vectorActive: boolean;
	/** 超级管理员「仅 BGE 向量库」开关（当前用户存库值） */
	vectorBgeOnly: boolean;
	/** 站点级：任一超级管理员已开启仅 BGE 时为 true（用于隐藏普通用户向量设置） */
	vectorBgeOnlyGlobal: boolean;
};

@Injectable()
export class LlmConfigService {
	constructor(
		@InjectRepository(LlmRuntimeConfig)
		private readonly repo: Repository<LlmRuntimeConfig>,
		private readonly configService: ConfigService,
		private readonly userService: UserService,
	) {}

	private assertUserId(userId?: number): number {
		if (userId == null || !Number.isFinite(userId) || userId <= 0) {
			throw new UnauthorizedException('请先登录后再试');
		}
		return userId;
	}

	private encryptionSecret(): string {
		return (
			this.configService.get<string>('LLM_CONFIG_ENCRYPTION_KEY')?.trim() ||
			this.configService.get<string>(ConfigEnum.SECRET)?.trim() ||
			'llm-config-dev-only'
		);
	}

	private normalizeBaseUrl(url: string): string {
		return url.trim().replace(/\/$/, '');
	}

	private getDefaultKnowledgeCollectionName(): string {
		return (
			this.configService.get<string>('QDRANT_KNOWLEDGE_COLLECTION')?.trim() ||
			'knowledge_chunks_v2'
		);
	}

	private decryptStoredKey(enc: string | null | undefined): string {
		if (!enc) return '';
		try {
			return decryptApiKey(enc, this.encryptionSecret());
		} catch {
			return '';
		}
	}

	private isChatSnapshotActive(
		s: LlmRuntimeSnapshot | null,
	): s is LlmRuntimeSnapshot {
		if (!s?.enabled) return false;
		return !!s.apiKey.trim() && !!s.baseUrl.trim() && !!s.modelName.trim();
	}

	private isVectorSnapshotActive(
		s: VectorRuntimeSnapshot | null,
	): s is VectorRuntimeSnapshot {
		if (!s?.enabled) return false;
		return (
			!!s.apiKey.trim() &&
			!!s.baseUrl.trim() &&
			!!s.rerankBaseUrl.trim() &&
			!!s.embeddingModel.trim() &&
			!!s.rerankModel.trim() &&
			!!s.collectionName.trim() &&
			s.searchProfiles.length > 0
		);
	}

	private parseProfilesFromRow(row: LlmRuntimeConfig): VectorSearchProfile[] {
		const fallback = buildVectorSearchProfile({
			collectionName: row.vectorCollectionName ?? '',
			embeddingModel: row.vectorEmbeddingModel ?? '',
			rerankModel: row.vectorRerankModel ?? '',
		});
		const raw =
			row.vectorSearchProfiles != null
				? JSON.stringify(row.vectorSearchProfiles)
				: null;
		return parseVectorSearchProfilesJson(raw, fallback);
	}

	private rowToChatSnapshot(row: LlmRuntimeConfig): LlmRuntimeSnapshot | null {
		const apiKey = this.decryptStoredKey(row.apiKeyEnc);
		return {
			enabled: Boolean(row.enabled),
			apiKey,
			baseUrl: this.normalizeBaseUrl(row.baseUrl || ''),
			modelName: row.modelName?.trim() || '',
		};
	}

	private rowToVectorSnapshot(
		row: LlmRuntimeConfig,
	): VectorRuntimeSnapshot | null {
		const apiKey = this.decryptStoredKey(row.vectorApiKeyEnc);
		const searchProfiles = this.parseProfilesFromRow(row);
		return {
			enabled: Boolean(row.vectorEnabled),
			apiKey,
			baseUrl: this.normalizeBaseUrl(row.vectorBaseUrl || ''),
			rerankBaseUrl: this.normalizeBaseUrl(row.vectorRerankUrl || ''),
			embeddingModel: row.vectorEmbeddingModel?.trim() || '',
			rerankModel: row.vectorRerankModel?.trim() || '',
			collectionName: row.vectorCollectionName?.trim() || '',
			searchProfiles,
		};
	}

	private commitChatSnapshot(
		userId: number,
		snap: LlmRuntimeSnapshot | null,
	): void {
		const active = this.isChatSnapshotActive(snap) ? snap : null;
		setLlmRuntimeSnapshot(userId, active);
	}

	private commitVectorSnapshot(
		userId: number,
		snap: VectorRuntimeSnapshot | null,
	): void {
		const active = this.isVectorSnapshotActive(snap) ? snap : null;
		setVectorRuntimeSnapshot(userId, active);
	}

	private async loadChatSnapshotFromDb(
		userId: number,
	): Promise<LlmRuntimeSnapshot | null> {
		const row = await this.repo.findOne({ where: { userId } });
		if (!row) {
			this.commitChatSnapshot(userId, null);
			return null;
		}
		const snap = this.rowToChatSnapshot(row);
		const active = this.isChatSnapshotActive(snap) ? snap : null;
		this.commitChatSnapshot(userId, active);
		return active;
	}

	private async loadVectorSnapshotFromDb(
		userId: number,
	): Promise<VectorRuntimeSnapshot | null> {
		const row = await this.repo.findOne({ where: { userId } });
		if (!row) {
			this.commitVectorSnapshot(userId, null);
			return null;
		}
		const snap = this.rowToVectorSnapshot(row);
		const active = this.isVectorSnapshotActive(snap) ? snap : null;
		this.commitVectorSnapshot(userId, active);
		return active;
	}

	private async getActiveChatSnapshotForUser(
		userId?: number,
	): Promise<LlmRuntimeSnapshot | null> {
		if (userId == null || !Number.isFinite(userId) || userId <= 0) {
			return null;
		}
		if (hasLlmRuntimeSnapshot(userId)) {
			return getLlmRuntimeSnapshot(userId) ?? null;
		}
		return this.loadChatSnapshotFromDb(userId);
	}

	async getActiveVectorSnapshotForUser(
		userId?: number | null,
	): Promise<VectorRuntimeSnapshot | null> {
		if (userId == null || !Number.isFinite(userId) || userId <= 0) {
			return null;
		}
		if (hasVectorRuntimeSnapshot(userId)) {
			return getVectorRuntimeSnapshot(userId) ?? null;
		}
		return this.loadVectorSnapshotFromDb(userId);
	}

	/** 站点级：超级管理员已开启「仅 BGE 向量库」时，全员走向量 BGE 单库 */
	async isGlobalVectorBgeOnlyEnabled(): Promise<boolean> {
		const rows = await this.repo.find({
			where: { vectorBgeOnly: true },
			select: { userId: true },
		});
		for (const row of rows) {
			if (await this.userService.userHasSuperAdminRole(row.userId)) {
				return true;
			}
		}
		return false;
	}

	/** 开启全站仅 BGE 的超级管理员向量快照（全员共用其 API Key / URL） */
	private async getGlobalVectorBgeProviderSnapshot(): Promise<VectorRuntimeSnapshot | null> {
		const rows = await this.repo.find({
			where: { vectorBgeOnly: true },
			select: { userId: true },
		});
		for (const row of rows) {
			if (!(await this.userService.userHasSuperAdminRole(row.userId))) {
				continue;
			}
			const snap = await this.getActiveVectorSnapshotForUser(row.userId);
			if (snap) return snap;
		}
		return null;
	}

	/** 知识库向量是否仅走 BGE 单库（全站策略或超级管理员个人开关） */
	async isVectorBgeOnlyActiveForUser(
		userId: number | null | undefined,
	): Promise<boolean> {
		if (await this.isGlobalVectorBgeOnlyEnabled()) {
			return true;
		}
		if (userId == null || !Number.isFinite(userId) || userId <= 0) {
			return false;
		}
		if (!(await this.userService.userHasSuperAdminRole(userId))) {
			return false;
		}
		const row = await this.repo.findOne({ where: { userId } });
		return Boolean(row?.vectorBgeOnly);
	}

	/** 供 createLlm 使用：用户自定义配置 > 有效会员 SILICONFLOW_* > 非会员 GLM_* */
	async resolveSiliconFlowCredentials(
		config: ConfigService,
		preset: SiliconFlowLlmPreset,
		userId?: number,
	): Promise<SiliconFlowCredentials> {
		const snapshot = await this.getActiveChatSnapshotForUser(userId);
		if (snapshot) {
			return {
				apiKey: snapshot.apiKey,
				baseURL: snapshot.baseUrl,
				modelName: snapshot.modelName,
			};
		}
		const isMember = await this.userService.isUserMembershipActive(userId);
		const resolveOptions = isMember
			? memberSiliconFlowResolvePresetsForPreset(preset)(config)
			: siliconFlowResolvePresetsForPreset(preset)(config);
		return resolveEnvSiliconFlowCredentials(config, resolveOptions);
	}

	/**
	 * 供知识库 embedding / rerank 使用：用户向量设置 > 环境变量 + 会员档位
	 * 全站仅 BGE 时统一使用开启该策略的超级管理员向量凭证，忽略文章作者自己的向量配置。
	 */
	async resolveKnowledgeVectorApiConfigForUser(
		userId: number | null | undefined,
		preset: 'embedding' | 'rerank',
	): Promise<KnowledgeVectorApiConfig | null> {
		if (await this.isGlobalVectorBgeOnlyEnabled()) {
			const providerSnap = await this.getGlobalVectorBgeProviderSnapshot();
			if (!providerSnap) return null;
			const baseURL =
				preset === 'embedding'
					? providerSnap.baseUrl
					: providerSnap.rerankBaseUrl;
			const model =
				preset === 'embedding'
					? DEFAULT_KNOWLEDGE_EMBEDDING_MODEL
					: DEFAULT_KNOWLEDGE_RERANK_MODEL;
			return {
				apiKey: providerSnap.apiKey,
				baseURL,
				model,
			};
		}

		const snap = await this.getActiveVectorSnapshotForUser(userId);
		if (!snap) return null;
		const bgeOnly = await this.isVectorBgeOnlyActiveForUser(userId);
		const baseURL = preset === 'embedding' ? snap.baseUrl : snap.rerankBaseUrl;
		const model = bgeOnly
			? preset === 'embedding'
				? DEFAULT_KNOWLEDGE_EMBEDDING_MODEL
				: DEFAULT_KNOWLEDGE_RERANK_MODEL
			: preset === 'embedding'
				? snap.embeddingModel
				: snap.rerankModel;
		return {
			apiKey: snap.apiKey,
			baseURL,
			model,
		};
	}

	async resolveKnowledgeCollectionNamesForUser(
		userId: number | null | undefined,
	): Promise<string[]> {
		if (await this.isVectorBgeOnlyActiveForUser(userId)) {
			return [this.getDefaultKnowledgeCollectionName()];
		}
		const snap = await this.getActiveVectorSnapshotForUser(userId);
		if (!snap) return [];
		const names = snap.searchProfiles
			.map((p) => p.collectionName)
			.filter(Boolean);
		if (names.length > 0) return names;
		return snap.collectionName ? [snap.collectionName] : [];
	}

	async resolveKnowledgeCollectionNameForUser(
		userId: number | null | undefined,
	): Promise<string | null> {
		if (await this.isVectorBgeOnlyActiveForUser(userId)) {
			return this.getDefaultKnowledgeCollectionName();
		}
		const snap = await this.getActiveVectorSnapshotForUser(userId);
		if (snap) return snap.collectionName;
		return null;
	}

	private buildPublicView(row: LlmRuntimeConfig | null): LlmConfigPublicView {
		if (!row) {
			return {
				enabled: false,
				baseUrl: '',
				modelName: '',
				apiKeyConfigured: false,
				apiKey: '',
				apiKeyMask: null,
				active: false,
				vectorEnabled: false,
				vectorBaseUrl: '',
				vectorRerankUrl: '',
				vectorEmbeddingModel: '',
				vectorRerankModel: '',
				vectorCollectionName: '',
				vectorSearchProfiles: [],
				vectorApiKeyConfigured: false,
				vectorApiKey: '',
				vectorApiKeyMask: null,
				vectorActive: false,
				vectorBgeOnly: false,
				vectorBgeOnlyGlobal: false,
			};
		}
		const chatSnap = this.rowToChatSnapshot(row);
		const chatConfigured = !!row.apiKeyEnc && !!chatSnap?.apiKey.trim();
		const chatActive = this.isChatSnapshotActive(chatSnap);

		const vectorSnap = this.rowToVectorSnapshot(row);
		const vectorConfigured =
			!!row.vectorApiKeyEnc && !!vectorSnap?.apiKey.trim();
		const vectorActive = this.isVectorSnapshotActive(vectorSnap);

		return {
			enabled: row.enabled,
			baseUrl: row.baseUrl?.trim() || '',
			modelName: row.modelName?.trim() || '',
			apiKeyConfigured: chatConfigured,
			apiKey: chatConfigured && chatSnap ? chatSnap.apiKey : '',
			apiKeyMask:
				chatConfigured && chatSnap ? maskApiKey(chatSnap.apiKey) : null,
			active: chatActive,
			vectorEnabled: row.vectorEnabled,
			vectorBaseUrl: row.vectorBaseUrl?.trim() || '',
			vectorRerankUrl: row.vectorRerankUrl?.trim() || '',
			vectorEmbeddingModel: row.vectorEmbeddingModel?.trim() || '',
			vectorRerankModel: row.vectorRerankModel?.trim() || '',
			vectorCollectionName: row.vectorCollectionName?.trim() || '',
			vectorSearchProfiles: vectorSnap?.searchProfiles ?? [],
			vectorApiKeyConfigured: vectorConfigured,
			vectorApiKey: vectorConfigured && vectorSnap ? vectorSnap.apiKey : '',
			vectorApiKeyMask:
				vectorConfigured && vectorSnap ? maskApiKey(vectorSnap.apiKey) : null,
			vectorActive,
			vectorBgeOnly: Boolean(row.vectorBgeOnly),
			vectorBgeOnlyGlobal: false,
		};
	}

	async getPublicView(userId?: number): Promise<LlmConfigPublicView> {
		const uid = this.assertUserId(userId);
		const row = await this.repo.findOne({ where: { userId: uid } });
		const vectorBgeOnlyGlobal = await this.isGlobalVectorBgeOnlyEnabled();
		return {
			...this.buildPublicView(row),
			vectorBgeOnlyGlobal,
		};
	}

	private assertValidHttpUrl(url: string, label: string): string {
		const trimmed = url.trim();
		let parsed: URL;
		try {
			parsed = new URL(trimmed);
		} catch {
			throw new BadRequestException(`${label} 格式无效，需为 http(s) 地址`);
		}
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			throw new BadRequestException(`${label} 仅支持 http 或 https`);
		}
		return this.normalizeBaseUrl(trimmed);
	}

	private assertValidCollectionName(name: string): string {
		const trimmed = name.trim();
		if (!trimmed) {
			throw new BadRequestException('请填写向量库名称');
		}
		if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
			throw new BadRequestException(
				'向量库名称仅支持字母、数字、下划线与连字符',
			);
		}
		return trimmed;
	}

	private async ensureRow(userId: number): Promise<LlmRuntimeConfig> {
		let row = await this.repo.findOne({ where: { userId } });
		if (!row) {
			row = this.repo.create({
				userId,
				enabled: false,
				baseUrl: '',
				modelName: '',
				apiKeyEnc: null,
				vectorEnabled: false,
				vectorBaseUrl: '',
				vectorRerankUrl: '',
				vectorEmbeddingModel: '',
				vectorRerankModel: '',
				vectorCollectionName: '',
				vectorApiKeyEnc: null,
				vectorSearchProfiles: null,
			});
		}
		return row;
	}

	async upsert(
		dto: UpsertLlmConfigDto,
		userId?: number,
	): Promise<LlmConfigPublicView> {
		const uid = this.assertUserId(userId);
		let row = await this.repo.findOne({ where: { userId: uid } });

		if (!dto.enabled) {
			if (row) {
				row.enabled = false;
				await this.repo.save(row);
				this.commitChatSnapshot(uid, this.rowToChatSnapshot(row));
			} else {
				this.commitChatSnapshot(uid, null);
			}
			return this.getPublicView(uid);
		}

		row = await this.ensureRow(uid);

		const baseUrl = this.assertValidHttpUrl(dto.baseUrl ?? '', 'Base URL');
		const modelName = (dto.modelName ?? '').trim();
		if (!modelName) {
			throw new BadRequestException('启用自定义配置时请填写模型名称');
		}

		const apiKeyInput = dto.apiKey?.trim() ?? '';
		let apiKeyEnc = row.apiKeyEnc;
		if (apiKeyInput) {
			apiKeyEnc = encryptApiKey(apiKeyInput, this.encryptionSecret());
		} else if (!apiKeyEnc) {
			throw new BadRequestException('请填写 API Key');
		}

		row.enabled = true;
		row.baseUrl = baseUrl;
		row.modelName = modelName;
		row.apiKeyEnc = apiKeyEnc;
		await this.repo.save(row);
		this.commitChatSnapshot(uid, this.rowToChatSnapshot(row));
		return this.getPublicView(uid);
	}

	async upsertVector(
		dto: UpsertLlmVectorConfigDto,
		userId?: number,
	): Promise<LlmConfigPublicView> {
		const uid = this.assertUserId(userId);
		const isSuperAdmin = await this.userService.userHasSuperAdminRole(uid);
		let row = await this.repo.findOne({ where: { userId: uid } });

		if (dto.bgeOnly === true && !isSuperAdmin) {
			throw new BadRequestException('仅超级管理员可设置仅 BGE 向量模式');
		}

		if (!dto.enabled) {
			if (row) {
				row.vectorEnabled = false;
				if (dto.bgeOnly === false) {
					row.vectorBgeOnly = false;
				}
				await this.repo.save(row);
				this.commitVectorSnapshot(uid, this.rowToVectorSnapshot(row));
			} else {
				this.commitVectorSnapshot(uid, null);
			}
			return this.getPublicView(uid);
		}

		row = await this.ensureRow(uid);

		const bgeOnly =
			dto.bgeOnly !== undefined ? dto.bgeOnly : Boolean(row.vectorBgeOnly);
		if (bgeOnly && !isSuperAdmin) {
			throw new BadRequestException('仅超级管理员可启用仅 BGE 向量模式');
		}

		const baseUrl = this.assertValidHttpUrl(
			dto.baseUrl ?? DEFAULT_SILICONFLOW_EMBEDDING_URL,
			'Embedding 接口地址',
		);
		const rerankUrl = this.assertValidHttpUrl(
			dto.rerankUrl ?? DEFAULT_SILICONFLOW_RERANK_URL,
			'Rerank 接口地址',
		);
		let embeddingModel = (dto.embeddingModel ?? '').trim();
		let rerankModel = (dto.rerankModel ?? '').trim();
		let collectionName = this.assertValidCollectionName(
			dto.collectionName ?? '',
		);

		if (bgeOnly) {
			embeddingModel = DEFAULT_KNOWLEDGE_EMBEDDING_MODEL;
			rerankModel = DEFAULT_KNOWLEDGE_RERANK_MODEL;
			collectionName = this.getDefaultKnowledgeCollectionName();
		} else {
			if (!embeddingModel) {
				throw new BadRequestException('请填写向量模型名称');
			}
			if (!rerankModel) {
				throw new BadRequestException('请填写重排模型名称');
			}
		}

		const currentProfile = buildVectorSearchProfile({
			collectionName,
			embeddingModel,
			rerankModel,
		});
		if (!currentProfile) {
			throw new BadRequestException('向量库与模型配置不完整');
		}
		const existingProfiles = this.parseProfilesFromRow(row);
		const mergedProfiles = bgeOnly
			? [currentProfile]
			: mergeVectorSearchProfile(existingProfiles, currentProfile);

		const apiKeyInput = dto.apiKey?.trim() ?? '';
		let vectorApiKeyEnc = row.vectorApiKeyEnc;
		if (apiKeyInput) {
			vectorApiKeyEnc = encryptApiKey(apiKeyInput, this.encryptionSecret());
		} else if (!vectorApiKeyEnc) {
			throw new BadRequestException('请填写 API Key');
		}

		row.vectorEnabled = true;
		row.vectorBgeOnly = bgeOnly;
		row.vectorBaseUrl = baseUrl;
		row.vectorRerankUrl = rerankUrl;
		row.vectorEmbeddingModel = embeddingModel;
		row.vectorRerankModel = rerankModel;
		row.vectorCollectionName = collectionName;
		row.vectorApiKeyEnc = vectorApiKeyEnc;
		row.vectorSearchProfiles = mergedProfiles;
		await this.repo.save(row);
		this.commitVectorSnapshot(uid, this.rowToVectorSnapshot(row));
		return this.getPublicView(uid);
	}

	/** 清空当前用户的大模型自定义配置，恢复仅使用环境变量 */
	async clear(userId?: number): Promise<LlmConfigPublicView> {
		const uid = this.assertUserId(userId);
		const row = await this.repo.findOne({ where: { userId: uid } });
		if (row) {
			const hasVector =
				row.vectorEnabled ||
				row.vectorBaseUrl?.trim() ||
				row.vectorRerankUrl?.trim() ||
				row.vectorEmbeddingModel?.trim() ||
				row.vectorRerankModel?.trim() ||
				row.vectorCollectionName?.trim() ||
				row.vectorApiKeyEnc;
			if (hasVector) {
				row.enabled = false;
				row.baseUrl = '';
				row.modelName = '';
				row.apiKeyEnc = null;
				await this.repo.save(row);
				this.commitChatSnapshot(uid, null);
			} else {
				await this.repo.remove(row);
				this.commitChatSnapshot(uid, null);
			}
		} else {
			this.commitChatSnapshot(uid, null);
		}
		return this.getPublicView(uid);
	}

	/** 清空当前用户的向量模型自定义配置 */
	async clearVector(userId?: number): Promise<LlmConfigPublicView> {
		const uid = this.assertUserId(userId);
		const row = await this.repo.findOne({ where: { userId: uid } });
		if (row) {
			const hasChat =
				row.enabled ||
				row.baseUrl?.trim() ||
				row.modelName?.trim() ||
				row.apiKeyEnc;
			row.vectorEnabled = false;
			row.vectorBaseUrl = '';
			row.vectorRerankUrl = '';
			row.vectorEmbeddingModel = '';
			row.vectorRerankModel = '';
			row.vectorCollectionName = '';
			row.vectorApiKeyEnc = null;
			row.vectorSearchProfiles = null;
			row.vectorBgeOnly = false;
			if (hasChat) {
				await this.repo.save(row);
			} else {
				await this.repo.remove(row);
			}
			this.commitVectorSnapshot(uid, null);
		} else {
			this.commitVectorSnapshot(uid, null);
		}
		return this.getPublicView(uid);
	}

	getDefaultBaseUrlHint(): string {
		return DEFAULT_GLM_BASE_URL;
	}

	getDefaultVectorHints(): {
		baseUrl: string;
		rerankUrl: string;
		embeddingModel: string;
		rerankModel: string;
		collectionName: string;
	} {
		return {
			baseUrl: DEFAULT_SILICONFLOW_EMBEDDING_URL,
			rerankUrl: DEFAULT_SILICONFLOW_RERANK_URL,
			embeddingModel: DEFAULT_KNOWLEDGE_EMBEDDING_MODEL,
			rerankModel: DEFAULT_KNOWLEDGE_RERANK_MODEL,
			collectionName:
				this.configService.get<string>('QDRANT_KNOWLEDGE_COLLECTION')?.trim() ||
				'knowledge_chunks_v2',
		};
	}
}
