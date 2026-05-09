import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnglishLearningController } from './english-learning.controller';
import { EnglishLearningService } from './english-learning.service';
import { EnglishVocabularyPackBatch } from './english-vocabulary.entity';

@Module({
	imports: [TypeOrmModule.forFeature([EnglishVocabularyPackBatch])],
	controllers: [EnglishLearningController],
	providers: [EnglishLearningService],
	exports: [EnglishLearningService],
})
export class EnglishLearningModule {}
