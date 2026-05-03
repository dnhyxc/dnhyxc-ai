import Image from '@design/Image';
import { Button } from '@ui/button';
import { ScrollArea } from '@ui/scroll-area';
import { ArrowRight, Check, CreditCard, Crown, Settings2 } from 'lucide-react';
import { observer } from 'mobx-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import ICON from '@/assets/icon.png';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import useStore from '@/store';
import { resolveQiniuUrlForWebDisplay } from '@/utils';

const PROFILE_MEMBERSHIP_BENEFIT_KEYS = [
	'profile.membership.benefit1',
	'profile.membership.benefit2',
	'profile.membership.benefit3',
] as const;

/** 从登录/用户信息中推断是否为付费会员（兼容多种后端字段命名） */
function isPaidMemberFromUserInfo(u: object): boolean {
	const r = u as Record<string, unknown>;
	if (r.isMember === true || r.member === true || r.vip === true) return true;

	const levelPositive = (v: unknown) =>
		(typeof v === 'number' && v > 0) ||
		(typeof v === 'string' &&
			v.trim() !== '' &&
			v !== '0' &&
			!/^(free|none)$/i.test(v.trim()));

	if (
		levelPositive(r.membershipLevel) ||
		levelPositive(r.memberLevel) ||
		levelPositive(r.vipLevel)
	)
		return true;

	const typeRaw = r.membershipType ?? r.memberType ?? r.userMemberType;
	if (typeof typeRaw === 'string') {
		const s = typeRaw.trim().toLowerCase();
		if (['vip', 'pro', 'paid', 'premium', 'plus'].includes(s)) return true;
	}
	return false;
}

function genderLabel(
	gender: unknown,
	t: (key: string, params?: Record<string, string | number>) => string,
): string {
	const g = gender === undefined || gender === null ? '' : String(gender);
	if (g === '1' || g === 'male') return t('account.gender.male');
	if (g === '2' || g === 'female') return t('account.gender.female');
	return t('account.gender.secret');
}

