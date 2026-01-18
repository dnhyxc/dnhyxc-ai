import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { RadioGroup, RadioGroupItem } from '@ui/radio-group';
import { ScrollArea } from '@ui/scroll-area';
import { Toast } from '@ui/sonner';
import { SquarePen } from 'lucide-react';
import * as qiniu from 'qiniu-js';
import { useEffect, useMemo, useState } from 'react';
import Model from '@/components/design/Model';
import Upload, { type FileWithPreview } from '@/components/design/Upload';
import { useStorageInfo } from '@/hooks';
import { getUploadToken, updateUser } from '@/service';
import { setStorage } from '@/utils';
import ResetEmailForm from './reset-email-form';

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

	const { storageInfo, setStorageInfo } = useStorageInfo();

	useEffect(() => {
		setAccountInfo({
			id: storageInfo.id,
			username: storageInfo.username,
			email: storageInfo.email,
			...(storageInfo.profile || {
				gender: '3',
				avatar: '',
				address: '',
			}),
		});
	}, [storageInfo]);

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

		const profile = {
			avatar: accountInfo.avatar,
			address: accountInfo.address,
			gender: +accountInfo.gender,
		};

		const actions = {
			username: { username: value },
			email: { email: value },
			gender: {
				profile: {
					...profile,
					gender: +value,
				},
			},
			address: {
				profile: {
					...profile,
					address: value,
				},
			},
			avatar: {
				profile: {
					...profile,
					avatar: value,
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
			const newUserInfo = { ...storageInfo, ...res.data };
			setStorageInfo(newUserInfo);
			setStorage('userInfo', JSON.stringify(newUserInfo));
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

	const handleAccountInfo = (email: string) => {
		setAccountInfo({
			...accountInfo,
			email,
		});
	};

	const onOpenChange = () => {
		setOpen(false);
	};

	const observer = useMemo(() => {
		return {
			complete(res: { key: string; hash: string }) {
				const url = import.meta.env.VITE_QINIU_DOMAIN + res.key;
				setAccountInfo({
					...accountInfo,
					avatar: url,
				});
			},
		};
	}, [accountInfo]);

	const uploadFile = async (file: File) => {
		const res = await getUploadToken();
		const putExtra = {};
		const config = {};
		const observable = qiniu.upload(
			file,
			file.name,
			res.data, // token
			putExtra,
			config,
		);
		observable.subscribe(observer); // 上传开始
	};

	const onUpload = async (files: FileWithPreview[]) => {
		await uploadFile(files[0].file);
	};

	const onClearFileUrl = () => {
		setAccountInfo({
			...accountInfo,
			avatar: '',
		});
	};

	const onChangeAvatar = () => {
		onSubmit('avatar');
	};

	const onCancelAvatar = () => {
		setAccountInfo({
			...accountInfo,
			avatar: storageInfo?.profile?.avatar || '',
		});
	};

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<ScrollArea className="w-full h-full overflow-y-auto p-2.5 rounded-none">
				<div className="bg-gray-300 dark:bg-gray-900 rounded-md">
					<div className="h-45 flex items-center justify-between gap-3 relative">
						<div className="absolute left-10 -bottom-10 p-2 rounded-md bg-gray-800 box-border">
							<Upload
								key={accountInfo.avatar}
								onUpload={onUpload}
								fileUrl={accountInfo.avatar}
								onClearFileUrl={onClearFileUrl}
							>
								{accountInfo.avatar !== storageInfo?.profile?.avatar ? (
									<div className="absolute bottom-1 right-3">
										<Button
											variant="link"
											className="p-0 mr-2 cursor-pointer hover:text-green-500"
											onClick={onChangeAvatar}
										>
											更换
										</Button>
										<Button
											variant="link"
											className="p-0 cursor-pointer hover:text-green-500"
											onClick={onCancelAvatar}
										>
											取消
										</Button>
									</div>
								) : null}
							</Upload>
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
														className="mx-2 cursor-pointer"
														onClick={() => onSubmit(i.key)}
													>
														确定
													</Button>
													<Button
														variant="outline"
														className="cursor-pointer"
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
				<ResetEmailForm
					userInfo={storageInfo}
					onOpenChange={onOpenChange}
					handleAccountInfo={handleAccountInfo}
				/>
			</Model>
		</div>
	);
};

export default Account;
