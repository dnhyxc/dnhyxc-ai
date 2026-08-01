import {
	Eye,
	EyeOff,
	Lock,
	RefreshCw,
	ShieldCheck,
	User as UserIcon,
} from 'lucide-react';
import { observer } from 'mobx-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button, Card, CardContent, Input, Label } from '@/components/ui';
import { cn } from '@/lib/utils';
import { authApi } from '@/service';
import { authStore } from '@/store';

const LoginPage = observer(() => {
	const navigate = useNavigate();
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [captchaText, setCaptchaText] = useState('');
	const [captchaId, setCaptchaId] = useState('');
	const [captchaSvg, setCaptchaSvg] = useState('');
	const [captchaLoading, setCaptchaLoading] = useState(false);
	const [loading, setLoading] = useState(false);

	/** 获取图形验证码 */
	const fetchCaptcha = useCallback(async () => {
		setCaptchaLoading(true);
		try {
			const res = await authApi.createVerifyCode();
			setCaptchaSvg(res.captcha);
			setCaptchaId(res.captchaId);
			setCaptchaText('');
		} catch {
			// 拦截器已处理错误提示
		} finally {
			setCaptchaLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchCaptcha();
	}, [fetchCaptcha]);

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!username || !password) {
			toast.warning('请输入用户名和密码');
			return;
		}
		if (!captchaText) {
			toast.warning('请输入验证码');
			return;
		}
		if (!captchaId) {
			toast.warning('验证码已失效，请刷新');
			fetchCaptcha();
			return;
		}
		setLoading(true);
		try {
			await authStore.login(username, password, captchaText, captchaId);
			toast.success('登录成功');
			navigate('/dashboard', { replace: true });
		} catch (err) {
			console.error(err);
			// 登录失败后刷新验证码
			fetchCaptcha();
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950">
			{/* 背景装饰 */}
			<div className="pointer-events-none absolute inset-0">
				<div className="absolute -left-32 top-1/4 size-96 rounded-full bg-indigo-300/20 blur-3xl dark:bg-indigo-600/20" />
				<div className="absolute -right-32 bottom-1/4 size-96 rounded-full bg-purple-300/20 blur-3xl dark:bg-purple-600/20" />
			</div>

			<div className="relative z-10 w-full max-w-md px-4">
				{/* Logo */}
				<div className="mb-8 text-center">
					<div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30">
						<span className="text-2xl font-bold">AI</span>
					</div>
					<h1 className="text-2xl font-bold text-foreground">Dnhyxc AI</h1>
					<p className="mt-1 text-sm text-muted-foreground">后台管理系统</p>
				</div>

				<Card className="border-0 shadow-xl backdrop-blur-sm">
					<CardContent className="p-6 sm:p-8">
						<form onSubmit={handleSubmit} className="space-y-5">
							{/* 用户名 */}
							<div className="space-y-2">
								<Label htmlFor="username">用户名</Label>
								<div className="relative">
									<UserIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										id="username"
										type="text"
										placeholder="请输入用户名"
										className="pl-10"
										value={username}
										onChange={(e) => setUsername(e.target.value)}
										autoComplete="username"
										disabled={loading}
										maxLength={20}
									/>
								</div>
							</div>

							{/* 密码 */}
							<div className="space-y-2">
								<Label htmlFor="password">密码</Label>
								<div className="relative">
									<Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										id="password"
										type={showPassword ? 'text' : 'password'}
										placeholder="请输入密码"
										className="pl-10 pr-10"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										autoComplete="current-password"
										disabled={loading}
										maxLength={32}
									/>
									<button
										type="button"
										onClick={() => setShowPassword(!showPassword)}
										className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
										tabIndex={-1}
									>
										{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
									</button>
								</div>
							</div>

							{/* 图形验证码 */}
							<div className="space-y-2">
								<Label htmlFor="captcha">验证码</Label>
								<div className="flex gap-2">
									<div className="relative flex-1">
										<ShieldCheck className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
										<Input
											id="captcha"
											type="text"
											placeholder="请输入验证码"
											className="pl-10"
											value={captchaText}
											onChange={(e) => setCaptchaText(e.target.value)}
											disabled={loading}
											maxLength={4}
											autoComplete="off"
										/>
									</div>
									<button
										type="button"
										onClick={fetchCaptcha}
										disabled={captchaLoading}
										className={cn(
											'flex h-9 min-w-[120px] items-center justify-center rounded-md border border-input bg-muted/30 px-3 transition-colors hover:bg-muted/60',
											captchaLoading && 'opacity-50',
										)}
										title="点击刷新验证码"
									>
										{captchaLoading ? (
											<RefreshCw
												size={16}
												className="animate-spin text-muted-foreground"
											/>
										) : captchaSvg ? (
											<span
												dangerouslySetInnerHTML={{ __html: captchaSvg }}
												className="flex h-7 items-center"
											/>
										) : (
											<RefreshCw size={16} className="text-muted-foreground" />
										)}
									</button>
								</div>
							</div>

							<Button
								type="submit"
								className="w-full"
								size="lg"
								variant={loading ? 'loading' : 'default'}
								disabled={loading}
							>
								{loading ? '登录中...' : '登 录'}
							</Button>
						</form>
					</CardContent>
				</Card>

				<p className="mt-6 text-center text-xs text-muted-foreground">
					© 2026 Dnhyxc AI. All rights reserved.
				</p>
			</div>
		</div>
	);
});

export default LoginPage;
