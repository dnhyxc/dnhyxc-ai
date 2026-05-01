import { Button } from '@ui/button';
import { ScrollArea } from '@ui/scroll-area';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n, useTheme } from '@/hooks';
import ForgetPwdForm from './forget-pwd-form';
import LoginByEmailForm from './login-by-email-form';
import LoginForm from './login-form';
import RegisterForm from './register-form';

const Login = () => {
	const [isRegister, setIsRegister] = useState(false);
	const [isForget, setIsForget] = useState(false);
	const [loginType, setLoginType] = useState('username');

	const navigate = useNavigate();
	const { t } = useI18n();

	useTheme();

	const onRegister = () => {
		setIsRegister(!isRegister);
		setIsForget(false);
	};

	const switchLogin = () => {
		setIsRegister(false);
		setIsForget(false);
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
		<div className="flex flex-col items-center justify-center w-full h-full rounded-md bg-theme-background">
			<ScrollArea
				dataTauriDragRegion
				viewportClassName="flex items-center justify-center"
				className="overflow-y-auto h-full w-full"
			>
				<div data-tauri-drag-region className="w-90 m-auto">
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
								onClick={onRegister}
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
			</ScrollArea>
		</div>
	);
};

export default Login;
