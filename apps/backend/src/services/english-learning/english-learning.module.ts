import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeEmbeddingModule } from '../knowledge-embedding/knowledge-embedding.module';
import { KnowledgeQaModule } from '../knowledge-qa/knowledge-qa.module';
import { EnglishClassicQuotePackBatch } from './english-classic-quote.entity';
import { EnglishClassicQuoteFavorite } from './english-classic-quote-favorite.entity';
import { EnglishClassicQuotesLibrary } from './english-classic-quotes-library.entity';
import { EnglishClassicQuotesLibraryItem } from './english-classic-quotes-library-item.entity';
import { EnglishClassicQuotesPackItem } from './english-classic-quotes-pack-item.entity';
import { EnglishClassicQuotesPackSession } from './english-classic-quotes-pack-session.entity';
import { EnglishLearningController } from './english-learning.controller';
import { EnglishLearningService } from './english-learning.service';
import { EnglishLearningStreamAbortRegistry } from './english-learning-stream-abort.registry';
import { EnglishPackWebSearchRecord } from './english-pack-web-search.entity';
import { EnglishVocabularyPackBatch } from './english-vocabulary.entity';
import { EnglishVocabularyFavorite } from './english-vocabulary-favorite.entity';
import { EnglishVocabularyLibrary } from './english-vocabulary-library.entity';
import { EnglishVocabularyLibraryItem } from './english-vocabulary-library-item.entity';
import { EnglishVocabularyPackItem } from './english-vocabulary-pack-item.entity';
import { EnglishVocabularyPackSession } from './english-vocabulary-pack-session.entity';

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
			EnglishClassicQuoteFavorite,
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
