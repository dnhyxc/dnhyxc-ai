import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	Body,
	Controller,
	HttpException,
	HttpStatus,
	Param,
	Put,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { JwtGuard } from '../../guards/jwt.guard';
import { ResponseInterceptor } from '../../interceptors/response.interceptor';
import { ensureUploadDir, getUploadRemotesDir } from '../../utils/upload-paths';

type PutRemoteBody = {
	/** 完整 JSON 文本（将写入 uploads/remotes/:filename） */
	content?: string;
};

/**
 * 写入插件 registry 等 remotes JSON（需登录）。
 * 与公开 GET /api/upload/remotes/:filename、静态 /remotes/ 对应。
 */
@Controller('upload')
@UseInterceptors(ResponseInterceptor)
@UseGuards(JwtGuard)
export class UploadRemotesWriteController {
	@Put('remotes/:filename')
	putRemote(@Param('filename') filename: string, @Body() body: PutRemoteBody) {
		if (
			!filename ||
			filename.includes('..') ||
			filename.includes('/') ||
			filename.includes('\\')
		) {
			throw new HttpException('非法文件名', HttpStatus.BAD_REQUEST);
		}
		// ponytail: 仅放行 json，避免 remotes 被当成任意写桶
		if (!filename.toLowerCase().endsWith('.json')) {
			throw new HttpException('仅支持 .json', HttpStatus.BAD_REQUEST);
		}

		const content = typeof body?.content === 'string' ? body.content : '';
		if (!content.trim()) {
			throw new HttpException('content 不能为空', HttpStatus.BAD_REQUEST);
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(content);
		} catch {
			throw new HttpException('JSON 解析失败', HttpStatus.BAD_REQUEST);
		}

		// plugins-registry 结构最低校验
		if (
			filename === 'plugins-registry.json' &&
			(!parsed ||
				typeof parsed !== 'object' ||
				!Array.isArray((parsed as { plugins?: unknown }).plugins))
		) {
			throw new HttpException(
				'plugins-registry.json 须含 plugins 数组',
				HttpStatus.BAD_REQUEST,
			);
		}

		const remotesDir = getUploadRemotesDir();
		ensureUploadDir(remotesDir);
		const absolutePath = join(remotesDir, filename);
		const pretty = `${JSON.stringify(parsed, null, '\t')}\n`;
		try {
			writeFileSync(absolutePath, pretty, 'utf8');
		} catch (e) {
			throw new HttpException(
				e instanceof Error ? e.message : '写入失败',
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
		}

		return { filename, path: `/remotes/${filename}` };
	}
}
