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
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { sendEmail, updateEmail } from '@/service';
import { setStorage } from '@/utils';

interface IProps {
	userInfo: any;
	onOpenChange: () => void;
	handleAccountInfo: (email: string) => void;
}

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
				setSendOldLoading(true);
			} else {
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
			if (res.code === 200) {
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
			if (res.code === 200) {
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
										className="ml-2 cursor-pointer"
										disabled={sendOldLoading}
										onClick={(e) => onSendEmail(e, 'old')}
									>
										{sendOldLoading ? <Spinner /> : null}
										获取验证码
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
											className="ml-2 cursor-pointer flex items-center"
											disabled={sendNewLoading || !form.watch('email')}
											onClick={(e) => onSendEmail(e, 'new')}
										>
											{sendNewLoading ? <Spinner /> : null}
											获取验证码
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