const Profile = observer(() => {
	const { userStore } = useStore();
	const { t, locale } = useI18n();
	const navigate = useNavigate();

	const u = userStore.userInfo;
	const profile = u.profile;
	const avatarSrc = profile?.avatar
		? resolveQiniuUrlForWebDisplay(profile.avatar)
		: ICON;

	const rolesText = useMemo(() => {
		if (!u.roles?.length) return '—';
		return u.roles.map((r) => r.name).join(locale === 'zh-CN' ? '、' : ', ');
	}, [u.roles, locale]);

	/** 与账号设置一致：优先 profile.address，兼容接口顶层 address */
	const addressText = useMemo(() => {
		const fromProfile = (profile as { address?: string }).address;
		const fromUser = (u as { address?: string }).address;
		const raw =
			(typeof fromProfile === 'string' ? fromProfile : '') ||
			(typeof fromUser === 'string' ? fromUser : '');
		const trimmed = raw.trim();
		return trimmed ? trimmed : '—';
	}, [profile, u]);

	const isPaidMember = useMemo(() => isPaidMemberFromUserInfo(u), [u]);

	const infoRows = useMemo(
		() => [
			{
				label: t('account.fields.nickname'),
				value: u.username?.trim() ? u.username : '—',
			},
			{
				label: t('account.fields.email'),
				value: u.email?.trim() ? u.email : '—',
			},
			{
				label: t('account.fields.gender'),
				value: genderLabel(profile?.gender, t),
			},
			{
				label: t('account.fields.address'),
				value: addressText,
			},
			{
				label: t('profile.fields.roles'),
				value: rolesText,
			},
		],
		[t, u.username, u.email, profile?.gender, rolesText, addressText],
	);

	const hasUser = u.id > 0;

	if (!hasUser) {
		return (
			<div className="flex h-full w-full flex-col overflow-hidden m-0">
				<ScrollArea className="h-full w-full overflow-y-auto p-2.5 rounded-none">
					<div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-4 rounded-md bg-theme-secondary px-8 py-16 text-center">
						<p className="text-lg font-semibold text-default">
							{t('profile.empty.title')}
						</p>
						<p className="text-sm text-textcolor/75">
							{t('profile.empty.hint')}
						</p>
						<Button
							className="mt-2 cursor-pointer"
							onClick={() => navigate('/login')}
						>
							{t('profile.actions.goLogin')}
						</Button>
					</div>
				</ScrollArea>
			</div>
		);
	}

	return (
		<div className="flex h-full w-full flex-col overflow-hidden m-0">
			<ScrollArea className="h-full w-full overflow-y-auto p-2.5 pt-0 rounded-none">
				<div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-10">
					{/* 资料大卡：渐变顶栏 + 头像叠层 */}
					<section
						className={cn(
							'overflow-hidden rounded-md border border-theme/15 bg-theme-secondary',
						)}
					>
						<div className="relative px-5 py-5 sm:px-5">
							{/* stretch：右侧栏与左侧头像区域同高；justify-between：上与头像顶对齐、下与头像底对齐 */}
							<div className="flex flex-col items-center gap-5 sm:flex-row sm:items-stretch sm:gap-5">
								<div className="flex shrink-0 flex-col items-center justify-start sm:items-start">
									<div
										className={cn(
											'rounded-md border-4 border-theme-secondary bg-theme-secondary p-0.5',
											'shadow-lg ring-1 ring-theme/10',
										)}
									>
										<Image
											src={avatarSrc}
											fallbackSrc={ICON}
											showOnError
											className={cn(
												'h-24 w-24 rounded-md object-cover sm:h-28 sm:w-28',
												!profile?.avatar && 'object-contain p-4',
											)}
											alt=""
										/>
									</div>
								</div>
								<div className="flex min-h-0 w-full flex-1 flex-col justify-between gap-3 text-center sm:w-auto sm:text-left">
									<div className="min-w-0 space-y-1">
										<div className="flex min-w-0 flex-wrap items-center justify-center gap-2 sm:justify-start">
											<span className="truncate text-xl font-bold tracking-tight text-textcolor sm:text-3xl">
												{u.username || t('nav.profile')}
											</span>
											{isPaidMember ? (
												<span
													className={cn(
														'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5',
														'border-amber-500/40 bg-amber-500/12 text-xs font-semibold',
														'text-amber-900 dark:text-amber-200',
													)}
												>
													<Crown
														className="size-3.5 shrink-0 opacity-90"
														strokeWidth={2}
														aria-hidden
													/>
													{t('profile.badge.member')}
												</span>
											) : (
												<span
													className={cn(
														'inline-flex shrink-0 items-center rounded-md border px-2 py-0.5',
														'border-theme/20 bg-theme/5 text-xs text-textcolor/60',
													)}
												>
													{t('profile.badge.nonMember')}
												</span>
											)}
										</div>
										<p className="truncate text-base text-textcolor/70">
											{u.email || '—'}
										</p>
									</div>
									<div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
										<Button
											variant="default"
											size="sm"
											className="cursor-pointer gap-1.5 border-theme/25 shadow-sm"
											onClick={() => navigate('/account')}
										>
											<Settings2 className="size-4 shrink-0" />
											{t('profile.actions.editAccount')}
										</Button>
										<Button
											variant="default"
											size="sm"
											className="cursor-pointer gap-1.5 font-semibold shadow-sm"
											onClick={() => navigate('/pay')}
										>
											<CreditCard className="size-4 shrink-0" />
											{t('profile.actions.buyMembership')}
											<ArrowRight className="size-4 shrink-0 opacity-90" />
										</Button>
									</div>
								</div>
							</div>
						</div>
						<div className="border-t border-theme/10 px-5 py-4 sm:px-5">
							<h3 className="mb-3 text-sm font-semibold text-textcolor">
								{t('profile.membership.benefitsTitle')}
							</h3>
							<ul className="space-y-2.5 text-sm leading-relaxed text-textcolor/75">
								{PROFILE_MEMBERSHIP_BENEFIT_KEYS.map((key) => (
									<li key={key} className="flex gap-2.5">
										<Check
											className="mt-0.5 size-4 shrink-0 text-teal-500"
											strokeWidth={2.5}
											aria-hidden
										/>
										<span>{t(key)}</span>
									</li>
								))}
							</ul>
						</div>
					</section>

					{/* 基本信息独立卡片 */}
					<section className="rounded-md border border-theme/15 bg-theme-secondary px-5 py-5">
						<h2 className="mb-4 text-base font-semibold text-textcolor">
							{t('profile.section.basic')}
						</h2>
						<dl className="grid gap-0 sm:grid-cols-1">
							{infoRows.map((row) => (
								<div
									key={row.label}
									className="flex flex-col gap-0.5 border-b border-theme/10 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
								>
									<dt
										className={cn(
											'text-sm text-textcolor/65',
											locale === 'zh-CN'
												? 'min-w-18 sm:min-w-24'
												: 'sm:min-w-32',
										)}
									>
										{row.label}
									</dt>
									<dd className="text-sm font-medium text-textcolor sm:text-right">
										{row.value}
									</dd>
								</div>
							))}
						</dl>
					</section>
				</div>
			</ScrollArea>
		</div>
	);
});

export default Profile;
