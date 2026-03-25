import type { StripeEmbeddedCheckout } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { Toast } from '@ui/sonner';
import { motion } from 'framer-motion';
import { CreditCard, Loader2, Lock, ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useSearchParams } from 'react-router';
import { createCheckoutSession } from '@/service';
import { getStorage } from '@/utils';

const CURRENCIES = [
	{ value: 'cny', label: 'CNY · 人民币', zeroDecimal: false },
	{ value: 'usd', label: 'USD · 美元', zeroDecimal: false },
	{ value: 'eur', label: 'EUR · 欧元', zeroDecimal: false },
	{ value: 'hkd', label: 'HKD · 港币', zeroDecimal: false },
	{ value: 'gbp', label: 'GBP · 英镑', zeroDecimal: false },
	{ value: 'jpy', label: 'JPY · 日元', zeroDecimal: true },
] as const;

function toStripeMinorUnits(majorAmount: number, zeroDecimal: boolean): number {
	if (!Number.isFinite(majorAmount) || majorAmount <= 0) return 0;
	if (zeroDecimal) return Math.round(majorAmount);
	return Math.round(majorAmount * 100);
}

const Pay = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const [currency, setCurrency] =
		useState<(typeof CURRENCIES)[number]['value']>('cny');
	const [majorAmount, setMajorAmount] = useState<string>('9.99');
	const [productName, setProductName] = useState('Pro 额度充值');
	const [loading, setLoading] = useState(false);
	const [embeddedOpen, setEmbeddedOpen] = useState(false);

	const checkoutRef = useRef<StripeEmbeddedCheckout | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const token = getStorage('token');
	const zeroDecimal = useMemo(
		() => CURRENCIES.find((c) => c.value === currency)?.zeroDecimal ?? false,
		[currency],
	);

	const destroyEmbedded = useCallback(() => {
		checkoutRef.current?.destroy();
		checkoutRef.current = null;
		setEmbeddedOpen(false);
	}, []);

	useEffect(() => () => destroyEmbedded(), [destroyEmbedded]);

	useEffect(() => {
		const sid = searchParams.get('session_id');
		const status = searchParams.get('status');
		if (sid && status === 'success') {
			Toast({ type: 'success', title: '支付已完成', message: '感谢支持。' });
			destroyEmbedded();
			setSearchParams({}, { replace: true });
		} else if (status === 'cancel') {
			Toast({ type: 'info', title: '已取消支付' });
			destroyEmbedded();
			setSearchParams({}, { replace: true });
		}
	}, [searchParams, setSearchParams, destroyEmbedded]);

	const onOpenEmbeddedCheckout = useCallback(async () => {
		if (!token) {
			Toast({ type: 'error', title: '请先登录后再发起支付' });
			return;
		}
		const pk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim();
		if (!pk) {
			Toast({
				type: 'error',
				title: '缺少 VITE_STRIPE_PUBLISHABLE_KEY',
				message:
					'在前端 .env 中配置 Publishable key（pk_test_… / pk_live_…）。',
			});
			return;
		}
		const parsed = zeroDecimal
			? Number.parseInt(majorAmount, 10)
			: Number.parseFloat(majorAmount);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			Toast({ type: 'error', title: '请输入有效金额' });
			return;
		}
		const amount = toStripeMinorUnits(parsed, zeroDecimal);
		if (amount < 1) {
			Toast({ type: 'error', title: '金额过小' });
			return;
		}
		const origin = window.location.origin;
		const returnUrl = `${origin}/pay?session_id={CHECKOUT_SESSION_ID}&status=success`;

		setLoading(true);
		try {
			destroyEmbedded();
			const res = await createCheckoutSession({
				amount,
				currency,
				productName: productName.trim() || undefined,
				embedded: true,
				returnUrl,
			});
			const clientSecret = res.data?.clientSecret;
			if (!clientSecret) {
				Toast({
					type: 'error',
					title: '未返回 client_secret',
					message: '请确认后端已创建 ui_mode=embedded 的 Checkout Session。',
				});
				return;
			}

			const stripe = await loadStripe(pk);
			if (!stripe) {
				Toast({ type: 'error', title: 'Stripe.js 加载失败' });
				return;
			}

			const checkout = await stripe.initEmbeddedCheckout({
				clientSecret,
			});
			checkoutRef.current = checkout;
			flushSync(() => {
				setEmbeddedOpen(true);
			});
			const el = containerRef.current;
			if (!el) {
				checkout.destroy();
				checkoutRef.current = null;
				setEmbeddedOpen(false);
				Toast({ type: 'error', title: '挂载节点未就绪' });
				return;
			}
			checkout.mount(el);
		} finally {
			setLoading(false);
		}
	}, [token, zeroDecimal, majorAmount, currency, productName, destroyEmbedded]);

	return (
		<div className="relative min-h-full bg-theme-background">
			<div
				className="pointer-events-none absolute inset-0 opacity-[0.45]"
				style={{
					background:
						'radial-gradient(ellipse 80% 60% at 20% 0%, oklch(0.72 0.14 165 / 0.22), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 20%, oklch(0.65 0.12 250 / 0.12), transparent 50%)',
				}}
			/>
			<div className="relative mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
				<motion.header
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.45 }}
					className="space-y-3"
				>
					<div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
						<ShieldCheck className="size-3.5" aria-hidden />
						Stripe 嵌入式收银台
					</div>
					<h1 className="text-3xl font-semibold tracking-tight text-textcolor">
						结账
					</h1>
				</motion.header>

				<motion.div
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.08 }}
					className="rounded-2xl border border-border/80 bg-card/80 p-6 shadow-lg shadow-emerald-950/5 backdrop-blur-sm dark:shadow-black/20"
				>
					{!token ? (
						<div className="space-y-4 text-center">
							<p className="text-sm text-muted-foreground">
								发起支付前需要登录账号。
							</p>
							<Button asChild className="w-full">
								<Link to="/login">去登录</Link>
							</Button>
						</div>
					) : (
						<div className="space-y-5">
							<div className="space-y-2">
								<Label htmlFor="pay-currency">货币</Label>
								<select
									id="pay-currency"
									className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2"
									value={currency}
									disabled={embeddedOpen}
									onChange={(e) =>
										setCurrency(e.target.value as typeof currency)
									}
								>
									{CURRENCIES.map((c) => (
										<option key={c.value} value={c.value}>
											{c.label}
										</option>
									))}
								</select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="pay-amount">
									金额（{zeroDecimal ? '整数，无小数' : '含两位小数'}）
								</Label>
								<Input
									id="pay-amount"
									type="number"
									step={zeroDecimal ? '1' : '0.01'}
									min={zeroDecimal ? '1' : '0.01'}
									value={majorAmount}
									disabled={embeddedOpen}
									onChange={(e) => setMajorAmount(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="pay-product">商品说明（可选）</Label>
								<Input
									id="pay-product"
									placeholder="例如：月度会员"
									value={productName}
									disabled={embeddedOpen}
									onChange={(e) => setProductName(e.target.value)}
								/>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button
									type="button"
									className="h-11 flex-1 gap-2 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
									disabled={loading || embeddedOpen}
									onClick={() => void onOpenEmbeddedCheckout()}
								>
									{loading ? (
										<Loader2 className="size-4 animate-spin" aria-hidden />
									) : (
										<CreditCard className="size-4" aria-hidden />
									)}
									在页面内打开收银台
								</Button>
								{embeddedOpen ? (
									<Button
										type="button"
										variant="outline"
										className="h-11 gap-2"
										onClick={destroyEmbedded}
									>
										<X className="size-4" aria-hidden />
										关闭
									</Button>
								) : null}
							</div>
							<p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
								<Lock className="size-3" aria-hidden />
								支付表单由 Stripe 嵌入组件提供
							</p>

							<div
								ref={containerRef}
								className="border-border/80 bg-background/50 relative min-h-[480px] w-full overflow-hidden rounded-xl border"
								hidden={!embeddedOpen}
							/>
						</div>
					)}
				</motion.div>
			</div>
		</div>
	);
};

export default Pay;
