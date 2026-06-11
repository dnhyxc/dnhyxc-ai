import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { QueryFailedError, Repository } from 'typeorm';

import { UserService } from '../user/user.service';
import {
	DEFAULT_MEMBERSHIP_TYPE,
	parseMembershipDaysFromMetadata,
	resolveMembershipDays,
} from './membership.constants';
import { MembershipPaymentGrant } from './membership-payment-grant.entity';

const GRANT_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

@Injectable()
export class MembershipService {
	private readonly logger = new Logger(MembershipService.name);

	constructor(
		private readonly userService: UserService,
		@InjectRepository(MembershipPaymentGrant)
		private readonly grantRepo: Repository<MembershipPaymentGrant>,
		@Inject(CACHE_MANAGER) private readonly cache: Cache,
	) {}

	private grantCacheKey(grantId: string): string {
		return `pay:membership:grant:${grantId}`;
	}

	private isDuplicateGrantError(error: unknown): boolean {
		if (!(error instanceof QueryFailedError)) return false;
		const driverError = error.driverError as { code?: string } | undefined;
		return (
			driverError?.code === '23505' || driverError?.code === 'ER_DUP_ENTRY'
		);
	}

	private async loadMembershipPayloadForGrant(
		grantId: string,
		userId: number,
	): Promise<{
		isMember: boolean;
		membershipType: string;
		memberExpiresAt: Date | null;
	}> {
		await this.cache.set(
			this.grantCacheKey(grantId),
			String(userId),
			GRANT_CACHE_TTL_MS,
		);
		const user = await this.userService.findOne(userId);
		if (!user) {
			throw new Error(`Membership grant user not found userId=${userId}`);
		}
		return this.userService.toMembershipPayload(user);
	}

	async grantAfterPayment(
		userId: number,
		opts: {
			grantId: string;
			membershipDays?: number;
			membershipType?: string;
		},
	): Promise<{
		isMember: boolean;
		membershipType: string;
		memberExpiresAt: Date | null;
	}> {
		const cacheKey = this.grantCacheKey(opts.grantId);
		const cachedUserId = await this.cache.get<string>(cacheKey);
		if (cachedUserId != null && Number(cachedUserId) === userId) {
			return this.loadMembershipPayloadForGrant(opts.grantId, userId);
		}

		// 先写入幂等记录再开通：Webhook 与 completeCheckoutMembership 并发时，
		// Redis get/set 无法原子去重，会导致同一笔支付叠加两次时长。
		try {
			await this.grantRepo.insert({
				grantId: opts.grantId,
				userId,
			});
		} catch (error) {
			if (this.isDuplicateGrantError(error)) {
				this.logger.log(
					`Membership grant skipped (duplicate) userId=${userId} grantId=${opts.grantId}`,
				);
				return this.loadMembershipPayloadForGrant(opts.grantId, userId);
			}
			throw error;
		}

		const durationDays = resolveMembershipDays(opts.membershipDays);
		const user = await this.userService.grantMembership(userId, {
			durationDays,
			membershipType: opts.membershipType ?? DEFAULT_MEMBERSHIP_TYPE,
		});
		await this.cache.set(cacheKey, String(userId), GRANT_CACHE_TTL_MS);
		this.logger.log(
			`Membership granted userId=${userId} grantId=${opts.grantId} days=${durationDays} expires=${user.memberExpiresAt?.toISOString() ?? '-'}`,
		);
		return this.userService.toMembershipPayload(user);
	}

	parseStripeSessionMembership(
		metadata: Record<string, string> | null | undefined,
	): {
		userId: number | null;
		membershipDays: number;
		membershipType: string;
	} {
		const userIdRaw =
			metadata?.userId ?? metadata?.user_id ?? metadata?.userid ?? null;
		const userId =
			userIdRaw != null && String(userIdRaw).trim() !== ''
				? Number.parseInt(String(userIdRaw), 10)
				: Number.NaN;
		return {
			userId: Number.isFinite(userId) ? userId : null,
			membershipDays: parseMembershipDaysFromMetadata(
				metadata?.membershipDays ?? metadata?.membership_days,
				metadata?.membershipPlan ?? metadata?.membership_plan,
			),
			membershipType:
				metadata?.membershipType?.trim() ||
				metadata?.membership_type?.trim() ||
				DEFAULT_MEMBERSHIP_TYPE,
		};
	}
}
