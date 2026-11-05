import {
	Btn,
	type Editor,
	enUS,
	getDocTitleText,
	RichEditor,
	type RichEditorLocale,
	type RichTextButtonProps,
	type RichTextKitSlots,
	zhCN,
} from '@dnhyxc-ai/richtext-kit';
import { NotePreview } from '@dnhyxc-ai/richtext-kit/preview';
import {
	isLargeNoteHtml,
	type LargeNoteSaveApi,
	LargeRichEditor,
	WindowedNotePreview,
} from '@dnhyxc-ai/richtext-kit/windowed';
import { Eye, FilePenLine, Save, SquarePen } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from './cn';
import { buildLargeHtml, SAMPLE_SHORT_HTML } from './sample';

type Lang = 'zh' | 'en';
type Pane = 'edit' | 'preview';

async function uploadAsObjectUrl(file: File): Promise<string> {
	return URL.createObjectURL(file);
}

/** 替换 slots.Button：必须是 <button>，并透传 onClick / disabled / variant */
function HostButton({
	className,
	variant = 'outline',
	type = 'button',
	children,
	...props
}: RichTextButtonProps) {
	return (
		<button
			type={type}
			data-variant={variant}
			className={cn('rtk-btn', `rtk-btn-${variant}`, className)}
			{...props}
		>
			{children}
		</button>
	);
}

/**
 * 只对齐 learning-notes 的「编辑器 / 预览」用法与 UI，不做整页笔记壳。
 * - 短文：RichEditor（defaultContent + onCreate + showCharCount=false + toolbarExtra）
 * - 长文：LargeRichEditor（onReady saveApi）
 * - 预览：NotePreview；长文 children=WindowedNotePreview
 */
