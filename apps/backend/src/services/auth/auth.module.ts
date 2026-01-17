import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigEnum } from '../../enum/config.enum';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './auth.strategy';
import { CaslAbilityService } from './casl-ability.service';

@Global() // 将 exports: [CaslAbilityService] 导出的 CaslAbilityService 模块标记为全局模块
@Module({
	imports: [
		UserModule,
		PassportModule, // PassportModule 提供基于 Passport 的认证策略支持，供本地、JWT 等策略使用
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: (configService: ConfigService) => ({
				// jwt 密钥
				secret: configService.get(ConfigEnum.SECRET),
				signOptions: {
					// 设置全局过期时间
					expiresIn: '1d',
				},
			}),
			inject: [ConfigService],
		}),
	],
	providers: [AuthService, JwtStrategy, CaslAbilityService],
	controllers: [AuthController],
	exports: [CaslAbilityService, AuthService], // 导出 casl 模块，用于其他模块使用
})
export class AuthModule {}
