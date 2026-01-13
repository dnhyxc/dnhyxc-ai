import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { RadioGroup, RadioGroupItem } from '@ui/radio-group';
import { ScrollArea } from '@ui/scroll-area';
import { Toast } from '@ui/sonner';
import { SquarePen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Model from '@/components/design/Model';
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
	const [verifyCodes, setVerifyCodes] = useState({
		newVerifyCode: '',
		oldVerifyCode: '',
	});
	const [newEmail, setNewEmail] = useState('');
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

	const onSubmitEdit = async () => {
		const res = await updateEmail({
			id: userInfo.id,
			email: newEmail,
			oldVerifyCode: verifyCodes.oldVerifyCode,
			newVerifyCode: verifyCodes.newVerifyCode,
			oldVerifyCodeKey: verifyCodeInfo.oldVerifyCodeKey,
			newVerifyCodeKey: verifyCodeInfo.newVerifyCodeKey,
		});
		if (res.code === 200) {
			setStorage(
				'userInfo',
				JSON.stringify({
					...userInfo,
					email: newEmail,
				}),
			);
			setAccountInfo({
				...accountInfo,
				email: newEmail,
			});
			onOpenChange();
		}
		Toast({
			title: res.success ? '修改成功' : '修改失败',
			type: res.success ? 'success' : 'error',
		});
	};

	const onOpenChange = () => {
		setOpen(false);
		setVerifyCodes({
			oldVerifyCode: '',
			newVerifyCode: '',
		});
		setVerifyCodeInfo({
			oldVerifyCodeKey: '',
			newVerifyCodeKey: '',
		});
		setNewEmail('');
	};

	const onSendEmail = async (key: string) => {
		const email = key === 'old' ? userInfo.email : newEmail;
		const res = await sendEmail(email, {
			key: key === 'old' ? 'OLD_EMAIL' : 'NEW_EMAIL',
			timeout: 360 * 1000,
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
			Toast({
				type: 'success',
				title: '发送成功',
			});
		} else {
			Toast({
				type: 'error',
				title: '发送失败',
			});
		}
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
				onOpenChange={onOpenChange}
				onSubmit={onSubmitEdit}
			>
				<div>
					<div className="flex flex-col mt-1.5">
						<span className="mb-1">原邮箱</span>
						<Input
							placeholder="请输入新邮箱"
							className="mb-3"
							disabled
							value={userInfo.email}
						/>
					</div>
					<div className="flex flex-col mt-1.5">
						<span className="mb-1">原邮箱验证码</span>
						<div className="flex items-center">
							<Input
								placeholder="请输入验证码"
								value={verifyCodes.oldVerifyCode}
								onChange={(e) =>
									setVerifyCodes({
										...verifyCodes,
										oldVerifyCode: e.target.value,
									})
								}
							/>
							<Button
								className="cursor-pointer ml-2"
								onClick={() => onSendEmail('old')}
							>
								获取验证码
							</Button>
						</div>
					</div>
					<div className="flex flex-col mt-5">
						<span className="mb-1">新邮箱</span>
						<Input
							placeholder="请输入新邮箱"
							className="mb-3"
							value={newEmail}
							onChange={(e) => setNewEmail(e.target.value)}
						/>
					</div>
					<div className="flex flex-col mt-2">
						<span className="mb-1">新邮箱验证码</span>
						<div className="flex items-center mb-4">
							<Input
								placeholder="请输入验证码"
								value={verifyCodes.newVerifyCode}
								onChange={(e) =>
									setVerifyCodes({
										...verifyCodes,
										newVerifyCode: e.target.value,
									})
								}
							/>
							<Button
								className="cursor-pointer ml-2"
								onClick={() => onSendEmail('new')}
							>
								获取验证码
							</Button>
						</div>
					</div>
				</div>
			</Model>
		</div>
	);
};

export default Account;
