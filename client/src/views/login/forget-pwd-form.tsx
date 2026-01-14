import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@ui/input';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { sendEmail } from '@/service';
// import { formatTime } from '@/utils';

interface IProps {
	onForgetPwd: (status?: boolean) => void;
	switchLogin: (status?: boolean) => void;
}

const ForgetPwdForm: React.FC<IProps> = ({ onForgetPwd, switchLogin }) => {
	const [verifyCodeKey, setVerifyCodeKey] = useState('');

	const formSchema = z.object({
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
			.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: '请输入合法的邮箱地址' }),
		verifyCode: z.string().trim().min(6, { message: '验证码至少输入6个字符' }),
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
		const res = await sendEmail(form.getValues('email'));
		setVerifyCodeKey(res.data.key);
	};

	// 2. Define a submit handler.
	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		console.log(values);
		onForgetPwd(false);
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
										disabled={!form.watch('email')}
										onClick={onGetVerifyCode}
									>
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
						onClick={form.handleSubmit(onSubmit)}
					>
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
