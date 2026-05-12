import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

/** 取消正在进行的单词包 / 经典句 SSE 生成（与首包 progress 中的 streamId 一致） */
export class CancelEnglishLearningStreamDto {
	@IsString()
	@IsNotEmpty()
	@IsUUID('4')
	streamId!: string;
}
