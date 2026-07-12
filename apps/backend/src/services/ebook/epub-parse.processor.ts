import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { EbookService } from './ebook.service';
import { EPUB_PARSE_QUEUE } from './epub-parse.constants';

export type EpubParseJobData = { bookId: string };

/** ponytail: concurrency=1 避免多本大 EPUB 占满事件循环 */
@Processor(EPUB_PARSE_QUEUE, { concurrency: 1 })
export class EpubParseProcessor extends WorkerHost {
	private readonly logger = new Logger(EpubParseProcessor.name);

	constructor(private readonly ebookService: EbookService) {
		super();
	}

	async process(job: Job<EpubParseJobData>): Promise<void> {
		const { bookId } = job.data;
		this.logger.log(`EPUB 解析任务开始 book=${bookId} job=${job.id}`);
		await this.ebookService.processEpubParseJob(bookId);
	}
}
