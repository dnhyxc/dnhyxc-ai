import { zodResolver } from '@hookform/resolvers/zod';
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
import { Input } from '@/components/ui/input';
import { useCountdown, useI18n } from '@/hooks';
import { register, sendEmail } from '@/service';
import { encrypt, formatTime, removeStorage } from '@/utils';

interface IProps {
	onRegister: (status?: boolean) => void;
}

const RegisterForm: React.FC<IProps> = ({ onRegister }) => {
	const [verifyCodeKey, setVerifyCodeKey] = useState('');
	const { timeLeft, startTimer } = useCountdown();
	const { t } = useI18n();

	const formSchema = z.object({
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
			username: '',
			password: '',
			email: '',
			verifyCode: '',
		},
	});

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
					{t('auth.register.submit')}
				</Button>
			</form>
		</Form>
	);
};

export default RegisterForm;
