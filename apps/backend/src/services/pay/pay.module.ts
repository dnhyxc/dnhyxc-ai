import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PayController } from './pay.controller';
import { PayService } from './pay.service';

@Module({
	imports: [ConfigModule],
	controllers: [PayController],
	providers: [PayService],
	exports: [PayService],
})
export class PayModule {}
