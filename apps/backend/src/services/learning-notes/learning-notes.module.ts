import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadModule } from '../upload/upload.module';
import { User } from '../user/user.entity';
import { EnglishLearningNote } from './english-learning-note.entity';
import { EnglishLearningNoteAttachment } from './english-learning-note-attachment.entity';
import { EnglishLearningNotePendingUpload } from './english-learning-note-pending-upload.entity';
import { LearningNotesController } from './learning-notes.controller';
import { LearningNotesService } from './learning-notes.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			EnglishLearningNote,
			EnglishLearningNoteAttachment,
			EnglishLearningNotePendingUpload,
			User,
		]),
		UploadModule,
	],
	controllers: [LearningNotesController],
	providers: [LearningNotesService],
})
export class LearningNotesModule {}
