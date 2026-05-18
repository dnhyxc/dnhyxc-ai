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
import { ClassicQuotesLibraryWordsPanel } from './ClassicQuotesLibraryWordsPanel';
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

	const onLibraryDeleted = useCallback(
		(_deletedId: string) => {
			setSelectedLibrary(null);
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					next.delete('library');
					return next;
				},
				{ replace: true },
			);
		},
		[setSearchParams],
	);

	const libraryIdFromUrl = searchParams.get('library');
	const activeLibraryId = selectedLibrary?.id ?? libraryIdFromUrl;

	const vocabLibraryMeta =
		kind === 'vocab' && selectedLibrary
			? (selectedLibrary as EnglishVocabularyLibraryListItem)
			: null;
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
							<section className="border-l border-theme/10 flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-theme-background">
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
