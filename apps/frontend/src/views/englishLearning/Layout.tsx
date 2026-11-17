/**
 * 英语学习路由壳：首页、导入、资源库、收藏、拉取结果（stream）等子路由。
 */
import { Toast } from '@ui/sonner';
import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import {
	bindPointCommand,
	closePoint,
	HostPoint,
	layoutDrawerSlots,
	POINT,
} from '@/federation';
import { useI18n } from '@/hooks';
import { stopAllPlayback } from '@/utils/speech';
import { exportDailyReadingWords } from './utils/exportReadingWords';

export default function Layout() {
	const { pathname, search } = useLocation();
	const navigate = useNavigate();
	const { t } = useI18n();

	// 这两条要路由和文案。其余文章点命令在 command.ts，不跟这个壳走
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
		const unbindExport = bindPointCommand(
			POINT.dailyReadingArticle,
			'exportWords',
			async (arg) => {
				try {
					await exportDailyReadingWords(arg, t);
				} catch {
					Toast({
						type: 'error',
						title: t('englishLearning.export.failed'),
					});
				}
			},
		);
		return () => {
			unbindOpen();
			unbindExport();
		};
	}, [navigate, t]);

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
