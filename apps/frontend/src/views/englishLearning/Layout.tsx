/**
 * 英语学习路由壳：首页、导入、资源库、收藏、拉取结果（stream）等子路由。
 */
import { Outlet } from 'react-router';

export default function Layout() {
	return (
		<div className="h-full min-h-0 w-full min-w-0">
			<Outlet />
		</div>
	);
}
