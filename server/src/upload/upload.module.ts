import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
	imports: [
		MulterModule.register({
			storage: diskStorage({
				// destination: join(__dirname, '../../uploads'),
				// 动态设置文件保存路径
				destination: (_req, file, cb) => {
					let uploadPath: string;

					// 检查文件类型
					const fileType = file.mimetype;

					if (fileType.startsWith('image/')) {
						// 图片文件
						uploadPath = join(__dirname, '../../uploads/images');
					} else {
						// 其他文件（如PDF）
						uploadPath = join(__dirname, '../../uploads/files');
					}

					// 确保目录存在
					if (!existsSync(uploadPath)) {
						mkdirSync(uploadPath, { recursive: true });
					}

					cb(null, uploadPath);
				},
				filename: (_req, file, cb) => {
					const filename = `${randomUUID()}_${file.originalname}`;
					cb(null, filename);
				},
			}),
			// fileFilter: (_req, file, cb) => {
			// 	// 如果只想允许特定类型：
			// 	const allowedMimes = ['image/jpeg', 'image/png', 'image/gif'];
			// 	if (allowedMimes.includes(file.mimetype)) {
			// 		cb(null, true);
			// 	} else {
			// 		cb(new HttpException('该文件类型不支持上传', 406), false);
			// 	}
			// },
			limits: {
				fileSize: 1024 * 1024 * 20, // 20MB
			},
		}),
	],
	controllers: [UploadController],
	providers: [UploadService],
})
export class UploadModule {}
