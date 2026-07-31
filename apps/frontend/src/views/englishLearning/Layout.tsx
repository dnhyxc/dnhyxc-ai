/**
 * 英语学习路由壳：首页、导入、资源库、收藏、拉取结果（stream）等子路由。
 */
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { stopAllPlayback } from '@/utils/speech';

export default function Layout() {
	const { pathname, search } = useLocation();

	// 子页切换或离开英语学习时停播，避免跨页继续朗读
	useEffect(() => {
		return () => stopAllPlayback();
	}, [pathname, search]);

	return (
		<div className="h-full min-h-0 w-full min-w-0">
			<Outlet />
		</div>
	);
}
