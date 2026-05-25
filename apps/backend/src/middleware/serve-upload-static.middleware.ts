import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { NextFunction, Request, Response } from 'express';

const MIME_BY_EXT: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.pdf': 'application/pdf',
};

/**
 * 在 Nest 全局前缀 / 其它中间件之前处理 GET /images|/files。
 * 解码 URL 中的中文文件名并与磁盘一致，避免 proxy+root 混配或仅编码路径导致 400/404。
 */
export function serveUploadStaticMiddleware(uploadsRoot: string) {
	return (req: Request, res: Response, next: NextFunction) => {
		if (req.method !== 'GET' && req.method !== 'HEAD') {
			return next();
		}

		const matched = req.path.match(/^\/(images|files)\/([^/]+)$/);
		if (!matched) {
			return next();
		}

		const folder = matched[1] as 'images' | 'files';
		let filename: string;
		try {
			filename = decodeURIComponent(matched[2]);
		} catch {
			res.status(400).end();
			return;
		}

		if (!filename || filename.includes('..') || filename.includes('/')) {
			res.status(400).end();
			return;
		}

		const absolutePath = join(uploadsRoot, folder, filename);
		if (!existsSync(absolutePath)) {
			return next();
		}

		const mime = MIME_BY_EXT[extname(absolutePath).toLowerCase()];
		if (mime) {
			res.setHeader('Content-Type', mime);
		}
		res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
		res.setHeader('Cache-Control', 'public, max-age=604800');
		res.sendFile(absolutePath, (err) => {
			if (err) {
				next(err);
			}
		});
	};
}
