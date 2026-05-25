import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { decodeChineseFilename } from '../../utils';
import {
	ensureUploadDir,
	getUploadFilesDir,
	getUploadImagesDir,
} from '../../utils/upload-paths';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

const UPLOAD_IMAGES_DIR = getUploadImagesDir(__dirname);
const UPLOAD_FILES_DIR = getUploadFilesDir(__dirname);

@Module({
	imports: [
		MulterModule.register({
			storage: diskStorage({
				destination: (_req, file, cb) => {
					const uploadPath = file.mimetype.startsWith('image/')
						? UPLOAD_IMAGES_DIR
						: UPLOAD_FILES_DIR;

					ensureUploadDir(uploadPath);
					cb(null, uploadPath);
				},
				filename: (_req, file, cb) => {
					// 处理中文文件名编码问题
					const originalname = decodeChineseFilename(file.originalname);
					const filename = `${randomUUID()}_${originalname}`;
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
