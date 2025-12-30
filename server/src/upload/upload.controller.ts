import {
	Controller,
	Get,
	HttpException,
	Post,
	UploadedFile,
	UploadedFiles,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
	constructor(private readonly uploadService: UploadService) {}

	// 获取七牛云文件上传token
	@Get('/getUploadToken')
	async getUploadToken() {
		const res = await this.uploadService.getUploadToken();
		return {
			code: 200,
			data: res,
			success: true,
			message: '获取上传凭证成功',
		};
	}

	@Post('/uploadFile')
	// FileInterceptor 上传单个文件，FilesInterceptor 上传多个
	@UseInterceptors(FileInterceptor('file'))
	async upload(@UploadedFile() file: Express.Multer.File) {
		try {
			const filePath = this.uploadService.getStaticPath(
				file.path,
				file.mimetype,
			);
			return {
				message: '图片上传成功',
				code: 200,
				success: true,
				filename: file.filename,
				path: filePath,
				mimetype: file.mimetype,
				size: file.size,
			};
		} catch (error) {
			throw new HttpException(error?.message || '上传失败', 500);
		}
	}

	@Post('/uploadFiles')
	// FileInterceptor 上传单个文件，FilesInterceptor 上传多个
	@UseInterceptors(FilesInterceptor('file'))
	async uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
		try {
			const res = files.map((file) => {
				const filePath = this.uploadService.getStaticPath(
					file.path,
					file.mimetype,
				);
				return {
					filename: file.filename,
					path: filePath,
					mimetype: file.mimetype,
					size: file.size,
				};
			});
			return {
				data: res,
				message: '上传成功',
				code: 200,
				success: true,
			};
		} catch (error) {
			throw new HttpException(error.message || '上传失败', 500);
		}
	}
}
