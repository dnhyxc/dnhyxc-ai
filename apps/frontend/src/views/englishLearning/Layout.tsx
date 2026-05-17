/**
 * 英语学习路由壳：子路由为首页（index）与导入页（import）。
 */
import { Outlet } from 'react-router';

export default function Layout() {
	return (
		<div className="h-full min-h-0 w-full min-w-0">
			<Outlet />
		</div>
	);
}
