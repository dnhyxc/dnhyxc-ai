import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSkillTrySessionDto {
	/** try = 试跑（须 skillId）；generate = 生成（可带 skillId；无则草稿桶） */
	@IsOptional()
	@IsIn(['try', 'generate'])
	kind?: 'try' | 'generate';

	/** 试跑必填；生成可选（已保存 Skill 锚定，新建草稿省略） */
	@IsOptional()
	@IsUUID()
	skillId?: string;

	@IsOptional()
	@IsString()
	@MaxLength(255)
	title?: string;
}
