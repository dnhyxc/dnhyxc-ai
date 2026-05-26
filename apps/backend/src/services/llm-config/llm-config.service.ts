import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigEnum } from '../../enum/config.enum';
import {
	DEFAULT_SILICONFLOW_BASE_URL,
	resolveSiliconFlowCredentials as resolveEnvSiliconFlowCredentials,
	type SiliconFlowCredentials,
	type SiliconFlowLlmPreset,
	siliconFlowResolvePresetsForPreset,
} from '../../utils/create-llm';
import type { UpsertLlmConfigDto } from './dto/upsert-llm-config.dto';
import { decryptApiKey, encryptApiKey, maskApiKey } from './llm-config-crypto';
import { LlmRuntimeConfig } from './llm-runtime-config.entity';
import {
	getLlmRuntimeSnapshot,
	type LlmRuntimeSnapshot,
	setLlmRuntimeSnapshot,
} from './llm-runtime-snapshot.store';

const SINGLETON_ID = 1;

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
export class LlmConfigService implements OnModuleInit {
	constructor(
		@InjectRepository(LlmRuntimeConfig)
		private readonly repo: Repository<LlmRuntimeConfig>,
		private readonly configService: ConfigService,
	) {}

	async onModuleInit(): Promise<void> {
		await this.reloadSnapshot();
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

	private commitSnapshot(snap: LlmRuntimeSnapshot | null): void {
		const active = this.isSnapshotActive(snap) ? snap : null;
		setLlmRuntimeSnapshot(active);
	}

	async reloadSnapshot(): Promise<void> {
		const row = await this.ensureRow();
		const snap = this.rowToSnapshot(row);
		this.commitSnapshot(snap);
	}

	/** 供 createLlm 使用：有完整运行时覆盖则返回，否则走 env preset */
	resolveSiliconFlowCredentials(
		config: ConfigService,
		preset: SiliconFlowLlmPreset,
	): SiliconFlowCredentials {
		const snapshot = getLlmRuntimeSnapshot();
		if (this.isSnapshotActive(snapshot)) {
			return {
				apiKey: snapshot.apiKey,
				baseURL: snapshot.baseUrl,
				modelName: snapshot.modelName,
			};
		}
		return resolveEnvSiliconFlowCredentials(
			config,
			siliconFlowResolvePresetsForPreset(preset)(config),
		);
	}

	async getPublicView(): Promise<LlmConfigPublicView> {
		const row = await this.ensureRow();
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

	private async ensureRow(): Promise<LlmRuntimeConfig> {
		let row = await this.repo.findOne({ where: { id: SINGLETON_ID } });
		if (!row) {
			row = await this.repo.save(
				this.repo.create({
					id: SINGLETON_ID,
					enabled: false,
					baseUrl: '',
					modelName: '',
					apiKeyEnc: null,
				}),
			);
		}
		return row;
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
		const row = await this.ensureRow();

		if (!dto.enabled) {
			row.enabled = false;
			row.updatedBy = userId ?? null;
			await this.repo.save(row);
			await this.reloadSnapshot();
			return this.getPublicView();
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
		row.updatedBy = userId ?? null;
		await this.repo.save(row);
		await this.reloadSnapshot();
		return this.getPublicView();
	}

	/** 清空自定义配置，恢复仅使用环境变量 */
	async clear(userId?: number): Promise<LlmConfigPublicView> {
		const row = await this.ensureRow();
		row.enabled = false;
		row.baseUrl = '';
		row.modelName = '';
		row.apiKeyEnc = null;
		row.updatedBy = userId ?? null;
		await this.repo.save(row);
		await this.reloadSnapshot();
		return this.getPublicView();
	}

	getDefaultBaseUrlHint(): string {
		return DEFAULT_SILICONFLOW_BASE_URL;
	}
}
