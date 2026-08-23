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
	clearElResumeOffset,
	flushElResume,
	resolveElResumeOffset,
	setElResumeOffset,
} from '@/store/englishLearningResume';
import {
	englishPracticePoolKeys,
	setEnglishPracticePoolMeta,
} from '@/store/englishPracticePool';
import { invalidateLibraryWordsListCache } from '../utils/libraryWordsListCache';
import { ClassicQuotesLibrarySection } from './classic';
import { LibraryListPanel } from './components/LibraryListPanel';
import type { EnglishLibraryListItem, LibraryKind } from './types';
import { parseLibraryKind } from './types';
import { VocabularyLibrarySection } from './vocabulary';

export default function EnglishLearningLibraryPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const kind = useMemo(
		() => parseLibraryKind(searchParams.get('kind')),
		[searchParams],
	);

	const [selectedLibrary, setSelectedLibrary] =
		useState<EnglishLibraryListItem | null>(null);
	/** 与 kind 对齐前不展示右侧，避免切 kind 时用错库 id flush */
	const [selectedKind, setSelectedKind] = useState<LibraryKind | null>(null);
	/** 仅 kind 切换时用于左侧列表首次选中，避免点击项改 URL 触发列表重载 */
	const [listBootLibraryId, setListBootLibraryId] = useState<string | null>(
		() => searchParams.get('library'),
	);

	useEffect(() => {
		setListBootLibraryId(searchParams.get('library'));
		setSelectedLibrary(null);
		setSelectedKind(null);
	}, [kind]);

	const onSelectLibrary = useCallback(
		(library: EnglishLibraryListItem) => {
			const itemsResumeOffset = resolveElResumeOffset(
				kind,
				library.id,
				library.itemsResumeOffset ?? 0,
			);
			setSelectedKind(kind);
			setSelectedLibrary({ ...library, itemsResumeOffset });
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

	const onLibraryDeleted = useCallback(
		(deletedId: string) => {
			invalidateLibraryWordsListCache(kind, deletedId);
			clearElResumeOffset(kind, deletedId);
			setSelectedLibrary(null);
			setSelectedKind(null);
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					next.delete('library');
					return next;
				},
				{ replace: true },
			);
		},
		[kind, setSearchParams],
	);

	const onResumeOffsetChange = useCallback(
		(libraryId: string, offset: number) => {
			setElResumeOffset(kind, libraryId, offset);
			setSelectedLibrary((prev) =>
				prev?.id === libraryId ? { ...prev, itemsResumeOffset: offset } : prev,
			);
		},
		[kind],
	);

	const activeLibrary = selectedKind === kind ? selectedLibrary : null;
	const activeLibraryId = activeLibrary?.id ?? null;

	/** 对齐电子书：切库 / 离页 / 刷新 / 切后台时 flush 续读 */
	useEffect(() => {
		const k = kind;
		const id = activeLibraryId;
		if (!id) return;

		const flush = (opts?: { keepalive?: boolean }) => {
			flushElResume(k, id, opts);
		};
		const onPageHide = () => flush({ keepalive: true });
		const onVisibility = () => {
			if (document.visibilityState === 'hidden') {
				flush({ keepalive: true });
			}
		};
		window.addEventListener('pagehide', onPageHide);
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			window.removeEventListener('pagehide', onPageHide);
			document.removeEventListener('visibilitychange', onVisibility);
			flush({ keepalive: true });
		};
	}, [kind, activeLibraryId]);

	const vocabLibraryMeta =
		kind === 'vocab' && activeLibrary
			? (activeLibrary as EnglishVocabularyLibraryListItem)
			: null;

	useEffect(() => {
		if (kind !== 'vocab' || !activeLibraryId) return;
		const n = vocabLibraryMeta?.wordCount;
		const title = vocabLibraryMeta?.title?.trim();
		if ((typeof n === 'number' && n > 0) || title) {
			setEnglishPracticePoolMeta(
				englishPracticePoolKeys.library(activeLibraryId, 'vocab'),
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
		kind === 'classic' && activeLibrary
			? (activeLibrary as EnglishClassicQuotesLibraryListItem)
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
								<LibraryListPanel
									kind={kind}
									selectedId={activeLibraryId}
									initialLibraryId={listBootLibraryId}
									selectedLibrary={activeLibrary}
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
									<VocabularyLibrarySection
										libraryId={activeLibraryId}
										libraryMeta={vocabLibraryMeta}
										onResumeOffsetChange={onResumeOffsetChange}
									/>
								) : (
									<ClassicQuotesLibrarySection
										libraryId={activeLibraryId}
										libraryMeta={classicLibraryMeta}
										onResumeOffsetChange={onResumeOffsetChange}
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

// 供外部类型引用（如导入页）
export type { EnglishLibraryListItem, LibraryKind };
