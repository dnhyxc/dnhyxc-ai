import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueEvents } from 'bullmq';
import { createBullRedisConnectionOptions } from '../../factorys/bull-redis-connection.factory';
import { EPUB_PARSE_QUEUE } from './epub-parse.constants';

@Injectable()
export class EpubParseQueueEvents implements OnModuleDestroy {
	readonly events: QueueEvents;

	constructor(configService: ConfigService) {
		this.events = new QueueEvents(EPUB_PARSE_QUEUE, {
			connection: createBullRedisConnectionOptions(configService),
		});
	}

	async onModuleDestroy(): Promise<void> {
		await this.events.close();
	}
}
