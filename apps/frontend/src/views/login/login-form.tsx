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
import { useI18n } from '@/hooks';
import { createVerifyCode, login } from '@/service';
import useStore from '@/store';
import { encrypt, setStorage } from '@/utils';
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
	const { t } = useI18n();

	const { userStore } = useStore();

	useEffect(() => {
		getCaptcha();
	}, []);

	const getCaptcha = async () => {
		try {
			// 获取验证码
			setIsLoading(true);
			const res = await createVerifyCode();
			setIsLoading(false);
			if (res) {
				setCaptchaInfo({
					captchaId: res.data.captchaId,
					captcha: res.data.captcha,
				});
			}
		} catch (_error) {
			Toast({
				title: t('auth.captcha.fetchFailed'),
				type: 'error',
			});
		}
	};

	const formSchema = z.object({
		username: z
			.string()
			.trim()
			.min(2, {
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
		captchaText: z
			.string()
			.trim()
			.min(4, {
				message: t('auth.validation.captchaMin'),
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
		try {
			const res = await login({
				...values,
				password: encrypt(values.password),
				captchaId: captchaInfo.captchaId,
			});
			if (res.success) {
				userStore.setUserInfo(res.data);
				setStorage('token', res.data.access_token);
				http.setAuthToken(res.data.access_token);
				navigate('/');
				onForgetPwd(false);
			}
		} catch (_error) {
			await getCaptcha();
		}
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
					name="captchaText"
					render={({ field }) => (
						<FormItem>
							<FormLabel className="text-md">{t('auth.captcha')}</FormLabel>
							<FormControl>
								<div className="flex items-center justify-between">
									<Input
										placeholder={t('auth.captcha.placeholder')}
										{...field}
									/>
									{captchaInfo.captcha && (
										<div className="flex items-center justify-center relative ml-2 rounded-md hover:border-theme/30 hover:ring-theme/30 hover:ring-[3px] group">
											<div
												dangerouslySetInnerHTML={{
													__html: captchaInfo.captcha,
												}}
												className="
													h-[36px] w-[115px] flex justify-center items-center 
													border border-theme hover:border-theme/50 rounded-md dark:border-white [&>svg]:rounded-md cursor-pointer 
												"
												onClick={getCaptcha}
											/>
											{isLoading && (
												<div className="absolute top-0 left-0 w-[115px] h-full bg-theme/50 opacity-50 rounded-md">
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
					{t('auth.login.submit')}
				</Button>
			</form>
		</Form>
	);
};

export default LoginForm;
