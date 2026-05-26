import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { RadioGroup, RadioGroupItem } from '@ui/radio-group';
import { ScrollArea } from '@ui/scroll-area';
import { Toast } from '@ui/sonner';
import { SquarePen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Model from '@/components/design/Model';
import Upload from '@/components/design/Upload';
import { useI18n, useStorageInfo } from '@/hooks';
import { updateUser, uploadCosFile } from '@/service';
import useStore from '@/store';
import { type FileWithPreview } from '@/types';
import { resolveCosUrlForWebDisplay } from '@/utils';
import ResetEmailForm from './reset-email-form';

const Account = () => {
	const { userStore } = useStore();
	const { t, locale } = useI18n();
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
				label: t('account.fields.nickname'),
				key: 'username',
				value: accountInfo.username || '-',
				component: (
					<Input
						placeholder={t('account.placeholders.nickname')}
						className="w-82"
						value={accountInfo.username || ''}
						onChange={(e) =>
							onChangeInputValue({ username: e.currentTarget.value })
						}
					/>
				),
			},
			{
				label: t('account.fields.gender'),
				key: 'gender',
				value:
					accountInfo?.gender === '1'
						? t('account.gender.male')
						: accountInfo?.gender === '2'
							? t('account.gender.female')
							: t('account.gender.secret'),
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
								{t('account.gender.male')}
							</Label>
						</div>
						<div className="flex items-center gap-2 mr-5">
							<RadioGroupItem value="2" id="c2" className="cursor-pointer" />
							<Label htmlFor="c2" className="text-md cursor-pointer">
								{t('account.gender.female')}
							</Label>
						</div>
						<div className="flex items-center gap-2">
							<RadioGroupItem value="3" id="c3" className="cursor-pointer" />
							<Label htmlFor="c3" className="text-md cursor-pointer">
								{t('account.gender.secret')}
							</Label>
						</div>
					</RadioGroup>
				),
			},
			{
				label: t('account.fields.email'),
				key: 'email',
				value: accountInfo.email || '-',
				icon: (
					<SquarePen
						size={18}
						className="cursor-pointer text-transparent group-hover:text-theme"
						onClick={onEditEmail}
					/>
				),
				component: (
					<Input
						placeholder={t('account.placeholders.email')}
						className="w-82"
						value={accountInfo.email || ''}
						onChange={(e) =>
							onChangeInputValue({ email: e.currentTarget.value })
						}
					/>
				),
			},
			{
				label: t('account.fields.address'),
				key: 'address',
				value: accountInfo.address || '-',
				component: (
					<Input
						placeholder={t('account.placeholders.address')}
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
		[accountInfo, t],
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
			storageInfo.id,
			actions[key as keyof typeof actions],
		);
		if (res.success) {
			Toast({
				type: 'success',
				title: t('account.toast.updateSuccess'),
			});
			const newUserInfo = { ...storageInfo, ...res.data };
			setStorageInfo(newUserInfo);
			userStore.setUserInfo(newUserInfo);
			setEditKey('');
		} else {
			Toast({
				type: 'error',
				title: t('account.toast.updateFailed'),
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

	const uploadAvatarToCos = async (file: File) => {
		const res = await uploadCosFile(file);
		if (res?.data?.url) {
			setAccountInfo((prev) => ({
				...prev,
				avatar: res.data.url,
			}));
		}
	};

	const onUpload = async (file: FileWithPreview | FileWithPreview[]) => {
		const files = Array.isArray(file) ? file : [file];
		await uploadAvatarToCos(files[0].file);
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

	const avatarFileUrl = useMemo(
		() => resolveCosUrlForWebDisplay(accountInfo.avatar),
		[accountInfo.avatar],
	);

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<ScrollArea className="w-full h-full overflow-y-auto p-2.5 rounded-none">
				<div className="bg-theme-background rounded-md">
					<div className="h-45 flex items-center justify-between gap-3 relative">
						<div className="absolute left-10 -bottom-10 p-2 rounded-md bg-theme-secondary box-border">
							<Upload
								key={accountInfo.avatar}
								t={t}
								onUpload={onUpload}
								fileUrl={avatarFileUrl}
								onClearFileUrl={onClearFileUrl}
							>
								{accountInfo.avatar !== storageInfo?.profile?.avatar ? (
									<div className="absolute bottom-1 right-3">
										<Button
											variant="link"
											className="p-0 mr-2 cursor-pointer hover:text-theme"
											onClick={onChangeAvatar}
										>
											{t('account.avatar.change')}
										</Button>
										<Button
											variant="link"
											className="p-0 cursor-pointer hover:text-theme"
											onClick={onCancelAvatar}
										>
											{t('common.cancel')}
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
													<span
														className={
															locale === 'zh-CN' ? 'min-w-6' : 'min-w-18'
														}
													>
														{i.label}
													</span>
													<span className="ml-10">{i.value}</span>
													{i.icon || (
														<SquarePen
															size={18}
															className="cursor-pointer text-transparent group-hover:text-theme"
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
														{t('common.confirm')}
													</Button>
													<Button
														variant="outline"
														className="cursor-pointer"
														onClick={onCancel}
													>
														{t('common.cancel')}
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
				title={t('account.modal.editEmail')}
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
