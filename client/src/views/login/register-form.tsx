import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { register, sendEmail } from '@/service';
import {
	encrypt,
	formatTime,
	getStorage,
	removeStorage,
	setStorage,
} from '@/utils';

interface IProps {
	onRegister: (status?: boolean) => void;
}

const RegisterForm: React.FC<IProps> = ({ onRegister }) => {
	const [verifyCodeKey, setVerifyCodeKey] = useState('');
	const [timeLeft, setTimeLeft] = useState(() => {
		const savedTime = getStorage('countdown_time');
		return savedTime ? parseFloat(savedTime) : 60;
	});
	const [isRunning, setIsRunning] = useState(() => {
		const savedState = getStorage('countdown_state');
		return savedState === 'running';
	});

	const animationFrameRef = useRef<number>(null);
	const lastTimestampRef = useRef<number>(null);

	// 控制动画帧的启动和停止
	useEffect(() => {
		if (isRunning) {
			animationFrameRef.current = requestAnimationFrame(animate);
		} else {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
				animationFrameRef.current = null;
			}
		}

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, [isRunning]);

	// 保存数据到 localStorage
	const saveToLocalStorage = (time: number, state: string) => {
		setStorage('countdown_time', time.toString());
		setStorage('countdown_state', state);
	};

	// 动画帧回调
	const animate = (timestamp: number) => {
		if (!lastTimestampRef.current) {
			lastTimestampRef.current = timestamp;
		}

		const deltaTime = timestamp - lastTimestampRef.current;
		lastTimestampRef.current = timestamp;

		setTimeLeft((prevTime) => {
			const newTime = prevTime - deltaTime / 1000;

			if (newTime <= 0) {
				setIsRunning(false);
				saveToLocalStorage(0, 'stopped');
				return 0;
			}

			saveToLocalStorage(newTime, 'running');
			return newTime;
		});

		if (isRunning) {
			animationFrameRef.current = requestAnimationFrame(animate);
		}
	};

	// 开始倒计时
	const startTimer = () => {
		if (!isRunning) {
			setIsRunning(true);
			lastTimestampRef.current = null;

			if (timeLeft <= 0) {
				setTimeLeft(60);
				saveToLocalStorage(60, 'running');
			} else {
				saveToLocalStorage(timeLeft, 'running');
			}
		}
	};

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
			email: '',
			verifyCode: '',
		},
	});

	// 2. Define a submit handler.
	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		await register({
			...values,
			password: encrypt(values.password),
			verifyCodeKey,
		});
		removeStorage('countdown_time');
		removeStorage('countdown_state');
		onRegister(false);
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
					注册
				</Button>
			</form>
		</Form>
	);
};

export default RegisterForm;
