import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigEnum } from '../../enum/config.enum';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './auth.strategy';
import { CaslAbilityService } from './casl-ability.service';
import { UserWechat } from './wechat/user-wechat.entity';
import { WechatMiniProgramService } from './wechat/wechat-mini-program.service';

@Global()
@Module({
	imports: [
		UserModule,
		TypeOrmModule.forFeature([UserWechat]),
		PassportModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: (configService: ConfigService) => ({
				// jwt 密钥
				secret: configService.get(ConfigEnum.SECRET),
				signOptions: {
					// 设置全局过期时间
					expiresIn: '7d',
				},
			}),
			inject: [ConfigService],
		}),
	],
	providers: [
		AuthService,
		JwtStrategy,
		CaslAbilityService,
		WechatMiniProgramService,
	],
	controllers: [AuthController],
	exports: [CaslAbilityService, AuthService], // 导出 casl 模块，用于其他模块使用
})
export class AuthModule {}
