import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { UpsertPluginEnabledPrefsDto } from './dto/upsert-plugin-enabled-prefs.dto';
import { PluginUserPrefs } from './plugin-user-prefs.entity';

export type PluginEnabledPrefsView = {
	enabledIds: string[];
};

@Injectable()
export class PluginPrefsService {
	constructor(
		@InjectRepository(PluginUserPrefs)
		private readonly repo: Repository<PluginUserPrefs>,
	) {}

	private assertUserId(userId?: number): number {
		if (userId == null || !Number.isFinite(userId) || userId <= 0) {
			throw new UnauthorizedException('请先登录后再试');
		}
		return userId;
	}

	private normalizeIds(raw: unknown): string[] {
		if (!Array.isArray(raw)) return [];
		const seen = new Set<string>();
		const out: string[] = [];
		for (const item of raw) {
			if (typeof item !== 'string') continue;
			const id = item.trim().slice(0, 64);
			if (!id || seen.has(id)) continue;
			seen.add(id);
			out.push(id);
		}
		return out;
	}

	async getView(userId?: number): Promise<PluginEnabledPrefsView> {
		const id = this.assertUserId(userId);
		const row = await this.repo.findOne({ where: { userId: id } });
		return { enabledIds: this.normalizeIds(row?.enabledIds) };
	}

	async upsert(
		dto: UpsertPluginEnabledPrefsDto,
		userId?: number,
	): Promise<PluginEnabledPrefsView> {
		const id = this.assertUserId(userId);
		const enabledIds = this.normalizeIds(dto.enabledIds);
		let row = await this.repo.findOne({ where: { userId: id } });
		if (!row) {
			row = this.repo.create({ userId: id, enabledIds });
		} else {
			row.enabledIds = enabledIds;
		}
		await this.repo.save(row);
		return { enabledIds };
	}
}
