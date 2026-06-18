import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadModule } from '../upload/upload.module';
import { EbookController } from './ebook.controller';
import { EbookService } from './ebook.service';
import { EbookBook } from './ebook-book.entity';
import { EbookCategory } from './ebook-category.entity';
import { EbookProgress } from './ebook-progress.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([EbookBook, EbookProgress, EbookCategory]),
		UploadModule,
	],
	controllers: [EbookController],
	providers: [EbookService],
})
export class EbookModule {}
