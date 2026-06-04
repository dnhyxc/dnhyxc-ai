import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeEmbeddingModule } from '../knowledge-embedding/knowledge-embedding.module';
import { KnowledgeQaModule } from '../knowledge-qa/knowledge-qa.module';
import { EnglishLearningController } from './english-learning.controller';
import { EnglishLearningService } from './english-learning.service';
import { EnglishLearningStreamAbortRegistry } from './english-learning-stream-abort.registry';
import { EnglishClassicQuotePackBatch } from './entity/english-classic-quote.entity';
import { EnglishClassicQuoteFavorite } from './entity/english-classic-quote-favorite.entity';
import { EnglishClassicQuoteMistake } from './entity/english-classic-quote-mistake.entity';
import { EnglishClassicQuotesLibrary } from './entity/english-classic-quotes-library.entity';
import { EnglishClassicQuotesLibraryItem } from './entity/english-classic-quotes-library-item.entity';
import { EnglishClassicQuotesPackItem } from './entity/english-classic-quotes-pack-item.entity';
import { EnglishClassicQuotesPackSession } from './entity/english-classic-quotes-pack-session.entity';
import { EnglishPackWebSearchRecord } from './entity/english-pack-web-search.entity';
import { EnglishPracticeReviewState } from './entity/english-practice-review-state.entity';
import { EnglishVocabularyPackBatch } from './entity/english-vocabulary.entity';
import { EnglishVocabularyFavorite } from './entity/english-vocabulary-favorite.entity';
import { EnglishVocabularyLibrary } from './entity/english-vocabulary-library.entity';
import { EnglishVocabularyLibraryItem } from './entity/english-vocabulary-library-item.entity';
import { EnglishVocabularyMistake } from './entity/english-vocabulary-mistake.entity';
import { EnglishVocabularyPackItem } from './entity/english-vocabulary-pack-item.entity';
import { EnglishVocabularyPackSession } from './entity/english-vocabulary-pack-session.entity';

@Module({
	imports: [
		KnowledgeQaModule,
		KnowledgeEmbeddingModule,
		TypeOrmModule.forFeature([
			EnglishVocabularyPackBatch,
			EnglishVocabularyPackSession,
			EnglishVocabularyPackItem,
			EnglishClassicQuotePackBatch,
			EnglishClassicQuotesPackSession,
			EnglishClassicQuotesPackItem,
			EnglishPackWebSearchRecord,
			EnglishVocabularyFavorite,
			EnglishVocabularyMistake,
			EnglishPracticeReviewState,
			EnglishClassicQuoteFavorite,
			EnglishClassicQuoteMistake,
			EnglishVocabularyLibrary,
			EnglishVocabularyLibraryItem,
			EnglishClassicQuotesLibrary,
			EnglishClassicQuotesLibraryItem,
		]),
	],
	controllers: [EnglishLearningController],
	providers: [EnglishLearningService, EnglishLearningStreamAbortRegistry],
	exports: [EnglishLearningService],
})
export class EnglishLearningModule {}
