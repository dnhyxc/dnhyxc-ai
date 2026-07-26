import Loading from '@design/Loading';
import { NotePreview } from '@design/NotePreview';
import {
	Btn,
	type Editor,
	getDocTitleText,
	RichEditor,
	richEditorLocaleOf,
} from '@design/RichEditor';
import {
	ChevronDown,
	ChevronUp,
	FilePenLine,
	LocateFixed,
	NotebookText,
	Save,
	SquarePen,
	Trash2,
} from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Confirm from '@/components/design/Confirm';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useHostLocale, useI18n } from '@/hooks';
import type { Locale } from '@/i18n';
import { cn } from '@/lib/utils';
import useStore from '@/store';
import type { HostHttp } from './api';
import '@/styles.css';

const SCROLL_EDGE_PX = 16;

/** 笔记列表滚动：同一按钮循环 底 → 顶 → 当前（无选中时底 → 顶） */
type NoteScrollMode = 'bottom' | 'top' | 'current';

type HostBridgeProps = {
	api: {
		theme: 'light' | 'dark';
		locale?: Locale;
		event?: {
			on: (event: string, handler: (data?: unknown) => void) => void;
			off: (event: string, handler: (data?: unknown) => void) => void;
			emit: (event: string, data?: unknown) => void;
		};
		http?: HostHttp;
		ui?: {
			showToast: (options: {
				message: string;
				type?: 'success' | 'error' | 'info';
			}) => void;
		};
	};
	plugin: { id: string; version: string; routePath: string };
	independent?: boolean;
};

