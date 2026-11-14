/**
 * 英语学习路由壳：首页、导入、资源库、收藏、拉取结果（stream）等子路由。
 */
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { closePoint, HostPoint, layoutDrawerSlots } from '@/federation';
import { stopAllPlayback } from '@/utils/speech';

export default function Layout() {
	const { pathname, search } = useLocation();

	// 子页切换或离开英语学习时停播，避免跨页继续朗读
	useEffect(() => {
		return () => stopAllPlayback();
	}, [pathname, search]);

	// 只在离开英语学习时关抽屉。子页之间切换保持当前词。
	useEffect(() => {
		return () => {
			for (const { pointId, slot } of layoutDrawerSlots) {
				closePoint(pointId, slot.name);
			}
		};
	}, []);

	return (
		<div className="h-full min-h-0 w-full min-w-0">
			<Outlet />
			{layoutDrawerSlots.map(({ pointId, slot }) =>
				slot.layout?.page ? null : (
					<HostPoint
						key={`${pointId}:${slot.name}`}
						pointId={pointId}
						slot={slot.name}
					/>
				),
			)}
		</div>
	);
}
