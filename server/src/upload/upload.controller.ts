import { Controller, Get } from '@nestjs/common';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
	constructor(private readonly uploadService: UploadService) {}

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
}
