import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { EmailEnum } from '../enum/config.enum';
import { getEnvConfig } from '../utils';

const config = getEnvConfig();

@Module({
	imports: [
		MailerModule.forRootAsync({
			useFactory: () => ({
				transport: config[EmailEnum.EMAIL_TRANSPORT],
				// transport: 'smtps://925419516@qq.com:dnjqczdqtbofbdgd@smtp.qq.com',
				defaults: {
					from: `"dnhyxc-ai" <${config[EmailEnum.EMAIL_FROM]}>`,
				},
				template: {
					dir: `${__dirname}/templates`,
					adapter: new HandlebarsAdapter(),
					options: {
						strict: true,
					},
				},
			}),
		}),
	],
})
export class MailModule {}
