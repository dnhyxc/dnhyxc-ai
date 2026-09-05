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
