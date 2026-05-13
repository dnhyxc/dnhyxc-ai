import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeQaModule } from '../knowledge-qa/knowledge-qa.module';
import { EnglishClassicQuotePackBatch } from './english-classic-quote.entity';
import { EnglishLearningController } from './english-learning.controller';
import { EnglishLearningService } from './english-learning.service';
import { EnglishLearningStreamAbortRegistry } from './english-learning-stream-abort.registry';
import { EnglishPackWebSearchRecord } from './english-pack-web-search.entity';
import { EnglishVocabularyPackBatch } from './english-vocabulary.entity';

@Module({
	imports: [
		KnowledgeQaModule,
		TypeOrmModule.forFeature([
			EnglishVocabularyPackBatch,
			EnglishClassicQuotePackBatch,
			EnglishPackWebSearchRecord,
		]),
	],
	controllers: [EnglishLearningController],
	providers: [EnglishLearningService, EnglishLearningStreamAbortRegistry],
	exports: [EnglishLearningService],
})
export class EnglishLearningModule {}
