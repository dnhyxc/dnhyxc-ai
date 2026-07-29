import { createReadStream, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import {
	Controller,
	Get,
	HttpException,
	HttpStatus,
	Param,
	Query,
	Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
	decodeUploadPublicPath,
	ensureUploadDir,
	getUploadRemotesDir,
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
	'.json': 'application/json; charset=utf-8',
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
		if (!/^\/(images|files|remotes)\/[^/]+$/.test(decoded)) {
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
		res.setHeader(
			'Cache-Control',
			decoded.startsWith('/remotes/')
				? 'no-store, max-age=0, must-revalidate'
				: 'public, max-age=604800',
		);
		createReadStream(absolutePath).pipe(res);
	}

	/**
	 * 插件 registry 等：磁盘 `uploads/remotes/:filename`
	 * 首选静态：GET /remotes/plugins-registry.json（与 /images 同形态）
	 * 本接口备用：GET /api/upload/remotes/plugins-registry.json
	 */
	@Get('remotes/:filename')
	serveRemote(@Param('filename') filename: string, @Res() res: Response) {
		if (
			!filename ||
			filename.includes('..') ||
			filename.includes('/') ||
			filename.includes('\\')
		) {
			throw new HttpException('非法文件名', HttpStatus.BAD_REQUEST);
		}
		// ponytail: 仅放行 json，避免 remote 目录被当成任意静态桶
		if (!filename.toLowerCase().endsWith('.json')) {
			throw new HttpException('仅支持 .json', HttpStatus.BAD_REQUEST);
		}

		const remotesDir = getUploadRemotesDir();
		ensureUploadDir(remotesDir);
		const absolutePath = join(remotesDir, filename);
		if (!existsSync(absolutePath)) {
			throw new HttpException('文件不存在', HttpStatus.NOT_FOUND);
		}

		res.setHeader(
			'Content-Type',
			MIME_BY_EXT['.json'] ?? 'application/json; charset=utf-8',
		);
		res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
		res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
		createReadStream(absolutePath).pipe(res);
	}
}
