import { createReadStream, existsSync } from 'node:fs';
import { extname } from 'node:path';
import {
	Controller,
	Get,
	HttpException,
	HttpStatus,
	Query,
	Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
	decodeUploadPublicPath,
	resolveUploadPublicPathToAbsolute,
} from '../../utils/upload-paths';

const MIME_BY_EXT: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.pdf': 'application/pdf',
	'.txt': 'text/plain',
	'.md': 'text/markdown',
};

/**
 * 公开附件访问（无需 JWT）。
 * 供 Web 生产环境走已有 /api/ 反代，避免 9002 未配置 /images/ 时附件 404。
 */
@Controller('upload')
export class UploadPublicController {
	@Get('serve')
	serve(@Query('path') path: string, @Res() res: Response) {
		if (!path?.trim()) {
			throw new HttpException('path 不能为空', HttpStatus.BAD_REQUEST);
		}

		const decoded = decodeUploadPublicPath(path);
		if (!/^\/(images|files)\/[^/]+$/.test(decoded)) {
			throw new HttpException('非法附件路径', HttpStatus.BAD_REQUEST);
		}

		let absolutePath: string;
		try {
			absolutePath = resolveUploadPublicPathToAbsolute(decoded);
		} catch {
			throw new HttpException('文件不存在', HttpStatus.NOT_FOUND);
		}

		if (!existsSync(absolutePath)) {
			throw new HttpException('文件不存在', HttpStatus.NOT_FOUND);
		}

		const ext = extname(absolutePath).toLowerCase();
		const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
		res.setHeader('Content-Type', mime);
		res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
		res.setHeader('Cache-Control', 'public, max-age=604800');
		createReadStream(absolutePath).pipe(res);
	}
}
