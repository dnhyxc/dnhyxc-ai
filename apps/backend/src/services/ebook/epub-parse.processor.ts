import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, type LoggerService } from '@nestjs/common';
import type { Job } from 'bullmq';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { EbookService } from './ebook.service';
import { EPUB_PARSE_QUEUE } from './epub-parse.constants';

export type EpubParseJobData = { bookId: string };

/** ponytail: concurrency=1 避免多本大 EPUB 占满事件循环 */
@Processor(EPUB_PARSE_QUEUE, { concurrency: 1 })
export class EpubParseProcessor extends WorkerHost {
	constructor(
		private readonly ebookService: EbookService,
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService,
	) {
		super();
	}

	async process(job: Job<EpubParseJobData>): Promise<void> {
		const { bookId } = job.data;
		this.logger.log(`EPUB 解析任务开始 book=${bookId} job=${job.id}`);
		await this.ebookService.processEpubParseJob(bookId);
	}
}
