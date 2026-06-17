import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EbookAssistantController } from './ebook-assistant.controller';
import { EbookAssistantService } from './ebook-assistant.service';
import { EbookAssistantMemoryService } from './ebook-assistant-memory.service';
import { EbookAssistantMessage } from './ebook-assistant-message.entity';
import { EbookAssistantSession } from './ebook-assistant-session.entity';
import { EbookAssistantSessionSummary } from './ebook-assistant-session-summary.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			EbookAssistantSession,
			EbookAssistantMessage,
			EbookAssistantSessionSummary,
		]),
	],
	controllers: [EbookAssistantController],
	providers: [EbookAssistantService, EbookAssistantMemoryService],
	exports: [EbookAssistantService, EbookAssistantMemoryService],
})
export class EbookAssistantModule {}
