import { Button } from '@ui/button';
import { ScrollArea } from '@ui/scroll-area';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '@/hooks';
import ForgetPwdForm from './forget-pwd-form';
import LoginByEmailForm from './login-by-email-form';
import LoginForm from './login-form';
import RegisterForm from './register-form';

const Login = () => {
	const [isRegister, setIsRegister] = useState(false);
	const [isForget, setIsForget] = useState(false);
	const [loginType, setLoginType] = useState('username');

	const navigate = useNavigate();

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
		setIsForget(status || true);
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
							'注册账号'
						) : isForget ? (
							'重置密码'
						) : (
							<div className="flex items-center">
								<Button
									variant="link"
									className={`p-0 text-md cursor-pointer ${loginType !== 'username' ? 'text-theme/70' : ''}`}
									onClick={() => switchLoginType('username')}
								>
									账号密码登录
								</Button>
								<Button
									variant="link"
									className={`p-0 ml-5 text-md cursor-pointer ${loginType !== 'email' ? 'text-theme/70' : ''}`}
									onClick={() => switchLoginType('email')}
								>
									邮箱登录
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
								{isRegister ? '已有账号，前往登录' : '没有账号，点我注册'}
							</Button>
							<Button
								variant="link"
								className="cursor-pointer p-0 text-sm mx-4 text-theme"
								onClick={() => onForgetPwd()}
							>
								忘记密码
							</Button>
							<Button
								variant="link"
								className="cursor-pointer p-0 text-sm text-theme"
								onClick={goHome}
							>
								返回首页
							</Button>
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
};

export default Login;
