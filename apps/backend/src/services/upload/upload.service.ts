import { existsSync, unlink } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as qiniu from 'qiniu';
import { FileEnum, QiniuEnum } from '../../enum/config.enum';
import { getEnvConfig } from '../../utils';
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

	// 获取静态资源访问路径
	getStaticPath(filePath: string, mimetype: string): string {
		// 获取上传根目录
		const uploadsRootPath = join(__dirname, '..', '..', 'uploads');
		if (mimetype.startsWith('image/')) {
			const relativePath = filePath
				.replace(uploadsRootPath, '')
				.replace(/\\/g, '/');
			return `${relativePath}`;
		} else {
			// 计算相对于 files 目录的路径
			const relativePath = filePath
				.replace(uploadsRootPath, '')
				.replace(/\\/g, '/');
			return `${relativePath}`;
		}
	}

	getStaticUrl(filename: string, floderName?: string, toReplace?: boolean) {
		const config = getEnvConfig();
		const rootPath = join(__dirname, config[FileEnum.FILE_ROOT]);
		const fullPath = join(
			__dirname,
			`${config[FileEnum.FILE_ROOT]}/${floderName}`,
			filename,
		);

		if (existsSync(fullPath)) {
			return toReplace
				? fullPath.replace(rootPath, '').replace(/\\/g, '/')
				: fullPath;
		} else {
			throw new HttpException('文件不存在', HttpStatus.BAD_REQUEST);
		}
	}

	// download
	download(filename: string, toReplace?: boolean) {
		let filePath = '';
		const isImage = IMAGE_EXTS.includes(extname(filename).toLowerCase());
		if (isImage) {
			filePath = this.getStaticUrl(filename, 'images', toReplace);
		} else {
			filePath = this.getStaticUrl(filename, 'files', toReplace);
		}
		return filePath;
	}

	// delete file
	// 新增：删除文件方法
	async deleteFile(filename: string) {
		if (!filename) {
			throw new HttpException('文件名不能为空', HttpStatus.BAD_REQUEST);
		}

		// 1. 获取文件绝对路径 (复用 download 逻辑，toReplace=false 获取绝对路径)
		// 注意：这里捕获错误，如果文件不存在，download 会抛出异常，直接向上抛即可
		let absolutePath = '';
		try {
			absolutePath = this.download(filename, false);
		} catch (_e) {
			throw new HttpException('文件不存在或路径错误', HttpStatus.NOT_FOUND);
		}

		// 2. 安全校验：防止目录遍历攻击
		// 确保解析后的路径在配置的根目录内
		const config = getEnvConfig();
		const rootPath = resolve(__dirname, config[FileEnum.FILE_ROOT]);
		// 使用 resolve 标准化路径，消除 .. 等
		const normalizedPath = resolve(absolutePath);

		if (!normalizedPath.startsWith(rootPath)) {
			throw new HttpException('非法的文件路径', HttpStatus.FORBIDDEN);
		}

		// 3. 执行删除
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
