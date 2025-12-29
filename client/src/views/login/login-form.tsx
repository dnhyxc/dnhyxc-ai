import { zodResolver } from '@hookform/resolvers/zod';
import { Toast } from '@ui/sonner';
import { Spinner } from '@ui/spinner';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { createVerifyCode, login } from '@/service';
import { setStorage } from '@/utils';
import { http } from '@/utils/fetch';

interface IProps {
	onForgetPwd: (status?: boolean) => void;
}

const LoginForm: React.FC<IProps> = ({ onForgetPwd }) => {
	const [isLoading, setIsLoading] = useState(false);
	const [captchaInfo, setCaptchaInfo] = useState<{
		captchaId: string;
		captcha: string;
	}>({
		captchaId: '',
		captcha: '',
	});

	const navigate = useNavigate();

	useEffect(() => {
		getCaptcha();
	}, []);

	const getCaptcha = async () => {
		// 获取验证码
		setIsLoading(true);
		// const response = await fetch(
		// 	'http://101.34.214.188:9112/api/auth/createVerifyCode',
		// 	{
		// 		method: 'POST',
		// 		body: JSON.stringify({
		// 			username: 'admin',
		// 			password: 'admin',
		// 		}),
		// 	},
		// );
		// const res = await response.json(); // 获取接口响应数据
		const res = await createVerifyCode();
		console.log(res, '获取验证码');
		setIsLoading(false);
		if (res) {
			setCaptchaInfo({
				captchaId: res.data.captchaId,
				captcha: res.data.captcha,
			});
		} else {
			Toast({
				title: '获取验证码失败!',
				type: 'error',
			});
		}
	};

	const formSchema = z.object({
		username: z.string().trim().min(2, {
			message: '用户名至少输入两个字符',
		}),
		password: z
			.string()
			.trim()
			.min(8, { message: '密码至少输入8个字符' })
			.regex(
				/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).+$/,
				{
					message: '密码必须包含英文、数字和特殊字符',
				},
			),
		captchaText: z.string().trim().min(4, {
			message: '验证码至少输入4个字符',
		}),
	});

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			username: '',
			password: '',
			captchaText: '',
		},
	});

	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		const res = await login({
			...values,
			captchaId: captchaInfo.captchaId,
		});

		console.log(res.data.access_token, 'loginloginloginloginloginloginlogin');

		if (res?.data?.access_token) {
			setStorage('token', res.data.access_token);
			http.setAuthToken(res.data.access_token);
		}
		navigate('/');
		onForgetPwd(false);
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
				<FormField
					control={form.control}
					name="username"
					render={({ field }) => (
						<FormItem className="w-90">
							<FormLabel className="text-md">用户名</FormLabel>
							<FormControl>
								<Input placeholder="请输入用户名" {...field} className="" />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="password"
					render={({ field }) => (
						<FormItem>
							<FormLabel className="text-md">密码</FormLabel>
							<FormControl>
								<Input type="password" placeholder="请输入密码" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="captchaText"
					render={({ field }) => (
						<FormItem>
							<FormLabel className="text-md">验证码</FormLabel>
							<FormControl>
								<div className="flex items-center justify-between">
									<Input placeholder="请输入验证码" {...field} />
									{captchaInfo.captcha && (
										<div className="flex items-center justify-center relative ml-2 rounded-md hover:border-ring hover:ring-ring/50 hover:ring-[3px]">
											<div
												dangerouslySetInnerHTML={{
													__html: captchaInfo.captcha,
												}}
												className="
													h-[36px] w-[115px] flex justify-center items-center 
													border border-gray-950 rounded-md dark:border-white [&>svg]:rounded-md cursor-pointer 
												"
												onClick={getCaptcha}
											/>
											{isLoading && (
												<div className="absolute top-0 left-0 w-[115px] h-full bg-gray-500 opacity-50 rounded-md">
													<Spinner className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] size-5" />
												</div>
											)}
										</div>
									)}
								</div>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button type="submit" className="cursor-pointer w-full mt-5">
					登录
				</Button>
			</form>
		</Form>
	);
};

export default LoginForm;
