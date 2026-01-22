import { zodResolver } from '@hookform/resolvers/zod';
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
import { useCountdown } from '@/hooks';
import { loginByEmail, sendEmail } from '@/service';
import useStore from '@/store';
import { formatTime, removeStorage, setStorage } from '@/utils';
import { http } from '@/utils/fetch';

interface IProps {
	onRegister?: () => void;
}

const LoginByEmailForm: React.FC<IProps> = () => {
	const [verifyCodeKey, setVerifyCodeKey] = useState('');
	const { timeLeft, startTimer } = useCountdown();

	const navigate = useNavigate();

	const { userStore } = useStore();

	useEffect(() => {
		return () => {
			removeStorage('countdown_time');
			removeStorage('countdown_state');
		};
	}, []);

	const formSchema = z.object({
		email: z
			.string()
			.trim()
			.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: '请输入合法的邮箱地址' }),
		verifyCode: z.string().trim().min(6, { message: '验证码至少输入6个字符' }),
	});

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: '',
			verifyCode: '',
		},
	});

	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		const res = await loginByEmail({
			...values,
			verifyCodeKey,
		});
		if (res.success) {
			userStore.setUserInfo(res.data);
			setStorage('userInfo', JSON.stringify(res.data));
			setStorage('token', res.data.access_token);
			http.setAuthToken(res.data.access_token);
			navigate('/');
		}
	};

	const onGetVerifyCode = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		startTimer();
		const res = await sendEmail(form.getValues('email'));
		setVerifyCodeKey(res.data.key);
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem>
							<FormLabel className="text-md">邮箱</FormLabel>
							<FormControl>
								<Input placeholder="请输入邮箱" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="verifyCode"
					render={({ field }) => (
						<FormItem>
							<FormLabel className="text-md">验证码</FormLabel>
							<FormControl>
								<div className="flex items-center">
									<Input
										maxLength={6}
										inputMode="numeric"
										placeholder="请输入邮箱收到的验证码"
										{...field}
										onChange={(e) => {
											const value = e.target.value.replace(/\D/g, '');
											field.onChange(value);
										}}
									/>
									<Button
										type="button"
										className="ml-2 w-26 cursor-pointer"
										disabled={
											(timeLeft > 0 && timeLeft < 60) || !form.watch('email')
										}
										onClick={onGetVerifyCode}
									>
										{timeLeft > 0 && timeLeft < 60
											? `${formatTime(timeLeft)}`
											: '获取验证码'}
									</Button>
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

export default LoginByEmailForm;
