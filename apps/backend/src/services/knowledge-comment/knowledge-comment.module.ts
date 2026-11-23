import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { User } from '../user/user.entity';
import { KnowledgeCommentController } from './knowledge-comment.controller';
import { KnowledgeComment } from './knowledge-comment.entity';
import { KnowledgeCommentService } from './knowledge-comment.service';
import { KnowledgeCommentLike } from './knowledge-comment-like.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([KnowledgeComment, KnowledgeCommentLike, User]),
		KnowledgeModule,
	],
	controllers: [KnowledgeCommentController],
	providers: [KnowledgeCommentService],
})
export class KnowledgeCommentModule {}
