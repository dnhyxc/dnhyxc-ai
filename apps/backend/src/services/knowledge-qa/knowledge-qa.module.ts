import { Module } from '@nestjs/common';
import { KnowledgeEmbeddingModule } from '../knowledge-embedding/knowledge-embedding.module';
import { KnowledgeQaController } from './knowledge-qa.controller';
import { KnowledgeQaService } from './knowledge-qa.service';

@Module({
	imports: [KnowledgeEmbeddingModule],
	controllers: [KnowledgeQaController],
	providers: [KnowledgeQaService],
})
export class KnowledgeQaModule {}
