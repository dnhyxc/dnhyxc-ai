import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, unlink } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import type { Writable } from 'node:stream';
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
	type CosObjectKeyPrefix,
	formatCosUploadError,
	getCosRuntimeConfig,
	isCosObjectKey,
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

	private normalizeCosObjectKey(key: string): string {
		const normalizedKey = key?.replace(/^\//, '').trim();
		if (!normalizedKey || !isCosObjectKey(normalizedKey)) {
			throw new HttpException('无效的 COS 对象键', HttpStatus.BAD_REQUEST);
		}
		return normalizedKey;
	}

	buildCosObjectKey(
		originalname: string,
		prefix: CosObjectKeyPrefix = 'assets',
	): string {
		if (prefix === 'ebooks') {
			const ext = extname(decodeChineseFilename(originalname)).toLowerCase();
			const safeExt = ['.epub', '.pdf'].includes(ext) ? ext : '.bin';
			return `${prefix}/${randomUUID()}${safeExt}`;
		}
		const safeName = basename(decodeChineseFilename(originalname)).replace(
			/[/\\]/g,
			'_',
		);
		return `${prefix}/${randomUUID()}_${safeName}`;
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

	async uploadObjectToCos(
		file: Express.Multer.File,
		prefix: CosObjectKeyPrefix = 'assets',
	) {
		if (!file?.buffer?.length) {
			throw new HttpException('上传文件为空', HttpStatus.BAD_REQUEST);
		}

		const config = getCosRuntimeConfig();
		assertCosRuntimeConfig(config);

		const key = this.buildCosObjectKey(file.originalname, prefix);
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

	/** 聊天附件批量上传至 COS（前缀 chat/） */
	async uploadChatAttachmentsToCos(files: Express.Multer.File[]) {
		if (!files?.length) {
			throw new HttpException('上传文件为空', HttpStatus.BAD_REQUEST);
		}
		return Promise.all(
			files.map((file) => this.uploadObjectToCos(file, 'chat')),
		);
	}

	/** 从 COS 流式写出到可写流（避免大文件整包进内存） */
	async pipeObjectToWritable(key: string, writable: Writable): Promise<void> {
		const normalizedKey = this.normalizeCosObjectKey(key);
		const config = getCosRuntimeConfig();
		assertCosRuntimeConfig(config);
		const cos = this.getCosClient();

		try {
			await new Promise<void>((resolve, reject) => {
				cos.getObject(
					{
						Bucket: config.bucket,
						Region: config.region,
						Key: normalizedKey,
						Output: writable,
					},
					(err) => {
						if (err) reject(err);
						else resolve();
					},
				);
			});
		} catch (error) {
			throw new HttpException(
				formatCosUploadError(error),
				HttpStatus.BAD_GATEWAY,
			);
		}
	}

	async objectExists(key: string): Promise<boolean> {
		const normalizedKey = this.normalizeCosObjectKey(key);
		const config = getCosRuntimeConfig();
		assertCosRuntimeConfig(config);
		const cos = this.getCosClient();
		try {
			await cos.headObject({
				Bucket: config.bucket,
				Region: config.region,
				Key: normalizedKey,
			});
			return true;
		} catch {
			return false;
		}
	}

	/** ponytail: 按 ebooks/{uuid} 前缀列举，修复历史中文文件名键 */
	async resolveCosObjectKey(storedKey: string): Promise<string> {
		const key = storedKey?.replace(/^\//, '').trim();
		if (!key || !isCosObjectKey(key)) {
			throw new HttpException('无效的 COS 对象键', HttpStatus.BAD_REQUEST);
		}
		if (await this.objectExists(key)) return key;

		const uuidMatch = key.match(
			/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
		);
		if (!uuidMatch) return key;

		const config = getCosRuntimeConfig();
		assertCosRuntimeConfig(config);
		const cos = this.getCosClient();
		const prefix = `ebooks/${uuidMatch[1]}`;
		const result = await cos.getBucket({
			Bucket: config.bucket,
			Region: config.region,
			Prefix: prefix,
			MaxKeys: 20,
		});
		const objects = (result.Contents ?? []).filter(
			(item) => item.Key && !item.Key.endsWith('/'),
		);
		if (objects.length === 1) return objects[0].Key!;
		const epub = objects.find((item) =>
			item.Key?.toLowerCase().endsWith('.epub'),
		);
		if (epub?.Key) return epub.Key;
		return key;
	}

	async uploadEbookAssetBuffer(params: {
		bookId: string;
		relativePath: string;
		buffer: Buffer;
		mimetype: string;
	}): Promise<string> {
		const config = getCosRuntimeConfig();
		assertCosRuntimeConfig(config);
		const safeName = basename(params.relativePath).replace(/[/\\]/g, '_');
		const key = `ebooks/assets/${params.bookId}/${randomUUID()}_${safeName}`;
		const cos = this.getCosClient();
		try {
			await cos.putObject({
				Bucket: config.bucket,
				Region: config.region,
				Key: key,
				Body: params.buffer,
				ContentType: params.mimetype || 'application/octet-stream',
				ACL: config.objectAcl,
			});
		} catch (error) {
			throw new HttpException(
				formatCosUploadError(error),
				HttpStatus.BAD_GATEWAY,
			);
		}
		return this.buildCosPublicUrl(key);
	}

	/** 从 COS 读取对象字节（小对象场景；大文件请用 pipeObjectToWritable） */
	async getObjectBuffer(key: string): Promise<Buffer> {
		const normalizedKey = this.normalizeCosObjectKey(
			await this.resolveCosObjectKey(key),
		);
		const config = getCosRuntimeConfig();
		assertCosRuntimeConfig(config);
		const cos = this.getCosClient();

		try {
			const result = await cos.getObject({
				Bucket: config.bucket,
				Region: config.region,
				Key: normalizedKey,
			});
			const body = result.Body as Buffer | Uint8Array | undefined;
			if (!body) {
				throw new Error('COS 对象为空');
			}
			return Buffer.isBuffer(body) ? body : Buffer.from(body);
		} catch (error) {
			throw new HttpException(
				formatCosUploadError(error),
				HttpStatus.BAD_GATEWAY,
			);
		}
	}

	/** 从本地文件流式上传至 COS（避免 multer 整包进内存） */
	async uploadLocalFileToCos(params: {
		localPath: string;
		originalname: string;
		mimetype?: string;
		size: number;
		prefix: CosObjectKeyPrefix;
	}) {
		if (!params.localPath || params.size <= 0) {
			throw new HttpException('上传文件为空', HttpStatus.BAD_REQUEST);
		}

		const config = getCosRuntimeConfig();
		assertCosRuntimeConfig(config);

		const key = this.buildCosObjectKey(params.originalname, params.prefix);
		const cos = this.getCosClient();
		const body = createReadStream(params.localPath);

		try {
			await new Promise<void>((resolve, reject) => {
				cos.putObject(
					{
						Bucket: config.bucket,
						Region: config.region,
						Key: key,
						Body: body,
						ContentLength: params.size,
						ContentType: params.mimetype || 'application/octet-stream',
						ACL: config.objectAcl,
					},
					(err) => {
						if (err) reject(err);
						else resolve();
					},
				);
			});
		} catch (error) {
			throw new HttpException(
				formatCosUploadError(error),
				HttpStatus.BAD_GATEWAY,
			);
		}

		const originalname = decodeChineseFilename(params.originalname);
		return {
			key,
			url: this.buildCosPublicUrl(key),
			originalname,
			filename: basename(key),
			mimetype: params.mimetype,
			size: params.size,
		};
	}

	async deleteCosObject(key: string) {
		const normalizedKey = key?.replace(/^\//, '').trim();
		if (!normalizedKey || !isCosObjectKey(normalizedKey)) {
			throw new HttpException('无效的 COS 对象键', HttpStatus.BAD_REQUEST);
		}

		const config = getCosRuntimeConfig();
		assertCosRuntimeConfig(config);
		const cos = this.getCosClient();

		try {
			await cos.deleteObject({
				Bucket: config.bucket,
				Region: config.region,
				Key: normalizedKey,
			});
			return { message: '删除成功', key: normalizedKey };
		} catch (error) {
			throw new HttpException(
				formatCosUploadError(error),
				HttpStatus.BAD_GATEWAY,
			);
		}
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
