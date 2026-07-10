import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WechatEnum } from '../../../enum/config.enum';

type Code2SessionResult = {
	openid: string;
	session_key: string;
	unionid?: string;
	errcode?: number;
	errmsg?: string;
};

@Injectable()
export class WechatMiniProgramService {
	constructor(private readonly configService: ConfigService) {}

	async code2Session(
		code: string,
	): Promise<{ openid: string; unionid?: string }> {
		const appid = this.configService.get<string>(
			WechatEnum.WECHAT_MINIPROGRAM_APPID,
		);
		const secret = this.configService.get<string>(
			WechatEnum.WECHAT_MINIPROGRAM_SECRET,
		);
		if (!appid || !secret) {
			throw new HttpException(
				'未配置微信小程序 AppID/Secret',
				HttpStatus.SERVICE_UNAVAILABLE,
			);
		}
		const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
		url.searchParams.set('appid', appid);
		url.searchParams.set('secret', secret);
		url.searchParams.set('js_code', code);
		url.searchParams.set('grant_type', 'authorization_code');

		const res = await fetch(url.toString());
		const data = (await res.json()) as Code2SessionResult;
		if (data.errcode || !data.openid) {
			throw new HttpException(
				data.errmsg || '微信登录失败',
				HttpStatus.BAD_REQUEST,
			);
		}
		return { openid: data.openid, unionid: data.unionid };
	}

	getAppId(): string {
		return (
			this.configService.get<string>(WechatEnum.WECHAT_MINIPROGRAM_APPID) ?? ''
		);
	}
}
