import { randomUUID } from 'node:crypto';
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AgentSession } from '../agent/agent-session.entity';
import { CreateSkillTrySessionDto } from './dto/create-skill-try-session.dto';
import { SaveSkillDto } from './dto/save-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { Skill } from './skill.entity';
import { SkillTrySession } from './skill-try-session.entity';

export type SkillBody = {
	id: string;
	title: string;
	content: string;
};

const SKILL_CHARS_CAP = 80_000;

@Injectable()
export class SkillService {
	constructor(
		@InjectRepository(Skill)
		private readonly skillRepo: Repository<Skill>,
		@InjectRepository(SkillTrySession)
		private readonly trySessionRepo: Repository<SkillTrySession>,
		@InjectRepository(AgentSession)
		private readonly agentSessionRepo: Repository<AgentSession>,
	) {}

	async create(userId: number, dto: SaveSkillDto): Promise<Skill> {
		const row = this.skillRepo.create({
			title: dto.title.trim(),
			content: dto.content,
			authorId: userId,
		});
		return this.skillRepo.save(row);
	}

	async update(userId: number, dto: UpdateSkillDto): Promise<Skill> {
		const row = await this.findOwned(userId, dto.id);
		if (dto.title != null) row.title = dto.title.trim();
		if (dto.content != null) row.content = dto.content;
		return this.skillRepo.save(row);
	}

	async remove(userId: number, id: string): Promise<void> {
		const row = await this.findOwned(userId, id);
		const tryRows = await this.trySessionRepo.find({
			where: { userId, skillId: id },
			select: ['id'],
		});
		if (tryRows.length) {
			const ids = tryRows.map((r) => r.id);
			await this.trySessionRepo.delete({ id: In(ids), userId });
			await this.agentSessionRepo.delete({ id: In(ids), userId });
		}
		await this.skillRepo.remove(row);
	}

	async listMine(userId: number): Promise<Skill[]> {
		return this.skillRepo.find({
			where: { authorId: userId },
			order: { updatedAt: 'DESC' },
		});
	}

	async findOneMine(userId: number, id: string): Promise<Skill> {
		return this.findOwned(userId, id);
	}

	/**
	 * 按请求顺序返回本人 Skill；丢弃无权/缺失 ID。
	 * 合计正文超长时从尾部截断集合（靠前优先）。
	 */
	async findByIdsForUser(
		ids: string[] | undefined,
		userId: number,
	): Promise<SkillBody[]> {
		if (!ids?.length) return [];
		const unique = [...new Set(ids.filter(Boolean))];
		if (!unique.length) return [];
		const rows = await this.skillRepo.find({
			where: { id: In(unique), authorId: userId },
		});
		const byId = new Map(rows.map((r) => [r.id, r]));
		const ordered: SkillBody[] = [];
		let chars = 0;
		for (const id of ids) {
			const row = byId.get(id);
			if (!row) continue;
			const next = chars + row.content.length;
			if (next > SKILL_CHARS_CAP && ordered.length > 0) break;
			ordered.push({
				id: row.id,
				title: row.title,
				content: row.content,
			});
			chars = next;
		}
		return ordered;
	}

	/** 新建 Skill 侧栏会话：skill_try_sessions + 同 id 的 agent_sessions */
	async createTrySession(userId: number, dto: CreateSkillTrySessionDto) {
		const kind = dto.kind === 'generate' ? 'generate' : 'try';
		const skillId = dto.skillId?.trim() || null;
		if (kind === 'try' && !skillId) {
			throw new BadRequestException('试跑会话必须绑定 skillId');
		}
		if (skillId) await this.findOwned(userId, skillId);
		const id = randomUUID();
		const title = dto.title?.trim() || null;
		const now = new Date();
		await this.agentSessionRepo.save(
			this.agentSessionRepo.create({
				id,
				userId,
				title,
				updatedAt: now,
			}),
		);
		await this.trySessionRepo.save(
			this.trySessionRepo.create({
				id,
				userId,
				kind,
				skillId,
				updatedAt: now,
			}),
		);
		return { sessionId: id, title, skillId, kind };
	}

	/**
	 * 列出 Skill 侧栏历史。
	 * try / generate 均按 skillId；generate 无 skillId → skill_id IS NULL（草稿桶）。
	 */
	async listTrySessions(
		userId: number,
		opts: {
			skillId?: string | null;
			kind?: 'try' | 'generate';
			pageNo?: number;
			pageSize?: number;
		},
	): Promise<{
		skillId: string | null;
		kind: 'try' | 'generate';
		list: Array<{
			sessionId: string;
			title: string | null;
			createdAt: Date;
			updatedAt: Date;
		}>;
		pageNo: number;
		pageSize: number;
		total: number;
	}> {
		const kind = opts.kind === 'generate' ? 'generate' : 'try';
		const sid = opts.skillId?.trim() || null;
		if (kind === 'try' && !sid) {
			throw new BadRequestException('试跑历史须传 skillId');
		}
		if (sid) await this.findOwned(userId, sid);
		const pn = Math.max(1, Math.floor(opts.pageNo ?? 1));
		const ps = Math.min(50, Math.max(1, Math.floor(opts.pageSize ?? 20)));
		const qb = this.agentSessionRepo
			.createQueryBuilder('a')
			.where('a.user_id = :uid', { uid: userId });
		// ponytail: 子查询避免 innerJoin(Entity) 多库 databaseName 崩
		if (sid) {
			qb.andWhere(
				`a.id IN (SELECT t.id FROM skill_try_sessions t WHERE t.user_id = :uid AND t.kind = :kind AND t.skill_id = :sid)`,
				{ kind, sid },
			);
		} else {
			qb.andWhere(
				`a.id IN (SELECT t.id FROM skill_try_sessions t WHERE t.user_id = :uid AND t.kind = :kind AND t.skill_id IS NULL)`,
				{ kind },
			);
		}
		qb.orderBy('a.updated_at', 'DESC')
			.skip((pn - 1) * ps)
			.take(ps);
		const [rows, total] = await qb.getManyAndCount();
		return {
			skillId: sid,
			kind,
			list: rows.map((r) => ({
				sessionId: r.id,
				title: r.title,
				createdAt: r.createdAt,
				updatedAt: r.updatedAt,
			})),
			pageNo: pn,
			pageSize: ps,
			total,
		};
	}

	/** generate 草稿会话绑定到已保存 Skill（仅 skill_id null → id） */
	async bindTrySessionSkill(
		userId: number,
		sessionId: string,
		skillId: string,
	) {
		const sid = sessionId.trim();
		const kid = skillId.trim();
		if (!sid || !kid) throw new BadRequestException('参数无效');
		await this.findOwned(userId, kid);
		const row = await this.trySessionRepo.findOne({ where: { id: sid } });
		if (!row || row.userId !== userId) {
			throw new NotFoundException('会话不存在');
		}
		if (row.kind !== 'generate') {
			throw new BadRequestException('仅生成会话可绑定 Skill');
		}
		if (row.skillId != null) {
			if (row.skillId === kid) return { sessionId: sid, skillId: kid };
			throw new BadRequestException('会话已绑定其它 Skill');
		}
		row.skillId = kid;
		row.updatedAt = new Date();
		await this.trySessionRepo.save(row);
		return { sessionId: sid, skillId: kid };
	}

	private async findOwned(userId: number, id: string): Promise<Skill> {
		const row = await this.skillRepo.findOne({ where: { id } });
		if (!row) throw new NotFoundException('Skill 不存在');
		if (row.authorId !== userId)
			throw new ForbiddenException('无权操作该 Skill');
		return row;
	}
}
