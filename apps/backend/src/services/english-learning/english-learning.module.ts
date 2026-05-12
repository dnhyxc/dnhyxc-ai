import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from '../agent/agent.module';
import { KnowledgeQaModule } from '../knowledge-qa/knowledge-qa.module';
import { EnglishClassicQuotePackBatch } from './english-classic-quote.entity';
import { EnglishLearningController } from './english-learning.controller';
import { EnglishLearningService } from './english-learning.service';
import { EnglishVocabularyPackBatch } from './english-vocabulary.entity';

@Module({
	imports: [
		AgentModule,
		KnowledgeQaModule,
		TypeOrmModule.forFeature([
			EnglishVocabularyPackBatch,
			EnglishClassicQuotePackBatch,
		]),
	],
	controllers: [EnglishLearningController],
	providers: [EnglishLearningService],
	exports: [EnglishLearningService],
})
export class EnglishLearningModule {}
