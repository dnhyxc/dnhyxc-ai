import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnglishClassicQuotePackBatch } from './english-classic-quote.entity';
import { EnglishLearningController } from './english-learning.controller';
import { EnglishLearningService } from './english-learning.service';
import { EnglishVocabularyPackBatch } from './english-vocabulary.entity';

@Module({
	imports: [
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
