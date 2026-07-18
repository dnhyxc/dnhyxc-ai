import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadModule } from '../upload/upload.module';
import { User } from '../user/user.entity';
import { EbookController } from './ebook.controller';
import { EbookService } from './ebook.service';
import { EbookBook } from './ebook-book.entity';
import { EbookCategory } from './ebook-category.entity';
import { EbookChapter } from './ebook-chapter.entity';
import { EbookHighlight } from './ebook-highlight.entity';
import { EbookProgress } from './ebook-progress.entity';
import { EbookThought } from './ebook-thought.entity';
import { EbookUserPrefs } from './ebook-user-prefs.entity';
import { EpubChapterParserService } from './epub-chapter-parser.service';
import { EPUB_PARSE_QUEUE } from './epub-parse.constants';
import { EpubParseProcessor } from './epub-parse.processor';
import { EpubParseQueueEvents } from './epub-parse-queue-events';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			EbookBook,
			EbookChapter,
			EbookProgress,
			EbookUserPrefs,
			EbookCategory,
			EbookThought,
			EbookHighlight,
			User,
		]),
		UploadModule,
		ConfigModule,
		BullModule.registerQueueAsync({ name: EPUB_PARSE_QUEUE }),
	],
	controllers: [EbookController],
	providers: [
		EbookService,
		EpubChapterParserService,
		EpubParseProcessor,
		EpubParseQueueEvents,
	],
})
export class EbookModule {}
