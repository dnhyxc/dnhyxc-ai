import { Button } from '@ui/button';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getStorage, onListen, setBodyClass } from '@/utils';
import ForgetPwdForm from './forget-pwd-form';
import LoginForm from './login-form';
import RegisterForm from './register-form';

const Login = () => {
	const [isRegister, setIsRegister] = useState(false);
	const [isForget, setIsForget] = useState(false);

	const navigate = useNavigate();

	const theme = getStorage('theme');

	useEffect(() => {
		setBodyClass(theme as 'light' | 'dark');

		const unlistenThemePromise = onListen('theme', (value: string) => {
			setBodyClass(value);
		});

		return () => {
			unlistenThemePromise.then((unlisten) => unlisten());
		};
	}, [theme]);

	const onRegister = (status?: boolean) => {
		setIsRegister(status || !isRegister);
		setIsForget(false);
	};

	const onForgetPwd = (status?: boolean) => {
		setIsForget(status || true);
	};

	const goHome = () => {
		navigate('/');
	};

	return (
		<div
			data-tauri-drag-region
			className="flex flex-col items-center justify-center w-full h-full rounded-md bg-border"
		>
			<div className="text-xl font-medium w-90 mb-10">
				{isRegister ? '注册账号' : isForget ? '重置密码' : '账号密码登录'}
			</div>
			{isForget ? (
				<ForgetPwdForm onForgetPwd={onForgetPwd} onRegister={onRegister} />
			) : isRegister ? (
				<RegisterForm onRegister={onRegister} />
			) : (
				<LoginForm onForgetPwd={onForgetPwd} />
			)}
			{!isForget && (
				<div className="w-90 flex justify-end">
					<Button
						variant="link"
						className="cursor-pointer p-0 text-sm"
						onClick={() => onRegister()}
					>
						{isRegister ? '已有账号，前往登录' : '没有账号，点我注册'}
					</Button>
					<Button
						variant="link"
						className="cursor-pointer p-0 text-sm mx-4"
						onClick={() => onForgetPwd()}
					>
						忘记密码
					</Button>
					<Button
						variant="link"
						className="cursor-pointer p-0 text-sm"
						onClick={goHome}
					>
						返回首页
					</Button>
				</div>
			)}
		</div>
	);
};

export default Login;
