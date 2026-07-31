import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { EnglishLearningNote } from './english-learning-note.entity';
import { LearningNotesController } from './learning-notes.controller';
import { LearningNotesService } from './learning-notes.service';

@Module({
	imports: [TypeOrmModule.forFeature([EnglishLearningNote, User])],
	controllers: [LearningNotesController],
	providers: [LearningNotesService],
})
export class LearningNotesModule {}
