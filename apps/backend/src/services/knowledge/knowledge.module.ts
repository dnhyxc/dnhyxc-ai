import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeController } from './knowledge.controller';
import { Knowledge } from './knowledge.entity';
import { KnowledgeService } from './knowledge.service';

@Module({
	imports: [TypeOrmModule.forFeature([Knowledge])],
	controllers: [KnowledgeController],
	providers: [KnowledgeService],
})
export class KnowledgeModule {}
