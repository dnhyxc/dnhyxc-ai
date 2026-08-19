import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeEmbeddingModule } from '../knowledge-embedding/knowledge-embedding.module';
import { KnowledgeController } from './knowledge.controller';
import { Knowledge } from './knowledge.entity';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeCategory } from './knowledge-category.entity';
import { KnowledgeTrash } from './knowledge-trash.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([Knowledge, KnowledgeTrash, KnowledgeCategory]),
		KnowledgeEmbeddingModule,
	],
	controllers: [KnowledgeController],
	providers: [KnowledgeService],
})
export class KnowledgeModule {}
