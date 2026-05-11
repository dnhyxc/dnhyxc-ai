import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from '../agent/agent.module';
import { EnglishClassicQuotePackBatch } from './english-classic-quote.entity';
import { EnglishLearningAgentOrchestrator } from './english-learning-agent-orchestrator';
import { EnglishLearningAgentTools } from './english-learning-agent-tools';
import { EnglishLearningController } from './english-learning.controller';
import { EnglishLearningService } from './english-learning.service';
import { EnglishVocabularyPackBatch } from './english-vocabulary.entity';

@Module({
	imports: [
		AgentModule,
		TypeOrmModule.forFeature([
			EnglishVocabularyPackBatch,
			EnglishClassicQuotePackBatch,
		]),
	],
	controllers: [EnglishLearningController],
	providers: [
		EnglishLearningService,
		EnglishLearningAgentTools,
		EnglishLearningAgentOrchestrator,
	],
	exports: [
		EnglishLearningService,
		EnglishLearningAgentOrchestrator,
		EnglishLearningAgentTools,
	],
})
export class EnglishLearningModule {}
