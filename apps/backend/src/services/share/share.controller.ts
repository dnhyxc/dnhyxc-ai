/**
 * 分享控制器
 */

import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Req,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtGuard } from '../../guards/jwt.guard';
import { ResponseInterceptor } from '../../interceptors/response.interceptor';
import {
	CreateShareDto,
	CreateShareResponseDto,
	GetShareResponseDto,
} from './dto/share.dto';
import { ShareService } from './share.service';

type AuthedRequest = Request & { user?: { userId?: number } };

@ApiTags('分享')
@Controller('/share')
// ClassSerializerInterceptor 设置返回字段过滤，ResponseInterceptor 设置响应拦截器，统一响应的格式
@UseInterceptors(ClassSerializerInterceptor, ResponseInterceptor)
export class ShareController {
	constructor(private readonly shareService: ShareService) {}

	/**
	 * 创建分享
	 * POST /api/share/create
	 */
	@Post('/create')
	@UseGuards(JwtGuard)
	@ApiOperation({
		summary: '创建分享',
		description: '创建分享链接：写入 shares 表（含快照）并旁路缓存 Redis',
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: '创建成功',
		type: CreateShareResponseDto,
	})
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '参数错误' })
	async create(
		@Req() req: AuthedRequest,
		@Body() dto: CreateShareDto,
	): Promise<CreateShareResponseDto> {
		return this.shareService.createShare(dto, req.user?.userId);
	}

	/**
	 * 获取分享
	 * GET /api/share/get/:shareId
	 */
	@Get('/get/:shareId')
	@ApiOperation({
		summary: '获取分享',
		description: 'DB/缓存取元数据，活读正文，失败回退快照；累计 view_count',
	})
	@ApiParam({
		name: 'shareId',
		description: '分享ID',
		example: '145b8ea2d4ef47a9a40801603cef5ff1',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: '获取成功',
		type: GetShareResponseDto,
	})
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: '分享不存在' })
	@ApiResponse({ status: HttpStatus.GONE, description: '分享已过期' })
	async get(@Param('shareId') shareId: string): Promise<GetShareResponseDto> {
		return this.shareService.getShare(shareId);
	}

	/**
	 * 检查分享是否存在
	 * GET /api/share/check/:shareId/exists
	 */
	@Get('/check/:shareId/exists')
	@UseGuards(JwtGuard)
	@ApiOperation({ summary: '检查分享是否存在' })
	@ApiParam({ name: 'shareId', description: '分享ID' })
	@ApiResponse({ status: HttpStatus.OK, description: '返回是否存在' })
	async exists(
		@Param('shareId') shareId: string,
	): Promise<{ exists: boolean }> {
		return { exists: await this.shareService.existsShare(shareId) };
	}

	/**
	 * 删除分享
	 * DELETE /api/share/delete/:shareId
	 */
	@Delete('/delete/:shareId')
	@UseGuards(JwtGuard)
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: '删除分享' })
	@ApiParam({ name: 'shareId', description: '分享ID' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT, description: '删除成功' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: '分享不存在' })
	async delete(@Param('shareId') shareId: string): Promise<void> {
		await this.shareService.deleteShare(shareId);
	}
}
