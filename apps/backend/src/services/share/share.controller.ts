/**
 * 分享控制器
 */

import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	CreateShareDto,
	CreateShareResponseDto,
	GetShareResponseDto,
} from './dto/share.dto';
import { ShareService } from './share.service';

@ApiTags('分享')
@Controller('/share')
export class ShareController {
	constructor(private readonly shareService: ShareService) {}

	/**
	 * 创建分享
	 * POST /api/share/create
	 */
	@Post('/create')
	@ApiOperation({
		summary: '创建分享',
		description: '创建分享链接，只存储参数到Redis',
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: '创建成功',
		type: CreateShareResponseDto,
	})
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '参数错误' })
	async create(@Body() dto: CreateShareDto): Promise<CreateShareResponseDto> {
		return this.shareService.createShare(dto);
	}

	/**
	 * 获取分享
	 * GET /api/share/get/:shareId
	 */
	@Get('/get/:shareId')
	@ApiOperation({
		summary: '获取分享',
		description: '获取分享内容，从Redis获取参数后查询数据库',
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
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: '删除分享' })
	@ApiParam({ name: 'shareId', description: '分享ID' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT, description: '删除成功' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: '分享不存在' })
	async delete(@Param('shareId') shareId: string): Promise<void> {
		await this.shareService.deleteShare(shareId);
	}
}
