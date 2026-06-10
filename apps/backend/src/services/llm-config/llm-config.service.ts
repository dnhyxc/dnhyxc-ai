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
	memberSiliconFlowResolvePresetsForPreset,
	resolveSiliconFlowCredentials as resolveEnvSiliconFlowCredentials,
	type SiliconFlowCredentials,
	type SiliconFlowLlmPreset,
	siliconFlowResolvePresetsForPreset,
} from '../../utils/create-llm';
import { UserService } from '../user/user.service';
import type { UpsertLlmConfigDto } from './dto/upsert-llm-config.dto';
import { decryptApiKey, encryptApiKey, maskApiKey } from './llm-config-crypto';
import { LlmRuntimeConfig } from './llm-runtime-config.entity';
import {
	getLlmRuntimeSnapshot,
	hasLlmRuntimeSnapshot,
	type LlmRuntimeSnapshot,
	setLlmRuntimeSnapshot,
} from './llm-runtime-snapshot.store';

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

	private isSnapshotActive(
		s: LlmRuntimeSnapshot | null,
	): s is LlmRuntimeSnapshot {
		if (!s?.enabled) return false;
		return !!s.apiKey.trim() && !!s.baseUrl.trim() && !!s.modelName.trim();
	}

	private rowToSnapshot(row: LlmRuntimeConfig): LlmRuntimeSnapshot | null {
		let apiKey = '';
		if (row.apiKeyEnc) {
			try {
				apiKey = decryptApiKey(row.apiKeyEnc, this.encryptionSecret());
			} catch {
				apiKey = '';
			}
		}
		return {
			enabled: Boolean(row.enabled),
			apiKey,
			baseUrl: this.normalizeBaseUrl(row.baseUrl || ''),
			modelName: row.modelName?.trim() || '',
		};
	}

	private commitUserSnapshot(
		userId: number,
		snap: LlmRuntimeSnapshot | null,
	): void {
		const active = this.isSnapshotActive(snap) ? snap : null;
		setLlmRuntimeSnapshot(userId, active);
	}

	private async loadActiveSnapshotFromDb(
		userId: number,
	): Promise<LlmRuntimeSnapshot | null> {
		const row = await this.repo.findOne({ where: { userId } });
		if (!row) {
			this.commitUserSnapshot(userId, null);
			return null;
		}
		const snap = this.rowToSnapshot(row);
		const active = this.isSnapshotActive(snap) ? snap : null;
		this.commitUserSnapshot(userId, active);
		return active;
	}

	private async getActiveSnapshotForUser(
		userId?: number,
	): Promise<LlmRuntimeSnapshot | null> {
		if (userId == null || !Number.isFinite(userId) || userId <= 0) {
			return null;
		}
		if (hasLlmRuntimeSnapshot(userId)) {
			return getLlmRuntimeSnapshot(userId) ?? null;
		}
		return this.loadActiveSnapshotFromDb(userId);
	}

	/** 供 createLlm 使用：用户自定义配置 > 有效会员 SILICONFLOW_* > 非会员 GLM_* */
	async resolveSiliconFlowCredentials(
		config: ConfigService,
		preset: SiliconFlowLlmPreset,
		userId?: number,
	): Promise<SiliconFlowCredentials> {
		const snapshot = await this.getActiveSnapshotForUser(userId);
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

	async getPublicView(userId?: number): Promise<LlmConfigPublicView> {
		const uid = this.assertUserId(userId);
		const row = await this.repo.findOne({ where: { userId: uid } });
		if (!row) {
			return {
				enabled: false,
				baseUrl: '',
				modelName: '',
				apiKeyConfigured: false,
				apiKey: '',
				apiKeyMask: null,
				active: false,
			};
		}
		const snap = this.rowToSnapshot(row);
		const configured = !!row.apiKeyEnc && !!snap?.apiKey.trim();
		const active = this.isSnapshotActive(snap);
		return {
			enabled: row.enabled,
			baseUrl: row.baseUrl?.trim() || '',
			modelName: row.modelName?.trim() || '',
			apiKeyConfigured: configured,
			apiKey: configured && snap ? snap.apiKey : '',
			apiKeyMask: configured && snap ? maskApiKey(snap.apiKey) : null,
			active,
		};
	}

	private assertValidBaseUrl(baseUrl: string): string {
		const trimmed = baseUrl.trim();
		let parsed: URL;
		try {
			parsed = new URL(trimmed);
		} catch {
			throw new BadRequestException('Base URL 格式无效，需为 http(s) 地址');
		}
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			throw new BadRequestException('Base URL 仅支持 http 或 https');
		}
		return this.normalizeBaseUrl(trimmed);
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
				this.commitUserSnapshot(uid, this.rowToSnapshot(row));
			} else {
				this.commitUserSnapshot(uid, null);
			}
			return this.getPublicView(uid);
		}

		if (!row) {
			row = this.repo.create({
				userId: uid,
				enabled: false,
				baseUrl: '',
				modelName: '',
				apiKeyEnc: null,
			});
		}

		const baseUrl = this.assertValidBaseUrl(dto.baseUrl ?? '');
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
		this.commitUserSnapshot(uid, this.rowToSnapshot(row));
		return this.getPublicView(uid);
	}

	/** 清空当前用户的自定义配置，恢复仅使用环境变量 */
	async clear(userId?: number): Promise<LlmConfigPublicView> {
		const uid = this.assertUserId(userId);
		const row = await this.repo.findOne({ where: { userId: uid } });
		if (row) {
			await this.repo.remove(row);
		}
		this.commitUserSnapshot(uid, null);
		return this.getPublicView(uid);
	}

	getDefaultBaseUrlHint(): string {
		return DEFAULT_GLM_BASE_URL;
	}
}
