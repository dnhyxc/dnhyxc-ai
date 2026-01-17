import {
	Controller,
	Get,
	HttpException,
	HttpStatus,
	Post,
	Query,
	Res,
	UploadedFile,
	UploadedFiles,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { zip } from 'compressing';
import type { Response } from 'express';
import { JwtGuard } from '../../guards/jwt.guard';
import { ResponseInterceptor } from '../../interceptors/response.interceptor';
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
			throw new HttpException(
				error?.message || '上传失败',
				HttpStatus.BAD_REQUEST,
			);
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
			throw new HttpException(
				error.message || '上传失败',
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	@Get('/download')
	async download(
		@Query('filename') filename: string,
		@Query('toReplace') toReplace: boolean = true,
		@Res() res: Response,
	) {
		try {
			const url = this.uploadService.download(filename, toReplace);
			if (toReplace) {
				res.send(url);
			} else {
				res.download(url);
			}
		} catch (error) {
			throw new HttpException(
				error.message || '下载失败',
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	@Get('/downloadZip')
	async downloadZip(
		@Query('filename') filename: string,
		@Query('toReplace') toReplace: boolean = false,
		@Res() res: Response,
	) {
		try {
			const url = this.uploadService.download(filename, toReplace);
			const stream = new zip.Stream();
			await stream.addEntry(url);
			res.setHeader('Content-Type', 'application/octet-stream');
			res.setHeader(
				'Content-Disposition',
				`attachment; filename="${filename.replace(/\.[^.]+$/, '')}.zip"`,
			);
			stream.pipe(res);
			return true;
		} catch (error) {
			throw new HttpException(
				error.message || '下载失败',
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
