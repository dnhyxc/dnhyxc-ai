import type { StripeEmbeddedCheckout } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ui/select';
import { Toast } from '@ui/sonner';
import { motion } from 'framer-motion';
import { CreditCard, Loader2, Lock, ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';
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
	const [currency, setCurrency] =
		useState<(typeof CURRENCIES)[number]['value']>('cny');
	const [majorAmount, setMajorAmount] = useState<string>('9.99');
	const [productName, setProductName] = useState('Pro 额度充值');
	const [loading, setLoading] = useState(false);
	const [embeddedOpen, setEmbeddedOpen] = useState(false);

	const checkoutRef = useRef<StripeEmbeddedCheckout | null>(null);
	/** Stripe mount 目标（仅内层，避免 iframe 贴满外层导致底边无空隙） */
	const containerRef = useRef<HTMLDivElement>(null);
	/** 带内边距的外壳，白底收银台与圆角容器底部之间留出灰色「呼吸区」 */
	const stripeHostRef = useRef<HTMLDivElement>(null);
	const timerRef = useRef<NodeJS.Timeout | null>(null);

	const token = getStorage('token');
	const zeroDecimal = useMemo(
		() => CURRENCIES.find((c) => c.value === currency)?.zeroDecimal ?? false,
		[currency],
	);

	const destroyEmbedded = useCallback(() => {
		checkoutRef.current?.destroy();
		checkoutRef.current = null;
		setEmbeddedOpen(false);
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	useEffect(() => () => destroyEmbedded(), [destroyEmbedded]);

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
		setLoading(true);
		try {
			destroyEmbedded();
			const res = await createCheckoutSession({
				amount,
				currency,
				productName: productName.trim() || undefined,
				embedded: true,
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
				onComplete: () => {
					destroyEmbedded();
					Toast({
						type: 'success',
						title: '支付已完成',
						message: '感谢支持。',
					});
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
				Toast({ type: 'error', title: '挂载节点未就绪' });
				return;
			}
			checkout.mount(el);
			// 等内嵌 iframe 占位后再滚到主内容区顶部（Outlet 为 overflow-y-auto）
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
	}, [token, zeroDecimal, majorAmount, currency, productName, destroyEmbedded]);

	return (
		<div className="relative min-h-full bg-theme-gradient">
			<div
				className="pointer-events-none absolute inset-0 opacity-[0.45]"
				// style={{
				// 	background:
				// 		"radial-gradient(ellipse 80% 60% at 20% 0%, oklch(0.72 0.14 165 / 0.22), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 20%, oklch(0.65 0.12 250 / 0.12), transparent 50%)",
				// }}
			/>
			<div className="relative mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
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
					className="rounded-md border border-theme/10 bg-theme-background p-6 shadow-lg shadow-emerald-950/5 backdrop-blur-sm dark:shadow-black/20"
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
						<>
							<div className="space-y-5">
								<div className="space-y-2">
									<Label htmlFor="pay-currency">货币</Label>
									<Select
										value={currency}
										onValueChange={(v) =>
											setCurrency(v as (typeof CURRENCIES)[number]['value'])
										}
										disabled={embeddedOpen}
									>
										<SelectTrigger id="pay-currency" className="w-full">
											<SelectValue placeholder="选择货币" />
										</SelectTrigger>
										<SelectContent position="popper">
											{CURRENCIES.map((c) => (
												<SelectItem key={c.value} value={c.value}>
													{c.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
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
										在页面内打开收银台
									</Button>
								</div>
								<div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
									<Lock className="size-3" aria-hidden />
									支付表单由 Stripe 嵌入组件提供
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
									aria-label="关闭收银台"
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
