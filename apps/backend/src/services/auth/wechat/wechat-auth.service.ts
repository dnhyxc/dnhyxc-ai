import { randomUUID } from 'node:crypto';
import { Cache } from '@nestjs/cache-manager';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { comparePassword } from '../../../utils';
import { User } from '../../user/user.entity';
import { UserService } from '../../user/user.service';
import { wechatUnbindCacheKey } from '../auth.strategy';
import { WechatBindDto } from '../dto/wechat-bind.dto';
import { WechatLoginDto } from '../dto/wechat-login.dto';
import { UserWechat } from './user-wechat.entity';
import { WechatMiniProgramService } from './wechat-mini-program.service';

const BIND_TTL_MS = 5 * 60 * 1000;
const LINK_TTL_MS = 5 * 60 * 1000;
/** 与 JWT 全局过期一致，解绑后标记微信 token 失效 */
const WECHAT_UNBIND_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type BindSession = {
	openid: string;
	appid: string;
	unionid?: string;
	scene: string;
};

type LinkSession = {
	userId: number;
};

function maskOpenId(openid: string): string {
	if (openid.length <= 8) return `${openid.slice(0, 2)}***`;
	return `${openid.slice(0, 4)}***${openid.slice(-4)}`;
}

function randomLinkCode(): string {
	return String(Math.floor(100000 + Math.random() * 900000));
}

/** 旧版自动注册产生的占位账号，不算已关联 Web */
function isPlaceholderWxUser(user: User): boolean {
	const email = user.email?.toLowerCase() ?? '';
	const username = user.username ?? '';
	return email.endsWith('@wx.local') || username.startsWith('wx_');
}

@Injectable()
export class WechatAuthService {
	constructor(
		private readonly userService: UserService,
		private readonly jwt: JwtService,
		private readonly cache: Cache,
		private readonly wechatMiniProgramService: WechatMiniProgramService,
		@InjectRepository(UserWechat)
		private readonly userWechatRepo: Repository<UserWechat>,
	) {}

	async login(dto: WechatLoginDto) {
		if (dto.scene !== 'mini_program') {
			throw new HttpException('暂仅支持小程序登录', HttpStatus.BAD_REQUEST);
		}
		const { openid, unionid } =
			await this.wechatMiniProgramService.code2Session(dto.code);
		const appid = this.wechatMiniProgramService.getAppId();
		const mapping = await this.userWechatRepo.findOne({
			where: { scene: dto.scene, appid, openid },
		});

		if (mapping) {
			const user = await this.userService.findOne(mapping.userId);
			if (!user) {
				await this.userWechatRepo.delete(mapping.id);
			} else if (isPlaceholderWxUser(user)) {
				// ponytail: 清除旧自动注册映射，强制走 Web 绑定
				await this.userWechatRepo.delete(mapping.id);
			} else {
				mapping.lastLoginAt = new Date();
				await this.userWechatRepo.save(mapping);
				return this.issueToken(user, true);
			}
		}

		const bind_token = randomUUID();
		const session: BindSession = {
			openid,
			appid,
			unionid,
			scene: dto.scene,
		};
		await this.cache.set(`wechat-bind:${bind_token}`, session, BIND_TTL_MS);

		return {
			need_bind: true,
			bind_token,
			wechat: {
				openidMasked: maskOpenId(openid),
				scene: dto.scene,
			},
		};
	}

	async createLinkCode(userId: number) {
		const existing = await this.userWechatRepo.findOne({ where: { userId } });
		if (existing) {
			throw new HttpException('当前账号已关联微信', HttpStatus.CONFLICT);
		}

		const code = randomLinkCode();
		await this.cache.set(
			`wechat-link:${code}`,
			{ userId } satisfies LinkSession,
			LINK_TTL_MS,
		);

		return {
			link_code: code,
			expires_in: LINK_TTL_MS / 1000,
		};
	}

	async bind(dto: WechatBindDto) {
		const session = (await this.cache.get(`wechat-bind:${dto.bind_token}`)) as
			| BindSession
			| undefined;
		if (!session) {
			throw new HttpException(
				'绑定会话已过期，请重新登录',
				HttpStatus.BAD_REQUEST,
			);
		}

		let targetUserId: number | null = null;

		if (dto.link_code) {
			const link = (await this.cache.get(`wechat-link:${dto.link_code}`)) as
				| LinkSession
				| undefined;
			if (!link) {
				throw new HttpException('关联码无效或已过期', HttpStatus.BAD_REQUEST);
			}
			targetUserId = link.userId;
			await this.cache.del(`wechat-link:${dto.link_code}`);
		} else if (dto.username && dto.password) {
			const loginId = dto.username.trim();
			const user =
				(await this.userService.findByUsername(loginId)) ??
				(await this.userService.findByEmail(loginId));
			if (!user) {
				throw new HttpException('用户不存在', HttpStatus.BAD_REQUEST);
			}
			const ok = await comparePassword(dto.password, user.password);
			if (!ok) {
				throw new HttpException('用户名或密码错误', HttpStatus.BAD_REQUEST);
			}
			targetUserId = user.id;
		} else {
			throw new HttpException(
				'请提供 Web 关联码或账号密码',
				HttpStatus.BAD_REQUEST,
			);
		}

		const boundUser = await this.userWechatRepo.findOne({
			where: { userId: targetUserId! },
		});
		if (boundUser) {
			throw new HttpException('该 Web 账号已关联其他微信', HttpStatus.CONFLICT);
		}

		const conflict = await this.userWechatRepo.findOne({
			where: {
				scene: session.scene,
				appid: session.appid,
				openid: session.openid,
			},
		});
		if (conflict) {
			throw new HttpException('该微信已关联其他账号', HttpStatus.CONFLICT);
		}

		const mapping = this.userWechatRepo.create({
			userId: targetUserId!,
			scene: session.scene,
			appid: session.appid,
			openid: session.openid,
			unionid: session.unionid ?? null,
			lastLoginAt: new Date(),
		});
		await this.userWechatRepo.save(mapping);
		await this.cache.del(`wechat-bind:${dto.bind_token}`);
		await this.cache.del(wechatUnbindCacheKey(targetUserId!));

		const user = await this.userService.findOne(targetUserId!);
		if (!user) {
			throw new HttpException('用户不存在', HttpStatus.BAD_REQUEST);
		}
		return this.issueToken(user, true);
	}

	async status(userId: number) {
		const mapping = await this.userWechatRepo.findOne({ where: { userId } });
		if (!mapping) {
			return { bound: false };
		}
		return {
			bound: true,
			openidMasked: maskOpenId(mapping.openid),
			lastLoginAt: mapping.lastLoginAt,
		};
	}

	async unbind(userId: number) {
		const mapping = await this.userWechatRepo.findOne({ where: { userId } });
		if (!mapping) {
			throw new HttpException('未关联微信', HttpStatus.BAD_REQUEST);
		}
		await this.userWechatRepo.delete(mapping.id);
		await this.cache.set(
			wechatUnbindCacheKey(userId),
			Date.now(),
			WECHAT_UNBIND_CACHE_TTL_MS,
		);
		return { success: true };
	}

	private issueToken(user: User, webLinked: boolean) {
		const { password, ...userInfo } = user;
		return this.jwt
			.signAsync({
				username: userInfo.username,
				sub: userInfo.id,
				wechat: true,
			})
			.then((token) => ({
				access_token: token,
				web_linked: webLinked,
				...userInfo,
			}));
	}
}
