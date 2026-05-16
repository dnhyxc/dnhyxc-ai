import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeQaModule } from '../knowledge-qa/knowledge-qa.module';
import { EnglishClassicQuotePackBatch } from './english-classic-quote.entity';
import { EnglishClassicQuoteFavorite } from './english-classic-quote-favorite.entity';
import { EnglishLearningController } from './english-learning.controller';
import { EnglishLearningService } from './english-learning.service';
import { EnglishLearningStreamAbortRegistry } from './english-learning-stream-abort.registry';
import { EnglishPackWebSearchRecord } from './english-pack-web-search.entity';
import { EnglishVocabularyPackBatch } from './english-vocabulary.entity';
import { EnglishVocabularyFavorite } from './english-vocabulary-favorite.entity';
import { EnglishVocabularyLibrary } from './english-vocabulary-library.entity';
import { EnglishVocabularyLibraryItem } from './english-vocabulary-library-item.entity';

@Module({
	imports: [
		KnowledgeQaModule,
		TypeOrmModule.forFeature([
			EnglishVocabularyPackBatch,
			EnglishClassicQuotePackBatch,
			EnglishPackWebSearchRecord,
			EnglishVocabularyFavorite,
			EnglishClassicQuoteFavorite,
			EnglishVocabularyLibrary,
			EnglishVocabularyLibraryItem,
		]),
	],
	controllers: [EnglishLearningController],
	providers: [EnglishLearningService, EnglishLearningStreamAbortRegistry],
	exports: [EnglishLearningService],
})
export class EnglishLearningModule {}
