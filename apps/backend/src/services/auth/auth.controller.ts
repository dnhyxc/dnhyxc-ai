import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	Get,
	HttpException,
	HttpStatus,
	NotAcceptableException,
	Post,
	Req,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtGuard } from '../../guards/jwt.guard';
import { ResponseInterceptor } from '../../interceptors/response.interceptor';
import {
	SendResetPasswordEmailDTO,
	UpdatePasswordDTO,
} from '../user/dto/update-user.dto';
import { SwaggerUpdateUser } from '../user/user.swagger';
import { AuthService } from './auth.service';
import { CaptchaDto } from './dto/captcha.dto';
import { EmailOptionsDTO } from './dto/email.dto';
import { LoginByEmailDTO, LoginUserDTO } from './dto/login-user.dto';
import { RegisterUserDTO } from './dto/register-user.dto';
import { WechatBindDto } from './dto/wechat-bind.dto';
import { WechatLoginDto } from './dto/wechat-login.dto';
import { WechatAuthService } from './wechat/wechat-auth.service';

type AuthedRequest = Request & { user?: { userId?: number } };

function requireUserId(req: AuthedRequest): number {
	const userId = req.user?.userId;
	if (!userId) {
		throw new HttpException('请先登录后再试', HttpStatus.UNAUTHORIZED);
	}
	return userId;
}

@Controller('auth')
// 使用 ClassSerializerInterceptor 拦截器 将 entry.ts 中通过 Exclude() 注解的属性过滤掉
@UseInterceptors(ClassSerializerInterceptor, ResponseInterceptor)
// @UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
	constructor(
		private authService: AuthService,
		private wechatAuthService: WechatAuthService,
	) {}

	@Post('/login')
	async login(@Body() dto: LoginUserDTO) {
		return await this.authService.login(dto);
	}

	@Post('/loginByEmail')
	async loginByEmail(@Body() dto: LoginByEmailDTO) {
		return await this.authService.loginByEmail(dto);
	}

	@Post('/wechat/login')
	async loginByWechat(@Body() dto: WechatLoginDto) {
		return await this.wechatAuthService.login(dto);
	}

	@Post('/wechat/bind')
	async bindWechat(@Body() dto: WechatBindDto) {
		return await this.wechatAuthService.bind(dto);
	}

	@Post('/wechat/link-code')
	@UseGuards(JwtGuard)
	async createWechatLinkCode(@Req() req: AuthedRequest) {
		return await this.wechatAuthService.createLinkCode(requireUserId(req));
	}

	@Get('/wechat/status')
	@UseGuards(JwtGuard)
	async wechatStatus(@Req() req: AuthedRequest) {
		return await this.wechatAuthService.status(requireUserId(req));
	}

	@Post('/wechat/unbind')
	@UseGuards(JwtGuard)
	async unbindWechat(@Req() req: AuthedRequest) {
		return await this.wechatAuthService.unbind(requireUserId(req));
	}

	@Post('/register')
	// @UseInterceptors(SerializeInterceptor)
	async register(@Body() dto: RegisterUserDTO) {
		return await this.authService.register(dto);
	}

	@Post('/createVerifyCode')
	async createVerifyCode(@Body() dto: CaptchaDto) {
		return await this.authService.createVerifyCode(dto);
	}

	@Post('/sendEmail')
	async sendEmail(
		@Body('email') email: string,
		@Body('options') options?: EmailOptionsDTO,
	) {
		return await this.authService.sendEmail(email, options);
	}

	@Post('/sendResetPwdEmail')
	@SwaggerUpdateUser()
	async sendResetPwdEmail(@Body() dto: SendResetPasswordEmailDTO) {
		// 使用 jwt Passport 向 req 上添加的 user 信息，对比较用户 id，如果不是本人将无法修改信息
		const res = await this.authService.sendResetPwdEmail({
			username: dto.username,
			email: dto.email,
		});
		if (res) {
			return res;
		} else {
			throw new NotAcceptableException('邮箱发送失败');
		}
	}

	@Post('/resetPassword')
	@SwaggerUpdateUser()
	async resetPassword(@Body() dto: UpdatePasswordDTO) {
		// 使用 jwt Passport 向 req 上添加的 user 信息，对比较用户 id，如果不是本人将无法修改信息
		const verify = await this.authService.verifyEmail(
			dto.verifyCodeKey,
			dto.verifyCode,
		);
		if (!verify) {
			throw new HttpException('邮箱验证码错误', HttpStatus.BAD_REQUEST);
		}
		const res = await this.authService.resetPassword(dto);
		if (res) {
			return res;
		} else {
			throw new NotAcceptableException('邮箱更新失败');
		}
	}
}
