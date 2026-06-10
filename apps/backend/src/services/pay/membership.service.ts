import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';

import { UserService } from '../user/user.service';
import {
	DEFAULT_MEMBERSHIP_TYPE,
	parseMembershipDaysFromMetadata,
	resolveMembershipDays,
} from './membership.constants';

const GRANT_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

@Injectable()
export class MembershipService {
	private readonly logger = new Logger(MembershipService.name);

	constructor(
		private readonly userService: UserService,
		@Inject(CACHE_MANAGER) private readonly cache: Cache,
	) {}

	private grantCacheKey(grantId: string): string {
		return `pay:membership:grant:${grantId}`;
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
			const user = await this.userService.findOne(userId);
			if (user) {
				return this.userService.toMembershipPayload(user);
			}
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
