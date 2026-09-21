import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeEmbeddingModule } from '../knowledge-embedding/knowledge-embedding.module';
import { KnowledgeQaModule } from '../knowledge-qa/knowledge-qa.module';
import { AnnotateSourceTaskService } from './annotate-source-task.service';
import { EnglishLearningController } from './english-learning.controller';
import { EnglishLearningService } from './english-learning.service';
import { EnglishLearningStreamAbortRegistry } from './english-learning-stream-abort.registry';
import { EnglishAnnotateSourceTask } from './entity/english-annotate-source-task.entity';
import { EnglishClassicQuotePackBatch } from './entity/english-classic-quote.entity';
import { EnglishClassicQuoteFavorite } from './entity/english-classic-quote-favorite.entity';
import { EnglishClassicQuoteMistake } from './entity/english-classic-quote-mistake.entity';
import { EnglishClassicQuotesLibrary } from './entity/english-classic-quotes-library.entity';
import { EnglishClassicQuotesLibraryItem } from './entity/english-classic-quotes-library-item.entity';
import { EnglishClassicQuotesPackItem } from './entity/english-classic-quotes-pack-item.entity';
import { EnglishClassicQuotesPackSession } from './entity/english-classic-quotes-pack-session.entity';
import { EnglishDailyMemorizeRecord } from './entity/english-daily-memorize-record.entity';
import { EnglishLearningResumeModuleSetting } from './entity/english-learning-resume-module-setting.entity';
import { EnglishLibraryItemsResume } from './entity/english-library-items-resume.entity';
import { EnglishPackWebSearchRecord } from './entity/english-pack-web-search.entity';
import { EnglishPracticeReviewState } from './entity/english-practice-review-state.entity';
import { EnglishSentenceWordAnnotationCache } from './entity/english-sentence-word-annotation-cache.entity';
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
			EnglishDailyMemorizeRecord,
			EnglishClassicQuoteFavorite,
			EnglishClassicQuoteMistake,
			EnglishVocabularyLibrary,
			EnglishVocabularyLibraryItem,
			EnglishClassicQuotesLibrary,
			EnglishClassicQuotesLibraryItem,
			EnglishLibraryItemsResume,
			EnglishLearningResumeModuleSetting,
			EnglishSentenceWordAnnotationCache,
			EnglishAnnotateSourceTask,
		]),
	],
	controllers: [EnglishLearningController],
	providers: [
		EnglishLearningService,
		EnglishLearningStreamAbortRegistry,
		AnnotateSourceTaskService,
	],
	exports: [EnglishLearningService],
})
export class EnglishLearningModule {}
