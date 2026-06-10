import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MembershipService } from './membership.service';
import { PayController } from './pay.controller';
import { PayService } from './pay.service';

@Module({
	imports: [ConfigModule],
	controllers: [PayController],
	providers: [PayService, MembershipService],
	exports: [PayService, MembershipService],
})
export class PayModule {}
