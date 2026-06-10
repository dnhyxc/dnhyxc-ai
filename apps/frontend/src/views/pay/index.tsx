import type { StripeEmbeddedCheckout } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@ui/button';
import { Label } from '@ui/label';
import { Toast } from '@ui/sonner';
import { motion } from 'framer-motion';
import {
	Check,
	CreditCard,
	Crown,
	Loader2,
	Lock,
	ShieldCheck,
	X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate } from 'react-router';
import {
	DEFAULT_MEMBERSHIP_PLAN,
	formatMembershipPriceYuan,
	MEMBERSHIP_PLAN_LIST,
	type MembershipPlanCode,
} from '@/constants/membershipPlans';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { completeCheckoutMembership, createCheckoutSession } from '@/service';
import useStore from '@/store';
import { getStorage } from '@/utils';

const PLAN_I18N: Record<MembershipPlanCode, { label: string; desc: string }> = {
	membership_monthly: {
		label: 'pay.plan.monthly.label',
		desc: 'pay.plan.monthly.desc',
	},
	membership_quarterly: {
		label: 'pay.plan.quarterly.label',
		desc: 'pay.plan.quarterly.desc',
	},
	membership_yearly: {
		label: 'pay.plan.yearly.label',
		desc: 'pay.plan.yearly.desc',
	},
};

