/**
 * 英语学习：资源库（左右分栏，左侧库列表 + 右侧词条滚动加载）
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import type {
	EnglishClassicQuotesLibraryListItem,
	EnglishVocabularyLibraryListItem,
} from '@/service';
import {
	englishPracticePoolKeys,
	setEnglishPracticePoolMeta,
} from '@/store/englishPracticePool';
import { ClassicQuotesLibraryWordsPanel } from './ClassicQuotesLibraryWordsPanel';
import { invalidateLibraryWordsListCache } from './libraryWordsListCache';
import {
	type EnglishLibraryListItem,
	VocabularyLibraryListPanel,
} from './VocabularyLibraryListPanel';
import { VocabularyLibraryWordsPanel } from './VocabularyLibraryWordsPanel';

type LibraryKind = 'vocab' | 'classic';

function parseKind(raw: string | null): LibraryKind {
	return raw === 'classic' ? 'classic' : 'vocab';
}

export default function EnglishLearningLibraryPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const kind = useMemo(
		() => parseKind(searchParams.get('kind')),
		[searchParams],
	);

	const [selectedLibrary, setSelectedLibrary] =
		useState<EnglishLibraryListItem | null>(null);
	/** 仅 kind 切换时用于左侧列表首次选中，避免点击项改 URL 触发列表重载 */
	const [listBootLibraryId, setListBootLibraryId] = useState<string | null>(
		() => searchParams.get('library'),
	);

	useEffect(() => {
		setListBootLibraryId(searchParams.get('library'));
		setSelectedLibrary(null);
	}, [kind]);

	const onSelectLibrary = useCallback(
		(library: EnglishLibraryListItem) => {
			setSelectedLibrary(library);
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					next.set('kind', kind);
					next.set('library', library.id);
					return next;
				},
				{ replace: true },
			);
		},
		[kind, setSearchParams],
	);

	/**
	 * 当前库被删除时的回调：
	 * 1. 使该库在词条列表的会话内缓存（滚动、分页等）失效，避免下次切回时误用旧缓存。
	 * 2. 清除当前已选中的库。
	 * 3. 从 URL searchParams 中移除 library 字段，防止直接跳回已删除库。
	 */
	const onLibraryDeleted = useCallback(
		(deletedId: string) => {
			invalidateLibraryWordsListCache(kind, deletedId); // 使会话缓存失效
			setSelectedLibrary(null); // 清除当前选中库
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					next.delete('library'); // 从 URL 参数中移除已删除库
					return next;
				},
				{ replace: true },
			);
		},
		[kind, setSearchParams],
	);

	const libraryIdFromUrl = searchParams.get('library');
	const activeLibraryId = selectedLibrary?.id ?? libraryIdFromUrl;

	const vocabLibraryMeta =
		kind === 'vocab' && selectedLibrary
			? (selectedLibrary as EnglishVocabularyLibraryListItem)
			: null;

	useEffect(() => {
		if (kind !== 'vocab' || !activeLibraryId) return;
		const n = vocabLibraryMeta?.wordCount;
		const title = vocabLibraryMeta?.title?.trim();
		if ((typeof n === 'number' && n > 0) || title) {
			setEnglishPracticePoolMeta(
				englishPracticePoolKeys.library(activeLibraryId),
				{
					total: typeof n === 'number' && n > 0 ? n : undefined,
					title,
				},
			);
		}
	}, [
		kind,
		activeLibraryId,
		vocabLibraryMeta?.wordCount,
		vocabLibraryMeta?.title,
	]);

	const classicLibraryMeta =
		kind === 'classic' && selectedLibrary
			? (selectedLibrary as EnglishClassicQuotesLibraryListItem)
			: null;

	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5.5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme/5">
					<ResizablePanelGroup
						id="english-library-split"
						orientation="horizontal"
						className="h-full min-h-0 min-w-0 max-w-full flex-1"
					>
						<ResizablePanel
							id="english-library-sidebar"
							defaultSize="35%"
							className="min-h-0 min-w-0"
						>
							<aside
								className={cn(
									'flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-theme-background',
								)}
							>
								<VocabularyLibraryListPanel
									kind={kind}
									selectedId={activeLibraryId}
									initialLibraryId={listBootLibraryId}
									onSelect={onSelectLibrary}
									onLibraryDeleted={onLibraryDeleted}
								/>
							</aside>
						</ResizablePanel>
						<ResizableHandle withHandle className="w-0" />
						<ResizablePanel
							id="english-library-words"
							defaultSize="65%"
							className="min-h-0 min-w-0"
						>
							<section className="border-l border-theme/5 flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-theme-background">
								{kind === 'vocab' ? (
									<VocabularyLibraryWordsPanel
										libraryId={activeLibraryId}
										libraryMeta={vocabLibraryMeta}
									/>
								) : (
									<ClassicQuotesLibraryWordsPanel
										libraryId={activeLibraryId}
										libraryMeta={classicLibraryMeta}
									/>
								)}
							</section>
						</ResizablePanel>
					</ResizablePanelGroup>
				</div>
			</div>
		</div>
	);
}
