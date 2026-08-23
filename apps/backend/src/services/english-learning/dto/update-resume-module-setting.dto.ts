import { IsBoolean, IsIn } from 'class-validator';
import {
	ENGLISH_LEARNING_RESUME_MODULE_KEYS,
	type EnglishLearningResumeModuleKey,
} from '../english-learning-resume-module.constants';

export class UpdateResumeModuleSettingDto {
	@IsIn([...ENGLISH_LEARNING_RESUME_MODULE_KEYS])
	moduleKey!: EnglishLearningResumeModuleKey;

	@IsBoolean()
	enabled!: boolean;
}