function LearningNotesApp({ api }: HostBridgeProps) {
	const { learningNotesStore: store } = useStore();
	const { t, locale } = useI18n();
	useHostLocale(api);

	const editorRef = useRef<Editor | null>(null);
	const savingRef = useRef(false);
	const previewRef = useRef(store.preview);
	savingRef.current = store.saving;
	previewRef.current = store.preview;

	const scrollViewportRef = useRef<HTMLDivElement>(null);
	const activeItemRef = useRef<HTMLDivElement>(null);
	const [scrollMode, setScrollMode] = useState<NoteScrollMode>('bottom');
	const [scrollEdge, setScrollEdge] = useState<'top' | 'bottom' | null>(null);

	const toast = useCallback(
		(message: string, type: 'success' | 'error' | 'info' = 'info') => {
			api.ui?.showToast({ message, type });
		},
		[api.ui],
	);

	useEffect(() => {
		store.bind(api.http, toast, t);
		void store.refreshList();
	}, [api.http, store, toast, t]);

	const handleScroll = useCallback(() => {
		const el = scrollViewportRef.current;
		if (!el) return;
		const { scrollTop, scrollHeight, clientHeight } = el;
		if (scrollTop <= SCROLL_EDGE_PX) {
			setScrollEdge('top');
		} else if (scrollTop + clientHeight >= scrollHeight - SCROLL_EDGE_PX) {
			setScrollEdge('bottom');
		} else {
			setScrollEdge(null);
		}
		if (scrollTop + clientHeight >= scrollHeight - SCROLL_EDGE_PX * 3) {
			void store.loadMore();
		}
	}, [store]);

	useEffect(() => {
		if (!store.listOpen) return;
		setScrollMode('bottom');
		const el = scrollViewportRef.current;
		if (!el) return;
		el.addEventListener('scroll', handleScroll);
		handleScroll();
		return () => el.removeEventListener('scroll', handleScroll);
	}, [store.listOpen, handleScroll]);

	useEffect(() => {
		if (!store.hasActive && scrollMode === 'current') {
			setScrollMode('bottom');
		}
	}, [store.hasActive, scrollMode]);

	const onScrollFabClick = useCallback(() => {
		const vp = scrollViewportRef.current;
		if (!vp) return;

		const { scrollTop, scrollHeight, clientHeight } = vp;
		const atTop = scrollTop <= SCROLL_EDGE_PX;
		const atBottom = scrollTop + clientHeight >= scrollHeight - SCROLL_EDGE_PX;
		let mode = scrollMode;
		if (mode === 'bottom' && atBottom) {
			mode = 'top';
		} else if (mode === 'top' && atTop) {
			mode = 'bottom';
		}

		if (mode === 'bottom') {
			vp.scrollTo({ top: vp.scrollHeight, behavior: 'auto' });
		} else if (mode === 'top') {
			vp.scrollTo({ top: 0, behavior: 'auto' });
		} else {
			activeItemRef.current?.scrollIntoView({
				block: 'center',
				behavior: 'auto',
			});
		}

		if (mode === 'bottom') {
			setScrollMode('top');
		} else if (mode === 'top') {
			setScrollMode(store.hasActive ? 'current' : 'bottom');
		} else {
			setScrollMode('bottom');
		}
	}, [scrollMode, store.hasActive]);

	const displayMode: NoteScrollMode =
		scrollMode === 'bottom' && scrollEdge === 'bottom'
			? 'top'
			: scrollMode === 'top' && scrollEdge === 'top'
				? 'bottom'
				: scrollMode;

	const scrollTitle =
		displayMode === 'bottom'
			? t('learningNotes.scrollBottom')
			: displayMode === 'top'
				? t('learningNotes.scrollTop')
				: t('learningNotes.scrollCurrent');

	const onSave = useCallback(async () => {
		const editor = editorRef.current;
		if (!editor || editor.isDestroyed) return;
		await store.saveNote({
			title: getDocTitleText(editor.state.doc).trim(),
			text: editor.getText({ blockSeparator: '\n\n' }).trim(),
			html: editor.getHTML(),
		});
	}, [store]);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 's') return;
			if (previewRef.current) return;
			e.preventDefault();
			if (savingRef.current) return;
			void onSave();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [onSave]);

	const listToggleBtn = useCallback(
		() => (
			<Btn
				title={
					store.listOpen
						? t('learningNotes.closeList')
						: t('learningNotes.openList')
				}
				onClick={() => store.toggleListOpen()}
			>
				<NotebookText size={15} />
			</Btn>
		),
		[store, store.listOpen, t],
	);

	const toolbarExtra = useMemo(
		() => (
			<>
				<Btn title={t('learningNotes.new')} onClick={() => store.openNew()}>
					<FilePenLine size={15} />
				</Btn>
				<Btn
					title={
						store.saving
							? t('learningNotes.saving')
							: store.editingId
								? t('learningNotes.update')
								: t('learningNotes.save')
					}
					onClick={() => void onSave()}
					disabled={store.saving}
				>
					<Save size={15} />
				</Btn>
				{listToggleBtn()}
			</>
		),
		[listToggleBtn, onSave, store, store.editingId, store.saving, t],
	);

	const editorLocale = useMemo(() => richEditorLocaleOf(locale), [locale]);

	return (
		<div
			className={cn(
				'bg-theme/5 text-textcolor flex h-full min-h-0 min-w-0 flex-col text-sm rounded-md',
			)}
		>
			<Confirm
				open={store.confirmOpen}
				onOpenChange={(open) => store.setConfirmOpen(open)}
				title={t('learningNotes.deleteConfirmTitle')}
				description={t('learningNotes.deleteConfirmDesc')}
				onConfirm={() => void store.confirmDelete()}
			/>
			<ResizablePanelGroup
				id="learning-notes-split"
				orientation="horizontal"
				className="h-full min-h-0 min-w-0 flex-1"
			>
				{store.listOpen ? (
					<>
						<ResizablePanel
							id="learning-notes-list"
							defaultSize={35}
							minSize={0}
							className="min-h-0 min-w-0"
						>
							<aside className="border-r mb-3 border-theme/10 flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
								<div className="flex h-10 shrink-0 items-center justify-between border-b border-theme/10 pl-3 pr-1.5 font-medium tracking-wide">
									<div className="text-textcolor/85">
										{t('learningNotes.listTitle')}
										<span className="ml-3 text-xs text-textcolor/60">
											{t('common.loadedCount', {
												loaded: store.list.length,
												total: store.total,
											})}
										</span>
									</div>
									<Btn title={scrollTitle} onClick={onScrollFabClick}>
										{displayMode === 'bottom' ? (
											<ChevronDown size={18} />
										) : displayMode === 'top' ? (
											<ChevronUp size={18} />
										) : (
											<LocateFixed size={15} />
										)}
									</Btn>
								</div>
								<ScrollArea
									ref={scrollViewportRef}
									className="min-h-0 flex-1 p-3"
								>
									{store.loading ? (
										<div className="flex flex-1 flex-col items-center justify-center py-6 text-center text-sm text-textcolor/60">
											<Loading />
										</div>
									) : (
										<div className="flex flex-col gap-3">
											{store.list.length === 0 && !store.loading ? (
												<p className="text-textcolor/45 px-1 py-6 text-center text-xs">
													{t('learningNotes.empty')}
												</p>
											) : null}
											{store.list.map((n) => {
												const active =
													(store.preview?.id ?? store.editingId) === n.id;
												return (
													<div
														key={n.id}
														ref={active ? activeItemRef : undefined}
														className={cn(
															'hover:bg-theme/10 bg-theme/5 group relative w-full rounded-md px-3 py-2.5 text-left transition-colors',
															active && 'bg-theme/15',
														)}
													>
														<div
															className="w-full text-left"
															onClick={() => void store.openPreview(n.id)}
														>
															<div className="text-textcolor truncate text-base font-semibold pr-0 transition-[padding] duration-200 group-hover:pr-14">
																{n.title}
															</div>
															<div className="text-textcolor/45 mt-1.5 text-xs">
																{new Date(n.at).toLocaleString(locale)}
															</div>
														</div>
														<div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
															<button
																type="button"
																title={t('learningNotes.edit')}
																className="w-7 h-7 text-textcolor/80 hover:text-teal-500 hover:bg-teal-500/10 flex cursor-pointer items-center justify-center rounded-md p-1"
																onClick={(e) => {
																	e.stopPropagation();
																	void store.openEditById(n.id);
																}}
															>
																<SquarePen size={15} />
															</button>
															<button
																type="button"
																title={t('learningNotes.delete')}
																className="w-7 h-7 text-textcolor/80 hover:text-destructive hover:bg-destructive/10 flex cursor-pointer items-center justify-center rounded-md p-1"
																onClick={(e) => {
																	e.stopPropagation();
																	store.requestDelete(n.id);
																}}
															>
																<Trash2 size={15} />
															</button>
														</div>
													</div>
												);
											})}
											{store.loadingMore ? (
												<p className="text-textcolor/45 py-2 text-center text-xs">
													{t('common.loading')}
												</p>
											) : null}
											{!store.loading &&
											!store.loadingMore &&
											store.list.length > 0 &&
											!store.hasMore ? (
												<p className="text-textcolor/35 py-2 text-center text-xs">
													{t('common.noMore')}
												</p>
											) : null}
										</div>
									)}
								</ScrollArea>
							</aside>
						</ResizablePanel>
						<ResizableHandle withHandle className="w-0" />
					</>
				) : null}
				<ResizablePanel
					id="learning-notes-editor"
					defaultSize={store.listOpen ? 65 : 100}
					minSize={50}
					className="min-h-0 min-w-0"
				>
					<div className="border-theme/10 flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
						<div
							className={cn(
								'flex h-full min-h-0 flex-1 flex-col overflow-hidden',
								store.preview && 'hidden',
							)}
						>
							<RichEditor
								key={`${store.editorSeed}:${locale}`}
								defaultContent={store.editorInitial}
								autofocus="end"
								placeholder={t('learningNotes.placeholder')}
								locale={editorLocale}
								showCharCount={false}
								onCreate={(e) => {
									editorRef.current = e;
								}}
								className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
								editorClassName="min-h-[6rem]"
								toolbarExtra={toolbarExtra}
							/>
						</div>
						{store.preview ? (
							store.loadingDetail ? (
								<div className="flex flex-1 flex-col items-center justify-center py-6 text-center text-sm text-textcolor/60">
									<Loading />
								</div>
							) : (
								<NotePreview
									title={store.preview.title}
									html={store.preview.html}
									headerExtra={
										<>
											<Btn
												title={t('learningNotes.new')}
												onClick={() => store.openNew()}
											>
												<FilePenLine size={15} />
											</Btn>
											<Btn
												title={t('learningNotes.edit')}
												onClick={() => {
													if (store.preview) store.openEdit(store.preview);
												}}
											>
												<SquarePen size={15} />
											</Btn>
											<Btn
												title={t('learningNotes.delete')}
												onClick={() => {
													if (store.preview)
														store.requestDelete(store.preview.id);
												}}
											>
												<Trash2 size={15} />
											</Btn>
											{listToggleBtn()}
										</>
									}
								/>
							)
						) : null}
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}

export default observer(LearningNotesApp);

export async function activate() {
	// 列表在组件 mount 时拉取
}

export async function deactivate() {
	// ponytail: 无全局副作用
}
