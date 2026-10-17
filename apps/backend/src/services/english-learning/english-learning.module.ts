import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeEmbeddingModule } from '../knowledge-embedding/knowledge-embedding.module';
import { KnowledgeQaModule } from '../knowledge-qa/knowledge-qa.module';
import { SpeechTranscriptionModule } from '../speech-transcription/speech-transcription.module';
import { AnnotateSourceTaskService } from './annotate-source-task.service';
import { DAILY_READING_QUEUE } from './daily-reading.constants';
import { EnglishDailyReadingProcessor } from './english-daily-reading.processor';
import { EnglishDailyReadingService } from './english-daily-reading.service';
import { EnglishDocxExportJobService } from './english-docx-export-job.service';
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
import { EnglishDailyReading } from './entity/english-daily-reading.entity';
import { EnglishDailyReadingSetting } from './entity/english-daily-reading-setting.entity';
import { EnglishDailyReadingUserSetting } from './entity/english-daily-reading-user-setting.entity';
import { EnglishLearningResumeModuleSetting } from './entity/english-learning-resume-module-setting.entity';
import { EnglishLibraryItemsResume } from './entity/english-library-items-resume.entity';
import { EnglishPackWebSearchRecord } from './entity/english-pack-web-search.entity';
import { EnglishPracticeReport } from './entity/english-practice-report.entity';
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
		SpeechTranscriptionModule,
		BullModule.registerQueueAsync({ name: DAILY_READING_QUEUE }),
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
			EnglishPracticeReport,
			EnglishDailyMemorizeRecord,
			EnglishDailyReading,
			EnglishDailyReadingSetting,
			EnglishDailyReadingUserSetting,
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
		EnglishDailyReadingService,
		EnglishDailyReadingProcessor,
		EnglishDocxExportJobService,
		EnglishLearningStreamAbortRegistry,
		AnnotateSourceTaskService,
	],
	exports: [EnglishLearningService],
})
export class EnglishLearningModule {}
