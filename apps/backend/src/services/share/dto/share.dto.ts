/**
 * 分享相关的 DTO（数据传输对象）
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ArrayNotEmpty,
	IsArray,
	IsIn,
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
	chatSessionId: string;

	@ApiPropertyOptional({
		description:
			'分享目标类型：session=分享会话（默认）；knowledge=分享知识文章（同一分享页通过 URL 参数区分渲染）',
		example: 'session',
		enum: ['session', 'knowledge'],
	})
	@IsIn(['session', 'knowledge'])
	@IsOptional()
	shareType?: 'session' | 'knowledge';

	@ApiPropertyOptional({
		description:
			'会话类型：chat=主聊天，assistant=知识库助手，agent=LangChain Agent 专项（如英语学习）；不填默认 chat',
		example: 'chat',
		enum: ['chat', 'assistant', 'agent'],
	})
	@IsIn(['chat', 'assistant', 'agent'])
	@IsOptional()
	sessionType?: 'chat' | 'assistant' | 'agent';

	@ApiProperty({
		description: '消息ID列表，指定要分享的消息',
		example: [1, 2, 3],
		type: [String],
	})
	@ArrayNotEmpty({ message: '消息ID列表不能为空' })
	@IsArray()
	@IsString({ each: true })
	@IsOptional()
	messageIds?: string[];

	@IsString()
	@IsOptional()
	baseUrl?: string;
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
	session?: ChatSessions;

	@ApiProperty({ description: '创建时间（时间戳）' })
	createdAt: number;

	@ApiPropertyOptional({ description: '过期时间（时间戳）' })
	expiresAt?: number | null;

	@ApiPropertyOptional({ description: '查看次数' })
	viewCount?: number;

	@ApiPropertyOptional({
		description: '分享目标类型：session / knowledge',
		enum: ['session', 'knowledge'],
	})
	@IsOptional()
	shareType?: 'session' | 'knowledge';

	@ApiPropertyOptional({
		description:
			'当 shareType=knowledge 时返回的文章数据（session 分享不返回该字段）',
	})
	@IsOptional()
	knowledge?: {
		id: string;
		title: string | null;
		content: string;
		createdAt: number;
		updatedAt: number;
	};
}

// Redis 存储的数据结构
export interface ShareCacheData {
	shareId: string;
	chatSessionId: string;
	/** 分享目标类型：session / knowledge */
	shareType?: 'session' | 'knowledge';
	/** 可选：用于 getShare 时直接选择数据源 */
	sessionType?: 'chat' | 'assistant' | 'agent';
	messageIds?: string[];
	createdAt: number;
	expiresAt: number | null;
}
