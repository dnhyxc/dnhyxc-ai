/**
 * 英语学习路由壳：首页、导入、资源库、收藏、拉取结果（stream）等子路由。
 */
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { closeVocabDetail } from '@/federation/modules/vocabDetail/session';
import { closeVocabImport } from '@/federation/modules/vocabDetailImport/session';
import { stopAllPlayback } from '@/utils/speech';
import { VocabDetailDrawer } from './components/vocab/DetailDrawer';
import { VocabImportDrawer } from './components/vocab/ImportDrawer';

export default function Layout() {
	const { pathname, search } = useLocation();

	// 子页切换或离开英语学习时停播，避免跨页继续朗读
	useEffect(() => {
		return () => stopAllPlayback();
	}, [pathname, search]);

	// 只在离开英语学习时关抽屉。子页之间切换保持当前词。
	useEffect(() => {
		return () => {
			closeVocabDetail();
			closeVocabImport();
		};
	}, []);

	return (
		<div className="h-full min-h-0 w-full min-w-0">
			<Outlet />
			{/* 导入在前，详解后挂到 body，同一层叠时详解盖在上面 */}
			<VocabImportDrawer />
			<VocabDetailDrawer />
		</div>
	);
}
