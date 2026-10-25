import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, type LoggerService } from '@nestjs/common';
import type { Job } from 'bullmq';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { DAILY_READING_QUEUE } from './daily-reading.constants';
import { addCalendarDays, shanghaiToday } from './daily-reading.rules';
import { EnglishDailyReadingService } from './english-daily-reading.service';

type JobData = {
	publishDate?: string;
};

/** 生成只在工人里跑，列表请求不等模型。 */
@Processor(DAILY_READING_QUEUE, { concurrency: 1 })
export class EnglishDailyReadingProcessor extends WorkerHost {
	constructor(
		private readonly dailyReading: EnglishDailyReadingService,
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService,
	) {
		super();
	}

	async process(job: Job<JobData>): Promise<void> {
		if (job.name === 'reconcile-due') {
			await this.dailyReading.reconcileDue();
			return;
		}
		const publishDate =
			job.name === 'prepare-next' || !job.data?.publishDate
				? addCalendarDays(shanghaiToday(), 1)
				: job.data.publishDate;
		this.logger.log(
			`[EnglishDailyReading] 生成 publishDate=${publishDate} job=${job.id}`,
		);
		await this.dailyReading.ensurePassage(publishDate, job.timestamp);
	}
}
