import { Button } from '@ui/button';
import { ScrollArea } from '@ui/scroll-area';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import ForgetPwdForm from './forget-pwd-form';
import LoginForm from './login-form';
import RegisterForm from './register-form';

const Login = () => {
	const [isRegister, setIsRegister] = useState(false);
	const [isForget, setIsForget] = useState(false);

	const navigate = useNavigate();

	const onRegister = () => {
		setIsRegister(!isRegister);
		setIsForget(false);
	};

	const switchLogin = () => {
		setIsRegister(false);
		setIsForget(false);
	};

	const onForgetPwd = (status?: boolean) => {
		setIsForget(status || true);
	};

	const goHome = () => {
		navigate('/');
	};

	return (
		<div className="flex flex-col items-center justify-center w-full h-full rounded-md bg-border">
			<ScrollArea
				dataTauriDragRegion
				viewportClassName="flex items-center justify-center"
				className="overflow-y-auto h-full w-full"
			>
				<div data-tauri-drag-region className="w-90 m-auto">
					<div className="text-xl font-medium w-90 mb-10">
						{isRegister ? '注册账号' : isForget ? '重置密码' : '账号密码登录'}
					</div>
					{isForget ? (
						<ForgetPwdForm
							onForgetPwd={onForgetPwd}
							switchLogin={switchLogin}
						/>
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
								onClick={onRegister}
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
			</ScrollArea>
		</div>
	);
};

export default Login;
