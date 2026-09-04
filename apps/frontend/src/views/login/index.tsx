import { Button } from '@ui/button';
import { ScrollArea } from '@ui/scroll-area';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { rememberDemoLoginHint } from '@/constants';
import { useI18n, useTheme } from '@/hooks';
import ForgetPwdForm from './forget-pwd-form';
import LoginByEmailForm from './login-by-email-form';
import LoginForm from './login-form';
import RegisterForm from './register-form';

const Login = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const [isRegister, setIsRegister] = useState(
		() => searchParams.get('mode') === 'register',
	);
	const [isForget, setIsForget] = useState(false);
	const [loginType, setLoginType] = useState('username');

	const navigate = useNavigate();
	const { t } = useI18n();

	useTheme();

	useEffect(() => {
		rememberDemoLoginHint(searchParams.get('u'), '/login');
	}, [searchParams]);

	const onRegister = (status?: boolean) => {
		const next = status !== undefined ? status : !isRegister;
		setIsRegister(next);
		setIsForget(false);
		if (next) {
			setSearchParams({ mode: 'register' }, { replace: true });
		} else {
			setSearchParams({}, { replace: true });
		}
	};

	const switchLogin = () => {
		setIsRegister(false);
		setIsForget(false);
		setSearchParams({}, { replace: true });
	};

	const switchLoginType = (type: string) => {
		setLoginType(type);
	};

	const onForgetPwd = (status?: boolean) => {
		setIsForget(status ?? true);
	};

	const goHome = () => {
		navigate('/');
	};

	return (
		<div className="relative flex flex-col items-center justify-center w-full h-full overflow-hidden rounded-md bg-theme-background">
			{/* ===== ① 多层背景光晕 ===== */}
			<div
				className="pointer-events-none absolute inset-0 -z-10"
				aria-hidden
				style={{
					background: [
						'radial-gradient(85% 60% at 50% -5%, color-mix(in oklch, var(--brand-accent) 22%, transparent), transparent 60%)',
						'radial-gradient(55% 55% at 0% 0%, color-mix(in oklch, var(--brand-accent-soft) 14%, transparent), transparent 55%)',
						'radial-gradient(65% 65% at 100% 100%, color-mix(in oklch, var(--brand-accent) 16%, transparent), transparent 58%)',
						'radial-gradient(45% 45% at 0% 100%, color-mix(in oklch, var(--brand-accent-soft) 10%, transparent), transparent 52%)',
						'radial-gradient(50% 50% at 100% 0%, color-mix(in oklch, var(--brand-accent) 12%, transparent), transparent 54%)',
					].join(', '),
				}}
			/>

			{/* ===== ② 网格线 + 径向 mask 淡出 ===== */}
			<div
				className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
				aria-hidden
				style={{
					backgroundImage:
						'linear-gradient(var(--theme-color) 1px, transparent 1px), linear-gradient(90deg, var(--theme-color) 1px, transparent 1px)',
					backgroundSize: '56px 56px',
					maskImage:
						'radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 75%)',
					WebkitMaskImage:
						'radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 75%)',
				}}
			/>

			{/* ===== ③ 中心大光斑（呼吸） ===== */}
			<div
				className="pointer-events-none absolute left-1/2 top-1/2 -z-10"
				aria-hidden
				style={{
					width: '80%',
					maxWidth: '640px',
					height: '80%',
					maxHeight: '520px',
					background:
						'radial-gradient(ellipse at center, color-mix(in oklch, var(--brand-accent) 10%, transparent), transparent 70%)',
					filter: 'blur(8px)',
					transform: 'translate(-50%, -50%)',
					animation: 'login-pulse-glow 6s ease-in-out infinite',
				}}
			/>

			{/* ===== ④ 浮动大光点 ===== */}
			<div
				className="pointer-events-none absolute -top-32 -left-20 h-72 w-72 rounded-full -z-10"
				aria-hidden
				style={{
					background:
						'radial-gradient(circle, color-mix(in oklch, var(--brand-accent) 22%, transparent), transparent 72%)',
					filter: 'blur(3px)',
					animation: 'login-float-slow 14s ease-in-out infinite',
				}}
			/>
			<div
				className="pointer-events-none absolute -bottom-28 -right-24 h-80 w-80 rounded-full -z-10"
				aria-hidden
				style={{
					background:
						'radial-gradient(circle, color-mix(in oklch, var(--brand-accent-soft) 18%, transparent), transparent 72%)',
					filter: 'blur(3px)',
					animation: 'login-float-slow 16s ease-in-out infinite reverse',
				}}
			/>

			{/* ===== ⑤ 粒子群（8 个发光小点，不同位置不同节奏） ===== */}
			{[
				{ top: '12%', left: '22%', size: 6, delay: 0, dur: 9, color: 'accent' },
				{
					top: '25%',
					left: '78%',
					size: 4,
					delay: 1.2,
					dur: 11,
					color: 'accent-soft',
				},
				{
					top: '45%',
					left: '8%',
					size: 5,
					delay: 2.4,
					dur: 10,
					color: 'accent',
				},
				{
					top: '55%',
					left: '92%',
					size: 7,
					delay: 0.6,
					dur: 12,
					color: 'accent-soft',
				},
				{
					top: '70%',
					left: '18%',
					size: 4,
					delay: 3.1,
					dur: 8,
					color: 'accent',
				},
				{
					top: '82%',
					left: '65%',
					size: 5,
					delay: 1.8,
					dur: 13,
					color: 'accent-soft',
				},
				{
					top: '38%',
					left: '35%',
					size: 3,
					delay: 0.3,
					dur: 15,
					color: 'accent',
				},
				{
					top: '88%',
					left: '45%',
					size: 6,
					delay: 2.7,
					dur: 10,
					color: 'accent-soft',
				},
			].map((p, i) => (
				<div
					key={i}
					className="pointer-events-none absolute rounded-full -z-10"
					aria-hidden
					style={{
						top: p.top,
						left: p.left,
						width: `${p.size}px`,
						height: `${p.size}px`,
						background:
							p.color === 'accent'
								? 'color-mix(in oklch, var(--brand-accent) 85%, white)'
								: 'color-mix(in oklch, var(--brand-accent-soft) 85%, white)',
						boxShadow:
							p.color === 'accent'
								? `0 0 ${p.size * 3}px ${p.size}px color-mix(in oklch, var(--brand-accent) 40%, transparent)`
								: `0 0 ${p.size * 3}px ${p.size}px color-mix(in oklch, var(--brand-accent-soft) 40%, transparent)`,
						animation: `login-particle-float ${p.dur}s ease-in-out ${p.delay}s infinite`,
					}}
				/>
			))}

			<ScrollArea
				dataTauriDragRegion
				viewportClassName="flex items-center justify-center"
				className="overflow-y-auto h-full w-full"
			>
				{/* ===== 玻璃态卡片 ===== */}
				<div
					data-tauri-drag-region
					className="login-card relative w-fit m-auto rounded-xl border border-theme/15 bg-theme-card/55 backdrop-blur-xl p-8 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.25)]"
					style={{ boxSizing: 'border-box' }}
				>
					{/* 卡片顶部渐变高光条 */}
					<div
						className="absolute inset-x-0 top-0 h-px rounded-t-xl"
						aria-hidden
						style={{
							background:
								'linear-gradient(90deg, transparent 10%, color-mix(in oklch, var(--brand-accent) 55%, transparent) 50%, transparent 90%)',
						}}
					/>
					{/* 卡片底部微光线 */}
					<div
						className="absolute inset-x-0 bottom-0 h-px rounded-b-xl opacity-60"
						aria-hidden
						style={{
							background:
								'linear-gradient(90deg, transparent 15%, color-mix(in oklch, var(--brand-accent) 25%, transparent) 50%, transparent 85%)',
						}}
					/>
					{/* 四角 L 形装饰 */}
					<div
						className="absolute -top-px -left-px h-4 w-4 border-t border-l rounded-tl-xl"
						aria-hidden
						style={{
							borderColor:
								'color-mix(in oklch, var(--brand-accent) 55%, transparent)',
						}}
					/>
					<div
						className="absolute -top-px -right-px h-4 w-4 border-t border-r rounded-tr-xl"
						aria-hidden
						style={{
							borderColor:
								'color-mix(in oklch, var(--brand-accent) 55%, transparent)',
						}}
					/>
					<div
						className="absolute -bottom-px -left-px h-4 w-4 border-b border-l rounded-bl-xl"
						aria-hidden
						style={{
							borderColor:
								'color-mix(in oklch, var(--brand-accent) 55%, transparent)',
						}}
					/>
					<div
						className="absolute -bottom-px -right-px h-4 w-4 border-b border-r rounded-br-xl"
						aria-hidden
						style={{
							borderColor:
								'color-mix(in oklch, var(--brand-accent) 55%, transparent)',
						}}
					/>

					{/* === 原内容区域（完全不变） === */}
					<div data-tauri-drag-region>
						<div className="text-xl font-medium w-90 mb-10">
							{isRegister ? (
								t('auth.register.title')
							) : isForget ? (
								t('auth.resetPassword.title')
							) : (
								<div className="flex items-center">
									<Button
										variant="link"
										className={`p-0 text-md cursor-pointer ${loginType !== 'username' ? 'text-theme/70' : 'text-theme'}`}
										onClick={() => switchLoginType('username')}
									>
										{t('auth.login.tab.username')}
									</Button>
									<Button
										variant="link"
										className={`p-0 ml-5 text-md cursor-pointer ${loginType !== 'email' ? 'text-theme/70' : 'text-theme'}`}
										onClick={() => switchLoginType('email')}
									>
										{t('auth.login.tab.email')}
									</Button>
								</div>
							)}
						</div>
						{isForget ? (
							<ForgetPwdForm
								onForgetPwd={onForgetPwd}
								switchLogin={switchLogin}
							/>
						) : isRegister ? (
							<RegisterForm onRegister={onRegister} />
						) : loginType === 'username' ? (
							<LoginForm onForgetPwd={onForgetPwd} />
						) : (
							<LoginByEmailForm />
						)}
						{!isForget && (
							<div className="w-90 flex justify-end">
								<Button
									variant="link"
									className="cursor-pointer p-0 text-sm text-theme"
									onClick={() => onRegister()}
								>
									{isRegister ? t('auth.login.go') : t('auth.register.go')}
								</Button>
								<Button
									variant="link"
									className="cursor-pointer p-0 text-sm mx-4 text-theme"
									onClick={() => onForgetPwd()}
								>
									{t('auth.forgotPassword')}
								</Button>
								<Button
									variant="link"
									className="cursor-pointer p-0 text-sm text-theme"
									onClick={goHome}
								>
									{t('nav.home')}
								</Button>
							</div>
						)}
					</div>
				</div>
			</ScrollArea>
		</div>
	);
};

export default Login;
