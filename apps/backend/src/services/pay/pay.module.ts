import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipService } from './membership.service';
import { MembershipPaymentGrant } from './membership-payment-grant.entity';
import { PayController } from './pay.controller';
import { PayService } from './pay.service';

@Module({
	imports: [ConfigModule, TypeOrmModule.forFeature([MembershipPaymentGrant])],
	controllers: [PayController],
	providers: [PayService, MembershipService],
	exports: [PayService, MembershipService],
})
export class PayModule {}
