import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as qiniu from 'qiniu';
import { FileEnum, QiniuEnum } from '../../enum/config.enum';
import { getEnvConfig } from '../../utils';
import { IMAGE_EXTS } from './upload.enum';

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
		console.log(
			'fullPath',
			fullPath,
			toReplace,
			fullPath.replace(rootPath, '').replace(/\\/g, '/'),
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
}
