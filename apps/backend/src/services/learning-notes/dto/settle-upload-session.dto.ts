import { IsOptional, IsString, MaxLength } from 'class-validator';

/** 按正文结算上传会话（不写笔记） */
export class SettleUploadSessionDto {
	@IsOptional()
	@IsString()
	@MaxLength(5_000_000)
	content?: string;
}
