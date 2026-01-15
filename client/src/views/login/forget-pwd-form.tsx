import { zodResolver } from '@hookform/resolvers/zod';
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@ui/form';
import { Input } from '@ui/input';
import { Toast } from '@ui/sonner';
import { Spinner } from '@ui/spinner';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { resetPassword, sendResetPasswordEmail } from '@/service';
import { encrypt } from '@/utils';

interface IProps {
	onForgetPwd: (status?: boolean) => void;
	switchLogin: (status?: boolean) => void;
}

const ForgetPwdForm: React.FC<IProps> = ({ onForgetPwd, switchLogin }) => {
	const [verifyCodeKey, setVerifyCodeKey] = useState('');
	const [sendLoading, setSendLoading] = useState(false);
	const [resetLoading, setResetLoading] = useState(false);

	const formSchema = z
		.object({
			username: z.string().min(2, {
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
			confirmPassword: z
				.string()
				.trim()
				.min(8, { message: '密码至少输入8个字符' })
				.regex(
					/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).+$/,
					{
						message: '密码必须包含英文、数字和特殊字符',
					},
				),
			email: z
				.string()
				.trim()
				.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
					message: '请输入合法的邮箱地址',
				}),
			verifyCode: z
				.string()
				.trim()
				.min(6, { message: '验证码至少输入6个字符' }),
		})
		.refine((data) => data.password === data.confirmPassword, {
			message: '两次输入的密码不一致',
			path: ['confirmPassword'],
		});

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			username: '',
			password: '',
			confirmPassword: '',
			verifyCode: '',
			email: '',
		},
	});

	const onGetVerifyCode = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		if (!form.watch('username')) {
			Toast({
				title: '请先输入用户名',
				type: 'warning',
			});
			return;
		}
		try {
			setSendLoading(true);
			const res = await sendResetPasswordEmail({
				username: form.watch('username'),
				email: form.watch('email'),
			});
			setSendLoading(false);
			if (res.success) {
				setVerifyCodeKey(res.data.key);
				Toast({
					title: '发送验证码成功',
					type: 'success',
				});
			}
		} catch (_error) {
			setSendLoading(false);
		}
	};

	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		try {
			setResetLoading(true);
			const res = await resetPassword({
				...values,
				password: encrypt(values.password),
				verifyCodeKey,
			});
			setResetLoading(false);
			Toast({
				title: '重置密码成功',
				type: 'success',
			});
			if (res.success) {
				onForgetPwd(false);
				goToLogin();
			}
		} catch (_error) {
			setResetLoading(false);
		}
	};

	const goToLogin = () => {
		switchLogin();
	};

	return (
		<Form {...form}>
			<form className="space-y-5">
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
					name="confirmPassword"
					render={({ field }) => (
						<FormItem>
							<FormLabel className="text-md">确认密码</FormLabel>
							<FormControl>
								<Input
									type="password"
									placeholder="请输入确认密码"
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
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
							<FormControl className="flex items-center">
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
										disabled={sendLoading || !form.watch('email')}
										onClick={onGetVerifyCode}
									>
										{sendLoading ? <Spinner /> : null}
										获取验证码
									</Button>
								</div>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<div className="flex items-center justify-center w-90">
					<Button
						className="cursor-pointer mt-5 flex-1"
						disabled={resetLoading}
						onClick={form.handleSubmit(onSubmit)}
					>
						{resetLoading ? <Spinner /> : null}
						确定重置
					</Button>
					<Button
						variant="outline"
						className="cursor-pointer mt-5 flex-1 ml-4"
						onClick={goToLogin}
					>
						返回登录
					</Button>
				</div>
			</form>
		</Form>
	);
};

export default ForgetPwdForm;
