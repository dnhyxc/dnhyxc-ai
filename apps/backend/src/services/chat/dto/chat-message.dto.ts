import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class ChatMessageDto {
	@IsEnum(['user', 'assistant', 'system'], {
		message: '角色必须是 user、assistant 或 system',
	})
	role: 'user' | 'assistant' | 'system';

	@IsNotEmpty({ message: '内容不能为空' })
	@IsString()
	content: string;
}
