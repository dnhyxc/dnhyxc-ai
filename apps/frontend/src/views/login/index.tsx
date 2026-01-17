import { Button } from '@ui/button';
import { ScrollArea } from '@ui/scroll-area';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getValue, setBodyClass } from '@/utils';
import ForgetPwdForm from './forget-pwd-form';
import LoginForm from './login-form';
import RegisterForm from './register-form';

const THEMES = [
	{ name: 'light', value: '#ffffff', label: '浅色', type: 'default' },
	{ name: 'dark', value: '#1e1e1e', label: '深色', type: 'default' },
	{ name: 'white', value: '#ffffff', label: '白色', type: 'color' },
	{ name: 'black', value: '#1e1e1e', label: '黑色', type: 'color' },
	{ name: 'purple', value: '#8076c3', label: '紫色', type: 'color' },
	{ name: 'blue-1', value: '#7987c4', label: '蓝紫', type: 'color' },
	{ name: 'blue-2', value: '#607ce9', label: '蓝色', type: 'color' },
	{ name: 'blue-3', value: '#459ac3', label: '青蓝', type: 'color' },
	{ name: 'green', value: '#469c77', label: '绿色', type: 'color' },
	{ name: 'orange', value: '#f3ad56', label: '橙色', type: 'color' },
	{ name: 'red', value: '#eb7177', label: '红色', type: 'color' },
	{ name: 'beige', value: '#c1b7a6', label: '米色', type: 'color' },
] as const;

const initLoginTheme = async () => {
	const savedTheme = (await getValue('theme')) as string;
	const savedDark = (await getValue('darkMode')) as string;

	const themeItem = THEMES.find((t) => t.name === savedTheme);
	const isColorTheme = themeItem?.type === 'color';

	if (isColorTheme && savedTheme) {
		document.body.classList.remove(
			...THEMES.filter((t) => t.type === 'color').map((t) => `theme-${t.name}`),
		);
		document.body.classList.remove('dark');
		document.body.classList.add(`theme-${savedTheme}`);
		applyThemeVariables();
	} else {
		const dark = savedDark === 'dark' || savedTheme === 'dark';
		if (dark) {
			document.body.classList.add('dark');
			setBodyClass('dark');
		} else {
			document.body.classList.remove('dark');
			setBodyClass('light');
		}
	}
};

const applyThemeVariables = () => {
	const themeStyles = getComputedStyle(document.documentElement);
	const themeBg = themeStyles.getPropertyValue('--theme-background').trim();
	const themeCard = themeStyles.getPropertyValue('--theme-card').trim();
	const themeMuted = themeStyles.getPropertyValue('--theme-muted').trim();
	const themeBorder = themeStyles.getPropertyValue('--theme-border').trim();
	const themeFg = themeStyles.getPropertyValue('--theme-foreground').trim();
	const themeSec = themeStyles.getPropertyValue('--theme-secondary').trim();
	const themeSidebar = themeStyles.getPropertyValue('--theme-sidebar').trim();

	document.documentElement.style.setProperty('--background', themeBg);
	document.documentElement.style.setProperty('--card', themeCard);
	document.documentElement.style.setProperty('--muted', themeMuted);
	document.documentElement.style.setProperty('--border', themeBorder);
	document.documentElement.style.setProperty('--foreground', themeFg);
	document.documentElement.style.setProperty('--secondary', themeSec);
	document.documentElement.style.setProperty('--sidebar', themeSidebar);
	document.documentElement.style.setProperty('--popover', themeCard);
	document.documentElement.style.setProperty('--accent', themeMuted);
};

const Login = () => {
	const [isRegister, setIsRegister] = useState(false);
	const [isForget, setIsForget] = useState(false);

	const navigate = useNavigate();

	useEffect(() => {
		initLoginTheme();
	}, []);

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