const Pay = () => {
	const { t } = useI18n();
	const { userStore } = useStore();
	const navigate = useNavigate();
	const [selectedPlan, setSelectedPlan] = useState<MembershipPlanCode>(
		DEFAULT_MEMBERSHIP_PLAN,
	);
	const [loading, setLoading] = useState(false);
	const [embeddedOpen, setEmbeddedOpen] = useState(false);

	const checkoutRef = useRef<StripeEmbeddedCheckout | null>(null);
	const checkoutSessionIdRef = useRef<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const stripeHostRef = useRef<HTMLDivElement>(null);
	const timerRef = useRef<NodeJS.Timeout | null>(null);

	const token = getStorage('token');

	const selectedPlanDef = useMemo(
		() => MEMBERSHIP_PLAN_LIST.find((p) => p.code === selectedPlan)!,
		[selectedPlan],
	);

	const selectedPlanLabel = t(PLAN_I18N[selectedPlan].label);
	const selectedPlanPrice = t('pay.plan.price', {
		price: formatMembershipPriceYuan(selectedPlanDef.priceYuan),
	});

	const destroyEmbedded = useCallback(() => {
		checkoutRef.current?.destroy();
		checkoutRef.current = null;
		checkoutSessionIdRef.current = null;
		setEmbeddedOpen(false);
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	useEffect(() => () => destroyEmbedded(), [destroyEmbedded]);

	const onOpenEmbeddedCheckout = useCallback(async () => {
		if (!token) {
			Toast({ type: 'error', title: t('pay.toast.loginRequired') });
			return;
		}
		const pk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim();
		if (!pk) {
			Toast({
				type: 'error',
				title: t('pay.toast.missingStripePk.title'),
				message: t('pay.toast.missingStripePk.message'),
			});
			return;
		}
		setLoading(true);
		try {
			destroyEmbedded();
			const res = await createCheckoutSession({
				membershipPlan: selectedPlan,
				currency: 'cny',
				embedded: true,
			});
			const clientSecret = res.data?.clientSecret;
			const sessionId = res.data?.sessionId;
			if (!clientSecret || !sessionId) {
				Toast({
					type: 'error',
					title: t('pay.toast.clientSecretMissing.title'),
					message: t('pay.toast.clientSecretMissing.message'),
				});
				return;
			}
			checkoutSessionIdRef.current = sessionId;

			const stripe = await loadStripe(pk);
			if (!stripe) {
				Toast({ type: 'error', title: t('pay.toast.stripeLoadFailed') });
				return;
			}

			const checkout = await stripe.initEmbeddedCheckout({
				clientSecret,
				onComplete: () => {
					const sid = checkoutSessionIdRef.current;
					destroyEmbedded();
					void (async () => {
						try {
							if (sid) {
								const membershipRes = await completeCheckoutMembership({
									sessionId: sid,
								});
								const payload = membershipRes.data;
								if (payload) {
									userStore.setUserInfo({
										...userStore.userInfo,
										isMember: payload.isMember,
										membershipType: payload.membershipType,
										memberExpiresAt: payload.memberExpiresAt,
									});
								}
							}
							Toast({
								type: 'success',
								title: t('pay.toast.paid.title'),
								message: t('pay.toast.paid.membershipMessage'),
							});
						} catch {
							Toast({
								type: 'success',
								title: t('pay.toast.paid.title'),
								message: t('pay.toast.paid.message'),
							});
						}
						navigate('/profile');
					})();
				},
			});
			checkoutRef.current = checkout;
			flushSync(() => {
				setEmbeddedOpen(true);
			});
			const el = containerRef.current;
			const host = stripeHostRef.current;
			if (!el || !host) {
				checkout.destroy();
				checkoutRef.current = null;
				setEmbeddedOpen(false);
				Toast({ type: 'error', title: t('pay.toast.mountNodeNotReady') });
				return;
			}
			checkout.mount(el);
			timerRef.current = setTimeout(() => {
				host.scrollIntoView({
					behavior: 'smooth',
					block: 'start',
					inline: 'nearest',
				});
			}, 100);
		} finally {
			setLoading(false);
		}
	}, [token, selectedPlan, destroyEmbedded, t, userStore, navigate]);

	return (
		<div className="relative min-h-full bg-theme-gradient">
			<div className="pointer-events-none absolute inset-0 opacity-[0.45]" />
			<div className="relative mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10">
				<motion.header
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.45 }}
					className="space-y-3"
				>
					<div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
						<ShieldCheck className="size-3.5" aria-hidden />
						{t('pay.badge.stripeEmbedded')}
					</div>
					<h1 className="text-3xl font-semibold tracking-tight text-textcolor">
						{t('pay.title')}
					</h1>
				</motion.header>

				<motion.div
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.08 }}
					className="rounded-md border border-theme/10 bg-theme-background p-6 shadow-lg shadow-emerald-950/5 backdrop-blur-sm dark:shadow-black/20"
				>
					{!token ? (
						<div className="space-y-4 text-center">
							<p className="text-sm text-muted-foreground">
								{t('pay.loginRequiredHint')}
							</p>
							<Button asChild className="w-full">
								<Link to="/login">{t('pay.goLogin')}</Link>
							</Button>
						</div>
					) : (
						<>
							<div className="space-y-5">
								<div className="space-y-3">
									<Label>{t('pay.form.plan')}</Label>
									<div
										className="grid gap-3 sm:grid-cols-3"
										role="radiogroup"
										aria-label={t('pay.form.plan')}
									>
										{MEMBERSHIP_PLAN_LIST.map((plan) => {
											const selected = selectedPlan === plan.code;
											const priceText = t('pay.plan.price', {
												price: formatMembershipPriceYuan(plan.priceYuan),
											});
											return (
												<button
													key={plan.code}
													type="button"
													disabled={embeddedOpen}
													role="radio"
													aria-checked={selected}
													onClick={() => setSelectedPlan(plan.code)}
													className={cn(
														'relative flex flex-col items-start gap-2 rounded-md border p-4 text-left transition-colors',
														'hover:border-emerald-500/40 hover:bg-emerald-500/5',
														selected
															? 'border-emerald-600 bg-emerald-500/10 ring-1 ring-emerald-600/30'
															: 'border-theme/15 bg-theme-secondary/40',
														embeddedOpen && 'pointer-events-none opacity-60',
													)}
												>
													{selected ? (
														<span className="absolute right-3 top-3 inline-flex size-5 items-center justify-center rounded-full bg-emerald-600 text-white">
															<Check className="size-3" strokeWidth={3} />
														</span>
													) : null}
													<span className="inline-flex items-center gap-1.5 text-sm font-semibold text-textcolor">
														<Crown
															className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
															aria-hidden
														/>
														{t(PLAN_I18N[plan.code].label)}
													</span>
													<span className="text-2xl font-bold tracking-tight text-textcolor">
														{priceText}
													</span>
													<span className="text-xs text-muted-foreground">
														{t(PLAN_I18N[plan.code].desc)}
													</span>
												</button>
											);
										})}
									</div>
									<p className="text-sm text-muted-foreground">
										{t('pay.plan.selectedSummary', {
											label: selectedPlanLabel,
											price: selectedPlanPrice,
										})}
									</p>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										className={cn(
											'h-11 w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700',
											loading && 'pointer-events-none',
										)}
										disabled={embeddedOpen}
										aria-busy={loading}
										onClick={() => void onOpenEmbeddedCheckout()}
									>
										<span
											className="relative inline-flex size-4 shrink-0"
											aria-hidden
										>
											<Loader2
												className={cn(
													'absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 animate-spin',
													loading
														? 'opacity-100'
														: 'opacity-0 pointer-events-none',
												)}
											/>
											<CreditCard
												className={cn(
													'absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2',
													loading
														? 'opacity-0 pointer-events-none'
														: 'opacity-100',
												)}
											/>
										</span>
										{t('pay.actions.openEmbedded')}
									</Button>
								</div>
								<div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
									<Lock className="size-3" aria-hidden />
									{t('pay.footer.stripeProvided')}
								</div>
							</div>
							<div
								ref={stripeHostRef}
								className="relative bg-white box-border min-h-[750px] w-full overflow-hidden rounded-md mt-5"
								hidden={!embeddedOpen}
							>
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="absolute top-2 right-2 z-20 size-9 rounded-full border-theme/20 bg-theme-background/50 text-textcolor shadow-sm backdrop-blur-sm hover:bg-theme-background/80"
									onClick={destroyEmbedded}
									aria-label={t('pay.actions.closeEmbedded')}
								>
									<X className="size-4 text-textcolor" aria-hidden />
								</Button>
								<div className="bg-white rounded-xl mb-5.5">
									<div ref={containerRef} className="w-full" />
								</div>
							</div>
						</>
					)}
				</motion.div>
			</div>
		</div>
	);
};

export default Pay;
