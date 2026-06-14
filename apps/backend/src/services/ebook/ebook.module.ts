import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EbookController } from './ebook.controller';
import { EbookService } from './ebook.service';
import { EbookBook } from './ebook-book.entity';
import { EbookProgress } from './ebook-progress.entity';

@Module({
	imports: [TypeOrmModule.forFeature([EbookBook, EbookProgress])],
	controllers: [EbookController],
	providers: [EbookService],
})
export class EbookModule {}
