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
	FileDown,
	FilePenLine,
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
import { useHostLocale, useI18n } from '@/hooks';
import type { Locale } from '@/i18n';
import { cn } from '@/lib/utils';
import useStore from '@/store';
import type { HostHttp } from './api';
import { LargeNoteEditor, type LargeNoteSaveApi } from './components/Editor';
import { NotesListPanel } from './components/NotesListPanel';
import { WindowedPreviewBody } from './components/PreviewBody';
import { isLargeNoteHtml } from './utils';
import '@/styles.css';

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
			downloadBlob?: (options: {
				fileName: string;
				data: ArrayBuffer | Uint8Array;
				mimeType?: string;
			}) => Promise<{
				ok: boolean;
				hostToasted: boolean;
				message?: string;
			}>;
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
	const pagedSaveRef = useRef<LargeNoteSaveApi | null>(null);
	const savingRef = useRef(false);
	const previewRef = useRef(store.preview);
	const [readyKey, setReadyKey] = useState<string | null>(null);
	const [mountEditor, setMountEditor] = useState(false);
	savingRef.current = store.saving;
	previewRef.current = store.preview;

	const toast = useCallback(
		(message: string, type: 'success' | 'error' | 'info' = 'info') => {
			api.ui?.showToast({ message, type });
		},
		[api.ui],
	);

	useEffect(() => {
		store.bind(api.http, toast, t, api.ui?.downloadBlob);
		void store.refreshList();
	}, [api.http, api.ui?.downloadBlob, store, toast, t]);

	const onSave = useCallback(async () => {
		const paged = pagedSaveRef.current;
		if (paged) {
			await store.saveNote({
				title: paged.getTitle(),
				text: paged.getText(),
				html: paged.getHTML(),
			});
			return;
		}
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

	const previewHeaderExtra = useMemo(
		() => (
			<>
				<Btn title={t('learningNotes.new')} onClick={() => store.openNew()}>
					<FilePenLine size={15} />
				</Btn>
				<Btn
					title={t('learningNotes.edit')}
					disabled={store.loadingDetail}
					onClick={() => {
						if (store.preview) store.openEdit(store.preview);
					}}
				>
					<SquarePen size={15} />
				</Btn>
				<Btn
					title={t('learningNotes.delete')}
					onClick={() => {
						if (store.preview) store.requestDelete(store.preview.id);
					}}
				>
					<Trash2 size={15} />
				</Btn>
				<Btn
					title={
						store.exportingDocx
							? t('learningNotes.exportingDocx')
							: t('learningNotes.exportDocx')
					}
					disabled={store.exportingDocx || store.loadingDetail}
					onClick={() => void store.exportPreviewDocx()}
				>
					<FileDown size={15} />
				</Btn>
				{listToggleBtn()}
			</>
		),
		[
			listToggleBtn,
			store,
			store.exportingDocx,
			store.loadingDetail,
			store.preview,
			t,
		],
	);

	const editorLocale = useMemo(() => richEditorLocaleOf(locale), [locale]);
	const editorKey = `${store.editorSeed}:${locale}`;
	const editorReady = readyKey === editorKey;
	const useLarge = isLargeNoteHtml(store.editorInitial);

	// 先画 Loading，下一帧再挂 TipTap，避免长文解析时连遮罩都刷不出来
	useEffect(() => {
		if (store.preview) {
			setMountEditor(false);
			return;
		}
		setMountEditor(false);
		pagedSaveRef.current = null;
		const id = requestAnimationFrame(() => setMountEditor(true));
		return () => cancelAnimationFrame(id);
	}, [editorKey, store.preview]);

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
							<NotesListPanel locale={locale} />
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
					<div className="border-theme/10 relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
						{!store.preview ? (
							<>
								{mountEditor ? (
									useLarge && typeof store.editorInitial === 'string' ? (
										<LargeNoteEditor
											key={editorKey}
											defaultContent={store.editorInitial}
											placeholder={t('learningNotes.placeholder')}
											locale={editorLocale}
											onReady={(e, save) => {
												editorRef.current = e;
												pagedSaveRef.current = save;
												setReadyKey(editorKey);
											}}
											className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
											editorClassName="min-h-[6rem]"
											toolbarExtra={toolbarExtra}
										/>
									) : (
										<RichEditor
											key={editorKey}
											defaultContent={store.editorInitial}
											autofocus="end"
											placeholder={t('learningNotes.placeholder')}
											locale={editorLocale}
											showCharCount={false}
											onCreate={(e) => {
												editorRef.current = e;
												pagedSaveRef.current = null;
												setReadyKey(editorKey);
											}}
											className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
											editorClassName="min-h-[6rem]"
											toolbarExtra={toolbarExtra}
										/>
									)
								) : null}
								{!editorReady ? (
									<div className="rounded-md bg-theme/5 absolute inset-0 z-10 flex items-center justify-center">
										<Loading />
									</div>
								) : null}
							</>
						) : (
							<div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden contain-[layout_paint]">
								{isLargeNoteHtml(store.preview.html) ? (
									<NotePreview
										title={store.preview.title}
										headerExtra={previewHeaderExtra}
										loading={store.loadingDetail}
									>
										<WindowedPreviewBody
											key={store.preview.id}
											html={store.preview.html}
										/>
									</NotePreview>
								) : (
									<NotePreview
										title={store.preview.title}
										html={store.preview.html}
										headerExtra={previewHeaderExtra}
										loading={store.loadingDetail}
									/>
								)}
								{store.loadingDetail ? (
									<div className="w-full h-full bg-theme/5 absolute inset-0 z-10 flex items-center justify-center">
										<Loading />
									</div>
								) : null}
							</div>
						)}
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
	// no-op
}
