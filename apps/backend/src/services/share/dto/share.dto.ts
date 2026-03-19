/**
 * 分享相关的 DTO（数据传输对象）
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ArrayNotEmpty,
	IsArray,
	IsNumber,
	IsOptional,
	IsString,
} from 'class-validator';
import { ChatSessions } from 'src/services/chat/session.entity';

// 创建分享请求 DTO
export class CreateShareDto {
	@ApiProperty({
		description: '会话ID',
		example: '145b8ea2-d4ef-47a9-a408-01603cef5ff1',
	})
	@IsString()
	chat_session_id: string;

	@ApiProperty({
		description: '消息ID列表，指定要分享的消息',
		example: [1, 2, 3],
		type: [String],
	})
	@IsArray()
	@ArrayNotEmpty({ message: '消息ID列表不能为空' })
	@IsNumber({}, { each: true })
	message_ids: string[];
}

// 创建分享响应 DTO
export class CreateShareResponseDto {
	@ApiProperty({
		description: '分享ID',
		example: '145b8ea2d4ef47a9a40801603cef5ff1',
	})
	shareId: string;

	@ApiProperty({
		description: '分享链接',
		example: 'https://your-domain.com/s/145b8ea2d4ef47a9a40801603cef5ff1',
	})
	shareUrl: string;

	@ApiProperty({ description: '创建时间（时间戳）' })
	createdAt: number;

	@ApiPropertyOptional({ description: '过期时间（时间戳）' })
	expiresAt?: number | null;
}

// 消息 DTO（用于返回给前端）
export class MessageDto {
	@ApiProperty({ description: '消息ID' })
	id: number;

	@ApiProperty({ description: '聊天ID（前端生成的UUID）' })
	chatId: string;

	@ApiProperty({
		description: '角色: user 或 assistant',
		enum: ['user', 'assistant'],
	})
	role: 'user' | 'assistant';

	@ApiProperty({ description: '消息内容' })
	content: string;

	@ApiPropertyOptional({ description: '时间戳' })
	@IsOptional()
	timestamp?: number;

	@ApiPropertyOptional({ description: '思考内容' })
	@IsOptional()
	thinkContent?: string;

	@ApiPropertyOptional({ description: '附件列表' })
	@IsOptional()
	attachments?: any[];

	@ApiPropertyOptional({ description: '父消息ID' })
	@IsOptional()
	parentId?: number | null;

	@ApiPropertyOptional({ description: '同级消息索引' })
	@IsOptional()
	siblingIndex?: number;

	@ApiPropertyOptional({ description: '同级消息总数' })
	@IsOptional()
	siblingCount?: number;
}

// 获取分享响应 DTO
export class GetShareResponseDto {
	@ApiProperty({ description: '分享ID（用于URL）' })
	shareId: string;

	@ApiProperty({ description: '会话标题' })
	title: string;

	@ApiProperty({ description: '消息列表', type: [MessageDto] })
	session: ChatSessions;

	@ApiProperty({ description: '创建时间（时间戳）' })
	createdAt: number;

	@ApiPropertyOptional({ description: '过期时间（时间戳）' })
	expiresAt?: number | null;

	@ApiPropertyOptional({ description: '查看次数' })
	viewCount?: number;
}

// Redis 存储的数据结构
export interface ShareCacheData {
	shareId: string;
	chatSessionId: string;
	messageIds: string[];
	createdAt: number;
	expiresAt: number | null;
}
