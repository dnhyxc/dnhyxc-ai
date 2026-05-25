import { existsSync, unlink } from 'node:fs';
import { extname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as qiniu from 'qiniu';
import { QiniuEnum } from '../../enum/config.enum';
import { getEnvConfig } from '../../utils';
import {
	getAllowedUploadRoots,
	resolveStoredUploadAbsolutePath,
	toUploadPublicPath,
} from '../../utils/upload-paths';
import { IMAGE_EXTS } from './upload.enum';

// 将 unlink 包装为 Promise 以便 async/await 使用
const unlinkAsync = promisify(unlink);

@Injectable()
export class UploadService {
	getUploadToken() {
		const config = getEnvConfig();
		const accessKey = config[QiniuEnum.ACCESS_KEY];
		const secretKey = config[QiniuEnum.SECRET_KEY];
		const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
		const options = {
			scope: config[QiniuEnum.BUCKET_NAME],
		};
		const putPolicy = new qiniu.rs.PutPolicy(options);
		const uploadToken = putPolicy.uploadToken(mac);
		if (uploadToken) {
			return uploadToken;
		} else {
			throw new HttpException('获取上传凭证失败', HttpStatus.BAD_REQUEST);
		}
	}

	// 获取静态资源访问路径（/images/... 或 /files/...）
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

	// download
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
