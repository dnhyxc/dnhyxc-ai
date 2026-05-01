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
import { useCountdown, useI18n } from '@/hooks';
import { resetPassword, sendResetPasswordEmail } from '@/service';
import { encrypt, formatTime, removeStorage } from '@/utils';

interface IProps {
	onForgetPwd: (status?: boolean) => void;
	switchLogin: (status?: boolean) => void;
}

const ForgetPwdForm: React.FC<IProps> = ({ onForgetPwd, switchLogin }) => {
	const [verifyCodeKey, setVerifyCodeKey] = useState('');
	const [sendLoading, setSendLoading] = useState(false);
	const [resetLoading, setResetLoading] = useState(false);
	const { t } = useI18n();

	const { timeLeft, startTimer } = useCountdown(60, 'forget_countdown');

	const formSchema = z
		.object({
			username: z.string().min(2, {
				message: t('auth.validation.usernameMin'),
			}),
			password: z
				.string()
				.trim()
				.min(8, { message: t('auth.validation.passwordMin') })
				.regex(
					/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).+$/,
					{
						message: t('auth.validation.passwordComplex'),
					},
				),
			confirmPassword: z
				.string()
				.trim()
				.min(8, { message: t('auth.validation.passwordMin') })
				.regex(
					/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).+$/,
					{
						message: t('auth.validation.passwordComplex'),
					},
				),
			email: z
				.string()
				.trim()
				.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
					message: t('auth.validation.emailInvalid'),
				}),
			verifyCode: z
				.string()
				.trim()
				.min(6, { message: t('auth.validation.verifyCodeMin') }),
		})
		.refine((data) => data.password === data.confirmPassword, {
			message: t('auth.validation.passwordMismatch'),
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
				title: t('auth.username.requiredFirst'),
				type: 'warning',
			});
			return;
		}
		try {
			startTimer();
			setSendLoading(true);
			const res = await sendResetPasswordEmail({
				username: form.watch('username'),
				email: form.watch('email'),
			});
			setSendLoading(false);
			if (res.success) {
				setVerifyCodeKey(res.data.key);
				Toast({
					title: t('auth.verifyCode.sentSuccess'),
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
				title: t('auth.resetPassword.success'),
				type: 'success',
			});
			if (res.success) {
				onForgetPwd(false);
				goToLogin();
				removeStorage('forget_countdown_time');
				removeStorage('forget_countdown_state');
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
							<FormLabel className="text-md">{t('auth.username')}</FormLabel>
							<FormControl>
								<Input
									placeholder={t('auth.username.placeholder')}
									{...field}
									className=""
								/>
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
							<FormLabel className="text-md">{t('auth.password')}</FormLabel>
							<FormControl>
								<Input
									type="password"
									placeholder={t('auth.password.placeholder')}
									{...field}
								/>
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
							<FormLabel className="text-md">
								{t('auth.confirmPassword')}
							</FormLabel>
							<FormControl>
								<Input
									type="password"
									placeholder={t('auth.confirmPassword.placeholder')}
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
							<FormLabel className="text-md">{t('auth.email')}</FormLabel>
							<FormControl>
								<Input placeholder={t('auth.email.placeholder')} {...field} />
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
							<FormLabel className="text-md">{t('auth.verifyCode')}</FormLabel>
							<FormControl className="flex items-center">
								<div className="flex items-center">
									<Input
										maxLength={6}
										inputMode="numeric"
										placeholder={t('auth.verifyCode.placeholder.email')}
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
											sendLoading ||
											!form.watch('email') ||
											(timeLeft > 0 && timeLeft < 60)
										}
										onClick={onGetVerifyCode}
									>
										{sendLoading ? (
											<Spinner />
										) : timeLeft > 0 && timeLeft < 60 ? (
											`${formatTime(timeLeft)}`
										) : (
											t('auth.verifyCode.send')
										)}
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
						{t('auth.resetPassword.submit')}
					</Button>
					<Button
						variant="outline"
						className="cursor-pointer mt-5 flex-1 ml-4"
						onClick={goToLogin}
					>
						{t('auth.login.back')}
					</Button>
				</div>
			</form>
		</Form>
	);
};

export default ForgetPwdForm;
