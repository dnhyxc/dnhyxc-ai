import { HttpException, Injectable } from '@nestjs/common';
import * as qiniu from 'qiniu';
import { QiniuEnum } from '../enum/config.enum';
import { getEnvConfig } from '../utils';

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
			throw new HttpException('获取上传凭证失败', 500);
		}
	}
}
