import { NotePreview } from '@design/NotePreview';
import {
	Btn,
	type Editor,
	EMPTY_NOTE_DOC,
	RichEditor,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Confirm from '@/components/design/Confirm';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import '@/styles.css';
import { createNotesApi, type HostHttp, type Note } from './api';

const SCROLL_EDGE_PX = 16;

/** 笔记列表滚动：同一按钮循环 底 → 顶 → 当前（无选中时底 → 顶） */
type NoteScrollMode = 'bottom' | 'top' | 'current';

type HostBridgeProps = {
	api: {
		theme: 'light' | 'dark';
		http?: HostHttp;
		ui?: {
			showToast: (options: {
				message: string;
				type?: 'success' | 'error' | 'info';
			}) => void;
		};
	};
	plugin: { id: string; version: string; routePath: string };
	// 是否独立运行，独立运行时不会显示笔记列表
	independent?: boolean;
};

function errMsg(e: unknown): string {
	if (e instanceof Error && e.message) return e.message;
	if (e && typeof e === 'object' && 'message' in e) {
		const m = (e as { message?: unknown }).message;
		if (typeof m === 'string' && m.trim()) return m;
	}
	return '请求失败';
}

export default function LearningNotesApp({ api }: HostBridgeProps) {
	const notesApi = useMemo(
		() => (api.http ? createNotesApi(api.http) : null),
		[api.http],
	);

	const [draft, setDraft] = useState({ html: '', text: '', title: '' });
	const [listOpen, setListOpen] = useState(true);
	const [preview, setPreview] = useState<Note | null>(null);
	const [notes, setNotes] = useState<Note[]>([]);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editorSeed, setEditorSeed] = useState(0);
	const [editorInitial, setEditorInitial] = useState<
		string | typeof EMPTY_NOTE_DOC
	>(EMPTY_NOTE_DOC);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

	// ScrollArea viewport：程序化滚到顶/底
	const scrollViewportRef = useRef<HTMLDivElement>(null);
	// 当前选中项 DOM：用于「滚到当前」
	const activeItemRef = useRef<HTMLDivElement>(null);
	// 三态滚动状态机：底 → 顶 → 当前 → 底（不被滚动位置修改）
	const [scrollMode, setScrollMode] = useState<NoteScrollMode>('bottom');
	// 实际滚动位置边界：仅用于图标显示派生，不影响状态机
	const [scrollEdge, setScrollEdge] = useState<'top' | 'bottom' | null>(null);

	const toast = useCallback(
		(message: string, type: 'success' | 'error' | 'info' = 'info') => {
			api.ui?.showToast({ message, type });
		},
		[api.ui],
	);

	const refreshList = useCallback(async () => {
		if (!notesApi) {
			toast('未授权 HTTP，无法同步笔记', 'error');
			return;
		}
		setLoading(true);
		try {
			setNotes(await notesApi.list());
		} catch (e) {
			toast(errMsg(e), 'error');
		} finally {
			setLoading(false);
		}
	}, [notesApi, toast]);

	useEffect(() => {
		void refreshList();
	}, [refreshList]);

	// 有无选中项：预览或编辑中任一即为有选中
	const hasActive = !!(preview?.id ?? editingId);

	// 滚动监听：仅记录实际滚动边界位置，用于图标显示派生，不修改状态机
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
	}, []);

	// 列表打开时重置为「滚到底」并绑定滚动监听，同时立即读取一次位置
	useEffect(() => {
		if (!listOpen) return;
		setScrollMode('bottom');
		const el = scrollViewportRef.current;
		if (!el) return;
		el.addEventListener('scroll', handleScroll);
		handleScroll();
		return () => el.removeEventListener('scroll', handleScroll);
	}, [listOpen, handleScroll]);

	// 选中项从有到无时，若当前是 current 态则重置为 bottom
	useEffect(() => {
		if (!hasActive && scrollMode === 'current') {
			setScrollMode('bottom');
		}
	}, [hasActive, scrollMode]);

	const openNew = () => {
		setPreview(null);
		setEditingId(null);
		setDraft({ html: '', text: '', title: '' });
		setEditorInitial(EMPTY_NOTE_DOC);
		setEditorSeed((n) => n + 1);
	};

	// 点击滚动按钮：执行当前态滚动，再切到下一态
	const onScrollFabClick = useCallback(() => {
		const vp = scrollViewportRef.current;
		if (!vp) return;

		// 先校正：已在底部时 bottom→top，已在顶部时 top→bottom，避免无效滚动
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

		// 下一态：无选中时底→顶→底循环；有选中时底→顶→当前→底循环
		if (mode === 'bottom') {
			setScrollMode('top');
		} else if (mode === 'top') {
			setScrollMode(hasActive ? 'current' : 'bottom');
		} else {
			setScrollMode('bottom');
		}
	}, [scrollMode, hasActive]);

	// 图标显示模式：状态机值 + 实际滚动位置派生（与点击校正逻辑一致）
	// 在底部时 bottom→top，在顶部时 top→bottom，否则保持状态机值
	const displayMode: NoteScrollMode =
		scrollMode === 'bottom' && scrollEdge === 'bottom'
			? 'top'
			: scrollMode === 'top' && scrollEdge === 'top'
				? 'bottom'
				: scrollMode;

	// 滚动按钮标题
	const scrollTitle =
		displayMode === 'bottom'
			? '滚动到底部'
			: displayMode === 'top'
				? '滚动到顶部'
				: '滚动到当前选中';

	const openPreview = async (id: string) => {
		if (!notesApi) return;
		try {
			const note = await notesApi.detail(id);
			setPreview(note);
		} catch (e) {
			toast(errMsg(e), 'error');
		}
	};

	const openEdit = (note: Note) => {
		setPreview(null);
		setEditingId(note.id);
		setDraft({ html: note.html, text: '', title: note.title });
		setEditorInitial(note.html || EMPTY_NOTE_DOC);
		setEditorSeed((n) => n + 1);
	};

	/** 列表项无正文：先拉详情再进编辑 */
	const openEditById = async (id: string) => {
		if (!notesApi) return;
		try {
			openEdit(await notesApi.detail(id));
		} catch (e) {
			toast(errMsg(e), 'error');
		}
	};

	const onSave = async () => {
		if (!draft.title.trim()) return toast('请先输入标题', 'info');
		if (!draft.text.trim()) return toast('请先输入内容', 'info');
		if (!notesApi) return toast('未授权 HTTP，无法保存', 'error');
		setSaving(true);
		try {
			const payload = {
				title: draft.title.trim() || '无标题笔记',
				html: draft.html,
			};
			if (editingId) {
				const updated = await notesApi.update(editingId, payload);
				setEditingId(updated.id);
				toast('已更新笔记', 'success');
			} else {
				const { id } = await notesApi.save(payload);
				setEditingId(id);
				toast('已保存笔记', 'success');
			}
			await refreshList();
		} catch (e) {
			toast(errMsg(e), 'error');
		} finally {
			setSaving(false);
		}
	};

	const onDelete = (id: string) => {
		setPendingDeleteId(id);
		setConfirmOpen(true);
	};

	const onConfirmDelete = async () => {
		const id = pendingDeleteId;
		if (!notesApi || !id) return;
		try {
			await notesApi.remove(id);
			// 仅当左侧正展示被删笔记时关掉预览；编辑草稿同理，不误伤其它预览
			if (preview?.id === id) setPreview(null);
			if (editingId === id) {
				setEditingId(null);
				setDraft({ html: '', text: '', title: '' });
				setEditorInitial(EMPTY_NOTE_DOC);
				setEditorSeed((n) => n + 1);
			}
			toast('已删除', 'success');
			await refreshList();
		} catch (e) {
			toast(errMsg(e), 'error');
		} finally {
			setPendingDeleteId(null);
		}
	};

	const toggleNotesList = () => setListOpen((o) => !o);

	const listToggleBtn = () => (
		<Btn
			title={listOpen ? '关闭笔记列表' : '打开笔记列表'}
			onClick={toggleNotesList}
		>
			<NotebookText size={15} />
		</Btn>
	);

	const toolbarExtra = (editor: Editor) => {
		void editor;
		return (
			<>
				<Btn title="新建笔记" onClick={openNew}>
					<FilePenLine size={15} />
				</Btn>
				<Btn
					title={saving ? '保存中…' : editingId ? '更新笔记' : '保存笔记'}
					onClick={() => void onSave()}
					disabled={saving}
				>
					<Save size={15} />
				</Btn>
				{listToggleBtn()}
			</>
		);
	};

	return (
		<div
			className={cn(
				'bg-theme/5 text-textcolor flex h-full min-h-0 min-w-0 flex-col text-sm rounded-md',
			)}
		>
			<Confirm
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				title="确定删除这条笔记？"
				description="删除后将无法恢复"
				onConfirm={() => void onConfirmDelete()}
			/>
			<ResizablePanelGroup
				id="learning-notes-split"
				orientation="horizontal"
				className="h-full min-h-0 min-w-0 flex-1"
			>
				{listOpen ? (
					<>
						<ResizablePanel
							id="learning-notes-list"
							defaultSize={35}
							minSize={0}
							className="min-h-0 min-w-0"
						>
							<aside className="border-r mb-3 border-theme/10 flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
								<div className="flex h-10 shrink-0 items-center justify-between border-b border-theme/10 pl-3 pr-1.5 font-medium tracking-wide">
									<span className="text-textcolor/85">
										笔记列表{loading ? '…' : ''}
									</span>
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
								{/* 与主项目英语学习侧栏一致：内边距写在 ScrollArea Root，滚动条样式跟主项目组件默认 */}
								<ScrollArea
									ref={scrollViewportRef}
									className="min-h-0 flex-1 p-3"
								>
									<div className="flex flex-col gap-3">
										{notes.length === 0 && !loading ? (
											<p className="text-textcolor/45 px-1 py-6 text-center text-xs">
												暂无笔记，保存一条试试
											</p>
										) : null}
										{notes.map((n) => {
											// 预览优先：避免 preview 与 editingId 同时高亮两条
											const active = (preview?.id ?? editingId) === n.id;
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
														onClick={() => void openPreview(n.id)}
													>
														{/* 动态调整 padding-right，配合 transition-[padding] 实现平滑过渡 */}
														<div className="text-textcolor truncate text-base font-semibold pr-0 transition-[padding] duration-200 group-hover:pr-14">
															{n.title}
														</div>
														<div className="text-textcolor/45 mt-1.5 text-xs">
															{new Date(n.at).toLocaleString()}
														</div>
													</div>
													<div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
														<button
															type="button"
															title="编辑"
															className="w-7 h-7 text-textcolor/80 hover:text-teal-500 hover:bg-teal-500/10 flex cursor-pointer items-center justify-center rounded-md p-1"
															onClick={(e) => {
																e?.stopPropagation();
																void openEditById(n.id);
															}}
														>
															<SquarePen size={15} />
														</button>
														<button
															type="button"
															title="删除"
															className="w-7 h-7 text-textcolor/80 hover:text-destructive hover:bg-destructive/10 flex cursor-pointer items-center justify-center rounded-md p-1"
															onClick={(e) => {
																e?.stopPropagation();
																onDelete(n.id);
															}}
														>
															<Trash2 size={15} />
														</button>
													</div>
												</div>
											);
										})}
									</div>
								</ScrollArea>
							</aside>
						</ResizablePanel>
						<ResizableHandle withHandle className="w-0" />
					</>
				) : null}
				<ResizablePanel
					id="learning-notes-editor"
					defaultSize={listOpen ? 65 : 100}
					minSize={50}
					className="min-h-0 min-w-0"
				>
					<div className="border-theme/10 flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
						<div
							className={cn(
								'flex h-full min-h-0 flex-1 flex-col overflow-hidden',
								preview && 'hidden',
							)}
						>
							<RichEditor
								key={editorSeed}
								defaultContent={editorInitial}
								autofocus="end"
								placeholder="记下今天的单词、语法或口语收获…"
								showCharCount={false}
								onChange={({ html, text, title }) =>
									setDraft({ html, text, title })
								}
								className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
								editorClassName="min-h-[6rem]"
								toolbarExtra={toolbarExtra}
							/>
						</div>
						{preview ? (
							<NotePreview
								title={preview.title}
								html={preview.html}
								headerExtra={
									<>
										<Btn title="新建笔记" onClick={openNew}>
											<FilePenLine size={15} />
										</Btn>
										<Btn title="编辑" onClick={() => openEdit(preview)}>
											<SquarePen size={15} />
										</Btn>
										<Btn title="删除" onClick={() => onDelete(preview.id)}>
											<Trash2 size={15} />
										</Btn>
										{listToggleBtn()}
									</>
								}
							/>
						) : null}
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}

export async function activate() {
	// 列表在组件 mount 时拉取
}

export async function deactivate() {
	// ponytail: 无全局副作用
}
