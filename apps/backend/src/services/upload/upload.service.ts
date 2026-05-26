import { randomUUID } from 'node:crypto';
import { existsSync, unlink } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import COS from 'cos-nodejs-sdk-v5';
import { decodeChineseFilename } from '../../utils';
import {
	getAllowedUploadRoots,
	resolveStoredUploadAbsolutePath,
	toUploadPublicPath,
} from '../../utils/upload-paths';
import {
	assertCosRuntimeConfig,
	formatCosUploadError,
	getCosRuntimeConfig,
} from './cos.config';
import { IMAGE_EXTS } from './upload.enum';

const unlinkAsync = promisify(unlink);

@Injectable()
export class UploadService {
	private cosClient: COS | null = null;

	private getCosClient(): COS {
		if (!this.cosClient) {
			const config = getCosRuntimeConfig();
			assertCosRuntimeConfig(config);
			this.cosClient = new COS({
				SecretId: config.secretId,
				SecretKey: config.secretKey,
			});
		}
		return this.cosClient;
	}

	buildCosObjectKey(originalname: string): string {
		const safeName = basename(decodeChineseFilename(originalname)).replace(
			/[/\\]/g,
			'_',
		);
		return `assets/${randomUUID()}_${safeName}`;
	}

	buildCosPublicUrl(key: string): string {
		const config = getCosRuntimeConfig();
		assertCosRuntimeConfig(config);
		const domain = config.publicDomain.endsWith('/')
			? config.publicDomain
			: `${config.publicDomain}/`;
		const encodedKey = key
			.replace(/^\//, '')
			.split('/')
			.map((segment) => encodeURIComponent(segment))
			.join('/');
		return `${domain}${encodedKey}`;
	}

	async uploadObjectToCos(file: Express.Multer.File) {
		if (!file?.buffer?.length) {
			throw new HttpException('上传文件为空', HttpStatus.BAD_REQUEST);
		}

		const config = getCosRuntimeConfig();
		assertCosRuntimeConfig(config);

		const key = this.buildCosObjectKey(file.originalname);
		const cos = this.getCosClient();

		try {
			await cos.putObject({
				Bucket: config.bucket,
				Region: config.region,
				Key: key,
				Body: file.buffer,
				ContentType: file.mimetype || 'application/octet-stream',
				// 默认公有读，否则浏览器直链 / ext-cos 等同源代理会 403
				ACL: config.objectAcl,
			});
		} catch (error) {
			throw new HttpException(
				formatCosUploadError(error),
				HttpStatus.BAD_GATEWAY,
			);
		}

		const originalname = decodeChineseFilename(file.originalname);
		return {
			key,
			url: this.buildCosPublicUrl(key),
			originalname,
			filename: basename(key),
			mimetype: file.mimetype,
			size: file.size,
		};
	}

	getStaticPath(filePath: string, _mimetype: string): string {
		return toUploadPublicPath(filePath);
	}

	getStaticUrl(filename: string, folderName?: string, toReplace?: boolean) {
		const folder = folderName as 'images' | 'files';
		const fullPath = resolveStoredUploadAbsolutePath(
			filename,
			folder,
			__dirname,
		);

		if (existsSync(fullPath)) {
			if (toReplace) {
				return toUploadPublicPath(fullPath);
			}
			return fullPath;
		}
		throw new HttpException('文件不存在', HttpStatus.BAD_REQUEST);
	}

	download(filename: string, toReplace?: boolean) {
		const isImage = IMAGE_EXTS.includes(extname(filename).toLowerCase());
		if (isImage) {
			return this.getStaticUrl(filename, 'images', toReplace);
		}
		return this.getStaticUrl(filename, 'files', toReplace);
	}

	async deleteFile(filename: string) {
		if (!filename) {
			throw new HttpException('文件名不能为空', HttpStatus.BAD_REQUEST);
		}

		let absolutePath = '';
		try {
			absolutePath = this.download(filename, false);
		} catch (_e) {
			throw new HttpException('文件不存在或路径错误', HttpStatus.NOT_FOUND);
		}

		const normalizedPath = resolve(absolutePath);
		const allowed = getAllowedUploadRoots(__dirname).some((root) =>
			normalizedPath.startsWith(root),
		);
		if (!allowed) {
			throw new HttpException('非法的文件路径', HttpStatus.FORBIDDEN);
		}

		try {
			await unlinkAsync(normalizedPath);
			return { message: '删除成功', filename };
		} catch (error) {
			throw new HttpException(
				`删除失败：${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
		}
	}
}
