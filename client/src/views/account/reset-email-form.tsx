import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@ui/button';
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
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useCountdown } from '@/hooks';
import { sendEmail, updateEmail } from '@/service';
import { formatTime, removeStorage, setStorage } from '@/utils';

interface IProps {
	userInfo: any;
	onOpenChange: () => void;
	handleAccountInfo: (email: string) => void;
}

const DEFAULT_TIME = 60;

const ResetEmailForm: React.FC<IProps> = ({
	userInfo,
	onOpenChange,
	handleAccountInfo,
}) => {
	const [verifyCodeInfo, setVerifyCodeInfo] = useState({
		oldVerifyCodeKey: '',
		newVerifyCodeKey: '',
	});
	const [sendOldLoading, setSendOldLoading] = useState(false);
	const [sendNewLoading, setSendNewLoading] = useState(false);
	const [loading, setLoading] = useState(false);
	const { timeLeft: oldTimeLeft, startTimer: startOldTimer } = useCountdown(
		DEFAULT_TIME,
		'old_countdown',
	);
	const { timeLeft: newTimeLeft, startTimer: startNewTimer } = useCountdown(
		DEFAULT_TIME,
		'new_countdown',
	);

	useEffect(() => {
		return () => {
			removeStorage('old_countdown_time');
			removeStorage('old_countdown_state');
			removeStorage('new_countdown_time');
			removeStorage('new_countdown_state');
		};
	}, [open]);

	const formSchema = z.object({
		email: z
			.string()
			.trim()
			.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: '请输入合法的邮箱地址' }),
		oldVerifyCode: z
			.string()
			.trim()
			.regex(/^\d{6}$/, { message: '验证码必须为6位数字' }),
		newVerifyCode: z
			.string()
			.trim()
			.regex(/^\d{6}$/, { message: '验证码必须为6位数字' }),
	});

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: '',
			oldVerifyCode: '',
			newVerifyCode: '',
		},
	});

	const onSendEmail = async (
		e: React.MouseEvent<HTMLButtonElement>,
		key: string,
	) => {
		e.preventDefault();
		try {
			if (key === 'old') {
				startOldTimer();
				setSendOldLoading(true);
			} else {
				startNewTimer();
				setSendNewLoading(true);
			}
			const email = key === 'old' ? userInfo.email : form.watch('email');
			const res = await sendEmail(email, {
				key: key === 'old' ? 'OLD_EMAIL' : 'NEW_EMAIL',
				timeout: 300 * 1000,
			});
			if (key === 'old') {
				setSendOldLoading(false);
			} else {
				setSendNewLoading(false);
			}
			if (res.success) {
				if (key === 'old') {
					setVerifyCodeInfo({
						...verifyCodeInfo,
						oldVerifyCodeKey: res.data.key,
					});
				} else {
					setVerifyCodeInfo({
						...verifyCodeInfo,
						newVerifyCodeKey: res.data.key,
					});
				}
			}
			Toast({
				title: '获取验证码成功',
				type: 'success',
			});
		} catch (_error) {
			if (key === 'old') {
				setSendOldLoading(false);
			} else {
				setSendNewLoading(false);
			}
		}
	};

	const onSubmitEmail = async (values: z.infer<typeof formSchema>) => {
		try {
			if (
				!verifyCodeInfo.oldVerifyCodeKey ||
				!verifyCodeInfo.newVerifyCodeKey
			) {
				return Toast({
					type: 'info',
					title: '验证码 Key 不能为空',
				});
			}
			setLoading(true);
			const res = await updateEmail({
				id: userInfo.id,
				email: values.email,
				oldVerifyCode: values.oldVerifyCode,
				newVerifyCode: values.newVerifyCode,
				oldVerifyCodeKey: verifyCodeInfo.oldVerifyCodeKey,
				newVerifyCodeKey: verifyCodeInfo.newVerifyCodeKey,
			});
			setLoading(false);
			if (res.success) {
				setStorage(
					'userInfo',
					JSON.stringify({
						...userInfo,
						email: values.email,
					}),
				);
				handleAccountInfo?.(values.email);
				onOpenChange?.();
				form.reset();
				setVerifyCodeInfo({
					oldVerifyCodeKey: '',
					newVerifyCodeKey: '',
				});
			}
			Toast({
				title: '邮箱修改成功',
				type: 'success',
			});
		} catch (_error) {
			setLoading(false);
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmitEmail)} className="space-y-5">
				<div className="flex flex-col">
					<div className="my-2 font-medium">原邮箱</div>
					<Input value={userInfo?.email} disabled />
				</div>
				<FormField
					control={form.control}
					name="oldVerifyCode"
					render={({ field }) => (
						<FormItem>
							<FormLabel className="text-md">原邮箱验证码</FormLabel>
							<FormControl>
								<div className="flex items-center">
									<Input
										maxLength={6}
										inputMode="numeric"
										placeholder="请输入原邮箱验证码"
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
											sendOldLoading ||
											(oldTimeLeft > 0 && oldTimeLeft < DEFAULT_TIME)
										}
										onClick={(e) => onSendEmail(e, 'old')}
									>
										{sendOldLoading ? (
											<Spinner />
										) : oldTimeLeft > 0 && oldTimeLeft < DEFAULT_TIME ? (
											`${formatTime(oldTimeLeft)}`
										) : (
											'获取验证码'
										)}
									</Button>
								</div>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				{verifyCodeInfo.oldVerifyCodeKey ? (
					<FormField
						control={form.control}
						name="email"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="text-md">新邮箱</FormLabel>
								<FormControl>
									<Input type="email" placeholder="请输入新邮箱" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				) : null}
				{verifyCodeInfo.oldVerifyCodeKey ? (
					<FormField
						control={form.control}
						name="newVerifyCode"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="text-md">新邮箱验证码</FormLabel>
								<FormControl>
									<div className="flex items-center">
										<Input
											maxLength={6}
											inputMode="numeric"
											placeholder="请输入新邮箱验证码"
											{...field}
											onChange={(e) => {
												const value = e.target.value.replace(/\D/g, '');
												field.onChange(value);
											}}
										/>
										<Button
											type="button"
											className="ml-2 w-26 cursor-pointer flex items-center"
											disabled={
												sendNewLoading ||
												!form.watch('email') ||
												(newTimeLeft > 0 && newTimeLeft < DEFAULT_TIME)
											}
											onClick={(e) => onSendEmail(e, 'new')}
										>
											{sendNewLoading ? (
												<Spinner />
											) : newTimeLeft > 0 && newTimeLeft < DEFAULT_TIME ? (
												`${formatTime(newTimeLeft)}`
											) : (
												'获取验证码'
											)}
										</Button>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				) : null}
				<div className="flex items-center justify-end mt-8">
					<Button
						type="submit"
						disabled={loading}
						className="cursor-pointer mr-2 w-20"
					>
						{loading ? <Spinner /> : null}
						确定
					</Button>
					<Button
						variant="outline"
						type="reset"
						className="cursor-pointer w-20"
						onClick={onOpenChange}
					>
						取消
					</Button>
				</div>
			</form>
		</Form>
	);
};

export default ResetEmailForm;
