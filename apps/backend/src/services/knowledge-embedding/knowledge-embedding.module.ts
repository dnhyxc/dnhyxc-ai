import { Module } from '@nestjs/common';
import { KnowledgeEmbeddingService } from './knowledge-embedding.service';

@Module({
	providers: [KnowledgeEmbeddingService],
	exports: [KnowledgeEmbeddingService],
})
export class KnowledgeEmbeddingModule {}