export default function App() {
	const [lang, setLang] = useState<Lang>('zh');
	const [pane, setPane] = useState<Pane>('edit');
	const [editorInitial, setEditorInitial] = useState(SAMPLE_SHORT_HTML);
	const [editorSeed, setEditorSeed] = useState(0);
	const [previewTitle, setPreviewTitle] = useState('richtext-kit 试用笔记');
	const [previewHtml, setPreviewHtml] = useState(SAMPLE_SHORT_HTML);
	const [dirty, setDirty] = useState(false);
	const [readyKey, setReadyKey] = useState<string | null>(null);
	const [mountEditor, setMountEditor] = useState(false);
	const [toast, setToast] = useState('');

	const editorRef = useRef<Editor | null>(null);
	const pagedSaveRef = useRef<LargeNoteSaveApi | null>(null);
	const baselineHtmlRef = useRef(SAMPLE_SHORT_HTML);

	const locale = useMemo(
		(): Partial<RichEditorLocale> => (lang === 'zh' ? zhCN : enUS),
		[lang],
	);
	const editorKey = `${editorSeed}:${lang}`;
	const editorReady = readyKey === editorKey;
	const useLarge = isLargeNoteHtml(editorInitial);

	const flash = useCallback((msg: string) => {
		setToast(msg);
		window.setTimeout(() => setToast(''), 1600);
	}, []);

	const readSnapshot = useCallback(() => {
		const paged = pagedSaveRef.current;
		if (paged) {
			return {
				title: paged.getTitle(),
				html: paged.getHTML(),
			};
		}
		const editor = editorRef.current;
		if (!editor || editor.isDestroyed) {
			return { title: previewTitle, html: previewHtml };
		}
		return {
			title: getDocTitleText(editor.state.doc).trim(),
			html: editor.getHTML(),
		};
	}, [previewHtml, previewTitle]);

	const remount = useCallback((html: string, title: string) => {
		editorRef.current = null;
		pagedSaveRef.current = null;
		baselineHtmlRef.current = html;
		setDirty(false);
		setEditorInitial(html);
		setPreviewHtml(html);
		setPreviewTitle(title);
		setEditorSeed((s) => s + 1);
		setReadyKey(null);
		setPane('edit');
	}, []);

	const loadShort = () => {
		remount(SAMPLE_SHORT_HTML, 'richtext-kit 试用笔记');
		flash('短文示例');
	};

	const loadLarge = () => {
		const html = buildLargeHtml();
		remount(html, '长文窗口示例');
		flash('长文示例');
	};

	const syncDirty = useCallback(() => {
		const { html } = readSnapshot();
		setDirty(html !== baselineHtmlRef.current);
	}, [readSnapshot]);

	const onSave = useCallback(() => {
		const snap = readSnapshot();
		baselineHtmlRef.current = snap.html;
		setPreviewHtml(snap.html);
		setPreviewTitle(snap.title || (lang === 'zh' ? '无标题' : 'Untitled'));
		setDirty(false);
		flash(lang === 'zh' ? '已同步到预览' : 'Synced to preview');
	}, [flash, lang, readSnapshot]);

	const goPreview = useCallback(() => {
		const snap = readSnapshot();
		setPreviewHtml(snap.html);
		setPreviewTitle(snap.title || (lang === 'zh' ? '无标题' : 'Untitled'));
		setPane('preview');
	}, [lang, readSnapshot]);

	const onTest = useCallback(() => {
		flash('测试');
	}, [flash]);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 's') return;
			if (pane !== 'edit') return;
			e.preventDefault();
			onSave();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [onSave, pane]);

	// 先画 Loading，下一帧再挂 TipTap（对齐 learning-notes）
	useEffect(() => {
		if (pane !== 'edit') {
			setMountEditor(false);
			return;
		}
		setMountEditor(false);
		pagedSaveRef.current = null;
		const id = requestAnimationFrame(() => setMountEditor(true));
		return () => cancelAnimationFrame(id);
	}, [editorKey, pane]);

	const toolbarExtra = (
		<>
			<Btn
				title={lang === 'zh' ? '短文示例' : 'Short sample'}
				onClick={loadShort}
			>
				<FilePenLine size={15} />
			</Btn>
			<Btn
				title={lang === 'zh' ? '同步预览' : 'Sync preview'}
				onClick={onSave}
				className="relative"
			>
				<Save size={15} />
				{dirty ? (
					<span
						className="pointer-events-none absolute top-0 right-0 size-2 rounded-full bg-orange-500"
						aria-hidden
					/>
				) : null}
			</Btn>
			<Btn title={lang === 'zh' ? '预览' : 'Preview'} onClick={goPreview}>
				<Eye size={15} />
			</Btn>
			<Btn
				title={lang === 'zh' ? '测试' : 'test'}
				className="mx-2"
				onClick={onTest}
			>
				测试
			</Btn>
		</>
	);

	const previewHeaderExtra = (
		<>
			<Btn
				title={lang === 'zh' ? '短文示例' : 'Short sample'}
				onClick={loadShort}
			>
				<FilePenLine size={15} />
			</Btn>
			<Btn
				title={lang === 'zh' ? '编辑' : 'Edit'}
				onClick={() => {
					remount(previewHtml, previewTitle);
				}}
			>
				<SquarePen size={15} />
			</Btn>
		</>
	);

	const placeholder =
		lang === 'zh' ? '开始记录学习笔记…' : 'Start writing your note…';

	const slots = useMemo(
		(): Partial<RichTextKitSlots> => ({ Button: HostButton }),
		[],
	);

	return (
		<div
			className={cn(
				'bg-theme-background text-textcolor flex h-full min-h-0 min-w-0 flex-col text-sm',
			)}
		>
			<div className="border-theme/10 flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1.5">
				<strong className="text-textcolor/90">@dnhyxc-ai/richtext-kit</strong>
				<span className="text-textcolor/50 text-xs">
					编辑器 / 预览对齐 learning-notes
				</span>
				<button
					type="button"
					className="border-theme/20 hover:bg-theme/10 ml-2 rounded border px-2 py-0.5 text-xs"
					onClick={loadShort}
				>
					短文
				</button>
				<button
					type="button"
					className="border-theme/20 hover:bg-theme/10 rounded border px-2 py-0.5 text-xs"
					onClick={loadLarge}
				>
					长文
				</button>
				<label className="text-textcolor/60 ml-auto flex items-center gap-1.5 text-xs">
					locale
					<select
						className="border-theme/20 rounded border bg-transparent px-1.5 py-0.5"
						value={lang}
						onChange={(e) => setLang(e.target.value as Lang)}
					>
						<option value="zh">zhCN</option>
						<option value="en">enUS</option>
					</select>
				</label>
				<span className="text-textcolor/45 text-xs">
					isLarge={String(useLarge)}
				</span>
				{toast ? (
					<span className="rounded bg-black/80 px-2 py-0.5 text-xs text-white">
						{toast}
					</span>
				) : null}
			</div>

			<div className="border-theme/10 relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
				{pane === 'edit' ? (
					<>
						{mountEditor ? (
							useLarge ? (
								<LargeRichEditor
									key={editorKey}
									defaultContent={editorInitial}
									placeholder={placeholder}
									locale={locale}
									onUploadImage={uploadAsObjectUrl}
									onReady={(e, save) => {
										editorRef.current = e;
										pagedSaveRef.current = save;
										baselineHtmlRef.current = save.getHTML();
										setDirty(false);
										setReadyKey(editorKey);
									}}
									onChange={syncDirty}
									className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
									editorClassName="min-h-[6rem]"
									toolbarExtra={toolbarExtra}
									slots={slots}
								/>
							) : (
								<RichEditor
									key={editorKey}
									// showTitle={false}
									defaultContent={editorInitial}
									autofocus="end"
									placeholder={placeholder}
									locale={locale}
									showCharCount={false}
									onUploadImage={uploadAsObjectUrl}
									onCreate={(e) => {
										editorRef.current = e;
										pagedSaveRef.current = null;
										baselineHtmlRef.current = e.getHTML();
										setDirty(false);
										setReadyKey(editorKey);
									}}
									onChange={syncDirty}
									className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
									editorClassName="min-h-[6rem]"
									toolbarExtra={toolbarExtra}
									slots={slots}
								/>
							)
						) : null}
						{!editorReady ? (
							<div className="absolute inset-0 z-10 flex items-center justify-center">
								<span className="text-textcolor/55 text-sm">加载中…</span>
							</div>
						) : null}
					</>
				) : (
					<div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden contain-[layout_paint]">
						{isLargeNoteHtml(previewHtml) ? (
							<NotePreview
								title={previewTitle}
								headerExtra={previewHeaderExtra}
								slots={slots}
							>
								<WindowedNotePreview
									key={editorSeed}
									html={previewHtml}
									slots={slots}
								/>
							</NotePreview>
						) : (
							<NotePreview
								title={previewTitle}
								html={previewHtml}
								headerExtra={previewHeaderExtra}
								slots={slots}
							/>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
