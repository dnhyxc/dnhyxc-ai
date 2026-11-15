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
	isPluginEnabled,
	layoutDrawerSlots,
	openPoint,
	POINT,
} from '@/federation';
import { useI18n } from '@/hooks';
import { playPreferred, stopAllPlayback } from '@/utils/speech';
import { exportDailyReadingWords } from './utils/exportReadingWords';

function wordOf(arg: unknown): string {
	if (typeof arg === 'string') return arg.trim();
	if (arg && typeof arg === 'object' && 'word' in arg) {
		const word = (arg as { word?: unknown }).word;
		return typeof word === 'string' ? word.trim() : '';
	}
	return '';
}

export default function Layout() {
	const { pathname, search } = useLocation();
	const navigate = useNavigate();
	const { t } = useI18n();

	// 生词插件不能直接调主站。命令挂在篇目点上，只在这个壳挂载期间有效
	useEffect(() => {
		// 点来源标题时按篇目 id 进阅读页。非字符串或空白返回 false，插件自己提示打不开
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
		// 朗读单词或例句。空白不发起合成，交给插件一个已完成的 Promise，避免当成播放失败
		const unbindPlay = bindPointCommand(
			POINT.dailyReadingArticle,
			'play',
			(arg) => {
				const text = typeof arg === 'string' ? arg.trim() : '';
				if (!text) return Promise.resolve();
				// 会员优先云端，失败回本机；同一段文字写入生词缓存目录，下次不再合成
				return playPreferred(text, {
					persistDisk: true,
					cacheFolder: 'daily_reading_words',
					cacheTitle: text,
				});
			},
		);
		// 停掉当前正在播的声音，不区分单词和句子。插件卸载时也会调，离开本壳后绑定已拆
		const unbindStop = bindPointCommand(
			POINT.dailyReadingArticle,
			'stop',
			() => {
				stopAllPlayback();
			},
		);
		// 告诉生词页三个入口能不能显示。插件未启用时对应按钮不渲染
		const unbindEntries = bindPointCommand(
			POINT.dailyReadingArticle,
			'detailEntries',
			() => ({
				detail: isPluginEnabled('vocabDetail'),
				list: isPluginEnabled('vocabDetailList'),
				import: isPluginEnabled('vocabDetailImport'),
			}),
		);
		// 打开单词解析抽屉。没有词返回 false，插件提示先启用解析
		const unbindDetail = bindPointCommand(
			POINT.dailyReadingArticle,
			'openDetail',
			(arg) => {
				const word = wordOf(arg);
				if (!word) return false;
				// 生词卡片会带上已有的中文和例句，解析抽屉不用再等一次空态
				const extra =
					arg && typeof arg === 'object'
						? (arg as {
								translationZh?: unknown;
								example?: unknown;
								source?: unknown;
							})
						: {};
				return openPoint(POINT.vocabCard, 'vocabDetail', 'drawer', {
					word,
					translationZh:
						typeof extra.translationZh === 'string' ? extra.translationZh : '',
					example: typeof extra.example === 'string' ? extra.example : '',
					// 从列表点进来才标 source。详解直接出现，底下的列表和导入只隐藏不关闭
					...(extra.source === 'list' ? { source: 'list' as const } : {}),
				});
			},
		);
		// 打开解析列表，范围限定每日阅读生词，不走某个词库的 libraryId
		const unbindList = bindPointCommand(
			POINT.dailyReadingArticle,
			'openDetailList',
			() =>
				openPoint(POINT.vocabLibrary, 'vocabDetailList', 'drawer', {
					scope: 'dailyReading',
				}),
		);
		// 导入走另一个槽，才能叠在列表上面。允许导入的词是用户收集过的生词
		const unbindImport = bindPointCommand(
			POINT.dailyReadingArticle,
			'openDetailImport',
			() =>
				openPoint(POINT.vocabLibrary, 'vocabDetailImport', 'import-drawer', {
					scope: 'dailyReading',
				}),
		);
		// 按当前篇目和搜索词导出。失败在这里提示，插件不用再处理异常
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
		// 离开英语学习时拆掉全部命令。插件若在拆掉之后再调 stop，会得到未绑定
		return () => {
			unbindOpen();
			unbindPlay();
			unbindStop();
			unbindEntries();
			unbindDetail();
			unbindList();
			unbindImport();
			unbindExport();
		};
		// 路由函数或文案语言变了要重绑，否则导出提示和跳转还是上一次的闭包
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
