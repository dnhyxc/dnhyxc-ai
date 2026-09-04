import { Outlet } from 'react-router';

/** 个人主页路由壳：资料 / 账号设置 / 会员充值 */
export default function ProfileLayout() {
	return (
		<div className="h-full min-h-0 w-full min-w-0">
			<Outlet />
		</div>
	);
}
