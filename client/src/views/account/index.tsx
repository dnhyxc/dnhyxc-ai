import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { RadioGroup, RadioGroupItem } from '@ui/radio-group';
import { ScrollArea } from '@ui/scroll-area';
import { Toast } from '@ui/sonner';
import { SquarePen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Model from '@/components/design/Model';
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form';
import { sendEmail, updateEmail, updateUser } from '@/service';
import { getStorage, setStorage } from '@/utils';

const GenderEnum: Record<string, string> = {
	1: '男',
	2: '女',
	3: '不便透露',
};

const Account = () => {
	const [open, setOpen] = useState(false);
	const [editKey, setEditKey] = useState('');
	const [accountInfo, setAccountInfo] = useState({
		id: 0,
		username: '',
		email: '',
		gender: '3',
		address: '',
		avatar: '',
	});
	const [verifyCodeInfo, setVerifyCodeInfo] = useState({
		oldVerifyCodeKey: '',
		newVerifyCodeKey: '',
	});

	const userInfo = useMemo(
		() => JSON.parse(getStorage('userInfo') || '{}'),
		[],
	);

	useEffect(() => {
		setAccountInfo({
			id: userInfo.id,
			username: userInfo.username,
			email: userInfo.email,
			...(userInfo.profile || { gender: '3', avatar: '', address: '' }),
		});
	}, [userInfo]);

	const onChangeInputValue = (data: object) => {
		setAccountInfo({
			...accountInfo,
			...data,
		});
	};

	const setEdit = (key: string) => {
		setEditKey(key);
	};

	const onEditEmail = () => {
		setOpen(true);
	};

	const userInfos = useMemo(
		() => [
			{
				label: '昵称',
				key: 'username',
				value: accountInfo.username || '-',
				component: (
					<Input
						placeholder="请输入昵称"
						className="w-82"
						value={accountInfo.username || ''}
						onChange={(e) =>
							onChangeInputValue({ username: e.currentTarget.value })
						}
					/>
				),
			},
			{
				label: '性别',
				key: 'gender',
				value: GenderEnum[accountInfo?.gender || '3'],
				component: (
					<RadioGroup
						value={accountInfo?.gender?.toString() || ''}
						className="flex items-center ml-2"
						onValueChange={(e) => {
							onChangeInputValue({ gender: e });
						}}
					>
						<div className="flex items-center gap-2 mr-5">
							<RadioGroupItem value="1" id="c1" className="cursor-pointer" />
							<Label htmlFor="c1" className="text-md cursor-pointer">
								男
							</Label>
						</div>
						<div className="flex items-center gap-2 mr-5">
							<RadioGroupItem value="2" id="c2" className="cursor-pointer" />
							<Label htmlFor="c2" className="text-md cursor-pointer">
								女
							</Label>
						</div>
						<div className="flex items-center gap-2">
							<RadioGroupItem value="3" id="c3" className="cursor-pointer" />
							<Label htmlFor="c3" className="text-md cursor-pointer">
								不便透露
							</Label>
						</div>
					</RadioGroup>
				),
			},
			{
				label: '邮箱',
				key: 'email',
				value: accountInfo.email || '-',
				icon: (
					<SquarePen
						size={18}
						className="cursor-pointer text-transparent group-hover:text-green-500"
						onClick={onEditEmail}
					/>
				),
				component: (
					<Input
						placeholder="请输入邮箱"
						className="w-82"
						value={accountInfo.email || ''}
						onChange={(e) =>
							onChangeInputValue({ email: e.currentTarget.value })
						}
					/>
				),
			},
			{
				label: '地址',
				key: 'address',
				value: accountInfo.address || '-',
				component: (
					<Input
						placeholder="请输入地址"
						className="w-82"
						value={accountInfo.address || ''}
						onChange={(e) =>
							onChangeInputValue({
								address: e.currentTarget.value,
							})
						}
					/>
				),
			},
		],
		[accountInfo],
	);

	const onSubmit = async (key: string) => {
		const value = accountInfo[key as keyof typeof accountInfo];
		const actions = {
			username: { username: value },
			email: { email: value },
			gender: {
				profile: {
					avatar: accountInfo.avatar,
					address: accountInfo.address,
					gender: +value,
				},
			},
			address: {
				profile: {
					avatar: accountInfo.avatar,
					gender: +accountInfo.gender,
					address: value,
				},
			},
		};
		const res = await updateUser(
			accountInfo.id,
			actions[key as keyof typeof actions],
		);
		if (res.success) {
			Toast({
				type: 'success',
				title: '修改成功',
			});
			setStorage('userInfo', JSON.stringify({ ...userInfo, ...res.data }));
			setEditKey('');
		} else {
			Toast({
				type: 'error',
				title: '修改失败',
			});
		}
	};

	const onCancel = () => {
		setEditKey('');
	};

	const onOpenChange = () => {
		setOpen(false);
		form.reset();
		setVerifyCodeInfo({
			oldVerifyCodeKey: '',
			newVerifyCodeKey: '',
		});
	};

	const onSendEmail = async (
		e: React.MouseEvent<HTMLButtonElement>,
		key: string,
	) => {
		e.preventDefault();
		const email = key === 'old' ? userInfo.email : form.watch('email');
		const res = await sendEmail(email, {
			key: key === 'old' ? 'OLD_EMAIL' : 'NEW_EMAIL',
			timeout: 300 * 1000,
		});
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
			title: res.success ? '获取验证码成功' : '获取验证码失败',
			type: res.success ? 'success' : 'error',
		});
	};

	const formSchema = z.object({
		email: z
			.string()
			.trim()
			.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: '请输入合法的邮箱地址' }),
		oldVerifyCode: z
			.string()
			.trim()
			.min(6, { message: '验证码至少输入6个字符' }),
		newVerifyCode: z
			.string()
			.trim()
			.min(6, { message: '验证码至少输入6个字符' }),
	});

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: '',
			oldVerifyCode: '',
			newVerifyCode: '',
		},
	});

	const onSubmitEmail = async (values: z.infer<typeof formSchema>) => {
		if (!verifyCodeInfo.oldVerifyCodeKey || !verifyCodeInfo.newVerifyCodeKey) {
			return Toast({
				type: 'info',
				title: '验证码 Key 不能为空',
			});
		}
		const res = await updateEmail({
			id: userInfo.id,
			email: values.email,
			oldVerifyCode: values.oldVerifyCode,
			newVerifyCode: values.newVerifyCode,
			oldVerifyCodeKey: verifyCodeInfo.oldVerifyCodeKey,
			newVerifyCodeKey: verifyCodeInfo.newVerifyCodeKey,
		});
		if (res.code === 200) {
			setStorage(
				'userInfo',
				JSON.stringify({
					...userInfo,
					email: values.email,
				}),
			);
			setAccountInfo({
				...accountInfo,
				email: values.email,
			});
			onOpenChange();
		}
		Toast({
			title: res.success ? '修改成功' : '修改失败',
			type: res.success ? 'success' : 'error',
		});
	};

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<ScrollArea className="w-full h-full overflow-y-auto p-2.5 rounded-none">
				<div className="bg-gray-300 dark:bg-gray-900 rounded-md">
					<div className="h-45 flex items-center justify-between gap-3 relative">
						<div className="absolute left-10 -bottom-10 p-2 rounded-md bg-gray-800 box-border">
							<img
								src="https://picsum.photos/130/130"
								alt="avatar"
								className="w-32.5 h-32.5"
							/>
						</div>
						<div className="flex-1 flex flex-col h-full pl-50 pt-5">
							<div className="flex flex-col items-start mt-20 pl-10">
								{userInfos.map((i) => {
									return (
										<div
											key={i.key}
											className="flex flex-col items-center mt-5 text-md font-semibold h-10"
										>
											{editKey !== i.key ? (
												<div className="flex flex-1 w-full items-center gap-1 group">
													<span className="min-w-10">{i.label}</span>
													<span className="ml-10">{i.value}</span>
													{i.icon || (
														<SquarePen
															size={18}
															className="cursor-pointer text-transparent group-hover:text-green-500"
															onClick={() => setEdit(i.key)}
														/>
													)}
												</div>
											) : null}
											{editKey === i.key ? (
												<div className="flex flex-1 w-full items-center gap-1">
													<span className="min-w-10 mr-10">{i.label}</span>
													{i.component}
													<Button
														className="mx-2 cursor-pointer dark:hover:bg-gray-300 hover:bg-gray-800"
														onClick={() => onSubmit(i.key)}
													>
														确定
													</Button>
													<Button
														variant="outline"
														className="cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-700"
														onClick={onCancel}
													>
														取消
													</Button>
												</div>
											) : null}
										</div>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			</ScrollArea>
			<Model
				open={open}
				title="修改邮箱"
				width="350px"
				footer={null}
				onOpenChange={onOpenChange}
			>
				{/* TODO: 回车问题 */}
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmitEmail)}
						className="space-y-6"
					>
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
											<Input placeholder="请输入原邮箱验证码" {...field} />
											<Button
												className="ml-2 cursor-pointer"
												onClick={(e) => onSendEmail(e, 'old')}
											>
												获取验证码
											</Button>
										</div>
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
									<FormLabel className="text-md">新邮箱</FormLabel>
									<FormControl>
										<Input type="email" placeholder="请输入新邮箱" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="newVerifyCode"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-md">新邮箱验证码</FormLabel>
									<FormControl>
										<div className="flex items-center">
											<Input placeholder="请输入新邮箱验证码" {...field} />
											<Button
												className="ml-2 cursor-pointer"
												onClick={(e) => onSendEmail(e, 'new')}
											>
												获取验证码
											</Button>
										</div>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className="flex items-center justify-end mt-8">
							<Button type="submit" className="cursor-pointer mr-2 w-20">
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
			</Model>
		</div>
	);
};

export default Account;
