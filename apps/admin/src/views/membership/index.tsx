import { CreditCard, Crown, Mail, UserCircle, Wallet } from 'lucide-react';
import { observer } from 'mobx-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { membershipApi } from '@/service';
import { authStore } from '@/store';

const MembershipPage = observer(() => {
	const [upgrading, setUpgrading] = useState(false);
	const user = authStore.user;

	const handleUpgrade = async () => {
		setUpgrading(true);
		try {
			const res = await membershipApi.createCheckoutSession({
				plan: 'premium',
			});
			const url = (res as { url?: string })?.url;
			if (url) {
				window.open(url, '_blank');
			}
			toast.success('已创建支付会话，请前往支付页面完成升级');
		} catch (e) {
			toast.error('升级失败，请稍后重试');
		} finally {
			setUpgrading(false);
		}
	};

	return (
		<div className="space-y-4">
			<Card className="border-0 shadow-sm">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<Crown size={18} className="text-amber-500" />
						我的会员
					</CardTitle>
					<CardDescription>查看当前账户的会员状态与权益</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-2">
						{/* 用户信息 */}
						<div className="rounded-lg border p-5">
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<UserCircle size={16} />
								<span>账户信息</span>
							</div>
							<div className="mt-4 space-y-3">
								<div>
									<p className="text-xs text-muted-foreground">用户名</p>
									<p className="mt-1 font-medium">{user?.username || '—'}</p>
								</div>
								<div>
									<p className="text-xs text-muted-foreground">邮箱</p>
									<p className="mt-1 flex items-center gap-1.5 font-medium">
										<Mail size={14} className="text-muted-foreground" />
										{user?.email || '—'}
									</p>
								</div>
							</div>
						</div>

						{/* 会员状态 */}
						<div className="rounded-lg border p-5">
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<CreditCard size={16} />
								<span>会员状态</span>
							</div>
							<div className="mt-4 space-y-3">
								<div className="flex items-center justify-between">
									<p className="text-xs text-muted-foreground">当前状态</p>
									<Badge variant={user?.isMember ? 'success' : 'secondary'}>
										{user?.isMember ? '有效会员' : '免费用户'}
									</Badge>
								</div>
								<div className="flex items-center justify-between">
									<p className="text-xs text-muted-foreground">会员类型</p>
									<Badge variant="default">
										{user?.membershipType || '无'}
									</Badge>
								</div>
								<div className="flex items-center justify-between">
									<p className="text-xs text-muted-foreground">到期时间</p>
									<span className="text-sm font-medium">
										{user?.memberExpiresAt
											? formatDate(user.memberExpiresAt)
											: '永久'}
									</span>
								</div>
							</div>
						</div>
					</div>

					{/* 升级入口 */}
					<div className="mt-4 flex items-center justify-between rounded-lg bg-gradient-to-r from-amber-500/10 to-rose-500/10 p-5">
						<div className="flex items-center gap-3">
							<div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
								<Wallet size={20} />
							</div>
							<div>
								<p className="font-medium">升级高级会员</p>
								<p className="text-xs text-muted-foreground">
									解锁更多权益与更高使用额度
								</p>
							</div>
						</div>
						<Button onClick={handleUpgrade} disabled={upgrading}>
							{upgrading ? '处理中...' : '升级会员'}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
});

export default MembershipPage;
