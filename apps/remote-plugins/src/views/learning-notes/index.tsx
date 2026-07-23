import { NotePreview } from '@design/NotePreview';
import { Btn, type Editor, RichEditor } from '@design/RichEditor';
import { NotebookText, PenLine, Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import '@/styles.css';

type Note = { id: string; title: string; html: string; at: number };

type HostBridgeProps = {
	api: {
		theme: 'light' | 'dark';
		ui?: {
			showToast: (options: {
				message: string;
				type?: 'success' | 'error' | 'info';
			}) => void;
		};
	};
	plugin: { id: string; version: string; routePath: string };
};

export default function LearningNotesApp({ api }: HostBridgeProps) {
	const [draft, setDraft] = useState({ html: '', text: '', title: '' });
	const [listOpen, setListOpen] = useState(false);
	const [preview, setPreview] = useState<Note | null>(null);
	const [notes, setNotes] = useState<Note[]>(() => [
		{
			id: 'seed',
			title: '示例笔记',
			html: '<p>示例：今天复习了 present perfect 与过去时的区别</p>',
			at: Date.now() - 60_000,
		},
	]);

	const sorted = useMemo(() => [...notes].sort((a, b) => b.at - a.at), [notes]);

	const onSubmit = (e: MouseEvent) => {
		e.preventDefault();
		if (!draft.text.trim() && !draft.title.trim()) return;
		setNotes((list) => [
			{
				id: `${Date.now()}`,
				title: draft.title.trim() || '无标题笔记',
				html: draft.html,
				at: Date.now(),
			},
			...list,
		]);
		api.ui?.showToast({ message: '已添加学习笔记' });
	};

	const toggleNotesList = () => setListOpen((o) => !o);
	const backToEdit = () => setPreview(null);

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
			<div className="rich-editor-toolbar-group">
				<Btn title="保存笔记" onClick={(e) => onSubmit(e as MouseEvent)}>
					<Save size={15} />
				</Btn>
				{listToggleBtn()}
			</div>
		);
	};

	return (
		<div
			className={cn(
				'bg-theme-background text-textcolor flex h-full min-h-0 min-w-0 flex-col text-sm rounded-md',
			)}
		>
			{/* ponytail: 关闭时不挂右栏，避免 collapse 留白；对齐 EbookReadSplitLayout */}
			<ResizablePanelGroup
				id="learning-notes-split"
				orientation="horizontal"
				className="h-full min-h-0 min-w-0 flex-1"
			>
				<ResizablePanel
					id="learning-notes-editor"
					defaultSize={listOpen ? 58 : 100}
					minSize={30}
					className="min-h-0 min-w-0"
				>
					<div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
						{/* 预览时隐藏编辑器，保留挂载以免草稿丢失 */}
						<div
							className={cn(
								'flex h-full min-h-0 flex-1 flex-col overflow-hidden',
								preview && 'hidden',
							)}
						>
							<RichEditor
								defaultContent=""
								placeholder="记下今天的单词、语法或口语收获…"
								showCharCount={false}
								onChange={({ html, text, title }) =>
									setDraft({ html, text, title })
								}
								className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
								editorClassName="min-h-[6rem] text-sm"
								toolbarExtra={toolbarExtra}
							/>
						</div>
						{preview ? (
							<NotePreview
								title={preview.title}
								html={preview.html}
								// meta={new Date(preview.at).toLocaleString()}
								headerExtra={
									<>
										<Btn title="返回编辑" onClick={backToEdit}>
											<PenLine size={15} />
										</Btn>
										{listToggleBtn()}
									</>
								}
							/>
						) : null}
					</div>
				</ResizablePanel>
				{listOpen ? (
					<>
						<ResizableHandle withHandle className="w-0" />
						<ResizablePanel
							id="learning-notes-list"
							defaultSize={42}
							minSize={0}
							className="min-h-0 min-w-0"
						>
							<aside className="border-theme/10 flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l">
								<div className="text-textcolor/80 mb-2 flex h-10 shrink-0 items-center border-b border-theme/10 px-3.5 font-medium tracking-wide">
									笔记列表
								</div>
								<ScrollArea
									className="min-h-0 flex-1"
									viewportClassName="px-2"
									scrollbarClassName="border-l-0 pr-0 right-0"
								>
									<div className="flex flex-col gap-2.5 pb-2">
										{sorted.map((n) => {
											const active = preview?.id === n.id;
											return (
												<button
													key={n.id}
													type="button"
													onClick={() => setPreview(n)}
													className={cn(
														'border-theme/10 bg-theme/5 hover:bg-theme/10 w-full rounded-md border px-3 py-2.5 text-left transition-colors',
														active &&
															'border-theme/40 bg-theme/15 ring-theme/30 ring-1',
													)}
												>
													<div className="text-textcolor truncate text-sm font-semibold">
														{n.title}
													</div>
													<div className="text-textcolor/45 mt-1.5 text-xs">
														{new Date(n.at).toLocaleString()}
													</div>
												</button>
											);
										})}
									</div>
								</ScrollArea>
							</aside>
						</ResizablePanel>
					</>
				) : null}
			</ResizablePanelGroup>
		</div>
	);
}

export async function activate() {
	// ponytail: 本地 demo 态，无远程拉取
}

export async function deactivate() {
	// ponytail: 无全局副作用
}
