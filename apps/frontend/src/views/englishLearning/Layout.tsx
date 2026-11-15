/**
 * 英语学习路由壳：首页、导入、资源库、收藏、拉取结果（stream）等子路由。
 */
import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import {
	bindPointCommand,
	closePoint,
	HostPoint,
	layoutDrawerSlots,
	POINT,
} from '@/federation';
import { playPreferred, stopAllPlayback } from '@/utils/speech';

export default function Layout() {
	const { pathname, search } = useLocation();
	const navigate = useNavigate();

	useEffect(() => {
		const unbindOpen = bindPointCommand(
			POINT.dailyReadingArticle,
			'openReading',
			(arg) => {
				if (typeof arg !== 'string' || !arg.trim()) return false;
				navigate(
					`/english-learning/daily-reading/${encodeURIComponent(arg.trim())}`,
				);
				return true;
			},
		);
		const unbindPlay = bindPointCommand(
			POINT.dailyReadingArticle,
			'play',
			(arg) => {
				const text = typeof arg === 'string' ? arg.trim() : '';
				if (!text) return Promise.resolve();
				return playPreferred(text, {
					persistDisk: true,
					cacheFolder: 'daily_reading_words',
					cacheTitle: text,
				});
			},
		);
		const unbindStop = bindPointCommand(
			POINT.dailyReadingArticle,
			'stop',
			() => {
				stopAllPlayback();
			},
		);
		return () => {
			unbindOpen();
			unbindPlay();
			unbindStop();
		};
	}, [navigate]);

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
