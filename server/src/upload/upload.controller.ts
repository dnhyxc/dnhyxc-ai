import {
	Controller,
	Get,
	HttpException,
	Post,
	UploadedFile,
	UploadedFiles,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtGuard } from 'src/guards/jwt.guard';
import { ResponseInterceptor } from '../interceptors/response.interceptor';
import { UploadService } from './upload.service';

@Controller('upload')
// 设置响应拦截器
@UseInterceptors(ResponseInterceptor)
@UseGuards(JwtGuard)
export class UploadController {
	constructor(private readonly uploadService: UploadService) {}

	// 获取七牛云文件上传token
	@Get('/getUploadToken')
	async getUploadToken() {
		return await this.uploadService.getUploadToken();
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
			return res;
		} catch (error) {
			throw new HttpException(error.message || '上传失败', 500);
		}
	}
}
