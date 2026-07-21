import { Outlet } from 'react-router';

/** 插件中心路由壳：列表 / 配置编辑等子路由 */
export default function PluginsLayout() {
	return (
		<div className="h-full min-h-0 w-full min-w-0">
			<Outlet />
		</div>
	);
}
