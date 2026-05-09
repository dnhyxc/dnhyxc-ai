import { Module } from '@nestjs/common';
import { EnglishLearningController } from './english-learning.controller';
import { EnglishLearningService } from './english-learning.service';

@Module({
	controllers: [EnglishLearningController],
	providers: [EnglishLearningService],
	exports: [EnglishLearningService],
})
export class EnglishLearningModule {}
