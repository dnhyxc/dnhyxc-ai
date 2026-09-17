import { IsUUID } from 'class-validator';

/** 将 generate 草稿会话（skill_id null）绑定到已保存 Skill */
export class BindSkillTrySessionDto {
	@IsUUID()
	skillId!: string;
}
