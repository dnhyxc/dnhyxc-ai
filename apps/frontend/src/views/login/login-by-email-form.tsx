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
import { useCountdown, useI18n } from '@/hooks';
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
	const { t } = useI18n();

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
			.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
				message: t('auth.validation.emailInvalid'),
			}),
		verifyCode: z
			.string()
			.trim()
			.min(6, { message: t('auth.validation.verifyCodeMin') }),
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
			setStorage('token', res.data.access_token);
			http.setAuthToken(res.data.access_token);
			userStore.setUserInfo(res.data);
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
							<FormControl>
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
											(timeLeft > 0 && timeLeft < 60) || !form.watch('email')
										}
										onClick={onGetVerifyCode}
									>
										{timeLeft > 0 && timeLeft < 60
											? `${formatTime(timeLeft)}`
											: t('auth.verifyCode.send')}
									</Button>
								</div>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button type="submit" className="cursor-pointer w-full mt-5">
					{t('auth.login.submit')}
				</Button>
			</form>
		</Form>
	);
};

export default LoginByEmailForm;
