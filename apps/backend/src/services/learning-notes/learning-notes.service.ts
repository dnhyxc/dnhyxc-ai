import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { QueryLearningNoteDto } from './dto/query-learning-note.dto';
import { SaveLearningNoteDto } from './dto/save-learning-note.dto';
import { UpdateLearningNoteDto } from './dto/update-learning-note.dto';
import { EnglishLearningNote } from './english-learning-note.entity';

export type LearningNoteListItem = Pick<
	EnglishLearningNote,
	'id' | 'title' | 'userId' | 'createdAt' | 'updatedAt'
>;

@Injectable()
export class LearningNotesService {
	constructor(
		@InjectRepository(EnglishLearningNote)
		private readonly noteRepo: Repository<EnglishLearningNote>,
	) {}

	async save(
		userId: number,
		dto: SaveLearningNoteDto,
	): Promise<{ id: string }> {
		const row = this.noteRepo.create({
			userId,
			title: dto.title?.trim() ? dto.title.trim() : null,
			content: dto.content ?? '',
		});
		const saved = await this.noteRepo.save(row);
		return { id: saved.id };
	}

	async update(
		userId: number,
		dto: UpdateLearningNoteDto,
	): Promise<EnglishLearningNote> {
		if (dto.title === undefined && dto.content === undefined) {
			throw new BadRequestException('请至少提供一项要更新的字段');
		}
		const row = await this.requireOwned(userId, dto.id);
		if (dto.title !== undefined) row.title = dto.title.trim() || null;
		if (dto.content !== undefined) row.content = dto.content;
		return this.noteRepo.save(row);
	}

	async remove(userId: number, id: string): Promise<void> {
		const row = await this.requireOwned(userId, id);
		await this.noteRepo.delete({ id: row.id, userId });
	}

	async findOne(userId: number, id: string): Promise<EnglishLearningNote> {
		return this.requireOwned(userId, id);
	}

	async findPage(
		userId: number,
		query: QueryLearningNoteDto,
	): Promise<{ list: LearningNoteListItem[]; total: number }> {
		const pageNo = query.pageNo ?? 1;
		const pageSize = query.pageSize ?? 20;
		const take = Math.min(pageSize, 100);
		const skip = (pageNo - 1) * take;
		const title = query.title?.trim();

		const where: Record<string, unknown> = { userId };
		if (title) where.title = Like(`%${title}%`);

		const [list, total] = await this.noteRepo.findAndCount({
			select: {
				id: true,
				title: true,
				userId: true,
				createdAt: true,
				updatedAt: true,
			},
			where,
			order: { updatedAt: 'DESC' },
			take,
			skip,
		});

		return { list, total };
	}

	private async requireOwned(
		userId: number,
		id: string,
	): Promise<EnglishLearningNote> {
		const row = await this.noteRepo.findOne({ where: { id, userId } });
		if (!row) throw new NotFoundException('笔记不存在');
		return row;
	}
}
