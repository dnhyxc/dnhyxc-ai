/**
 * 英语学习：从 JSON 文件导入单词包或经典语句列表（独立路由页）。
 */

import { Button, Input, Toast } from '@ui/index';
import { CloudUpload, NotebookPen } from 'lucide-react';
import {
	type ChangeEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useSearchParams } from 'react-router';
import type { DragDropAcceptResult } from '@/components/design/DragDropFileUpload';
import DragDropFileUpload from '@/components/design/DragDropFileUpload';
import MarkdownEditor from '@/components/design/Monaco';
import { useI18n, useTheme } from '@/hooks';
import {
	type EnglishClassicQuoteItem,
	type EnglishVocabularyItem,
	uploadEnglishVocabularyLibraryJson,
} from '@/service';
import { copyToClipboard, pasteFromClipboard } from '@/utils/clipboard';

type ImportKind = 'vocab' | 'classic';

type ParseFailReason = 'expect-array' | 'no-vocab' | 'no-classic';

function extractItemArray(data: unknown): unknown[] | null {
	if (Array.isArray(data)) return data;
	if (
		data &&
		typeof data === 'object' &&
		Array.isArray((data as { items?: unknown }).items)
	) {
		return (data as { items: unknown[] }).items;
	}
	return null;
}

function parseVocabularyImport(
	data: unknown,
):
	| { ok: true; items: EnglishVocabularyItem[] }
	| { ok: false; reason: ParseFailReason } {
	const arr = extractItemArray(data);
	if (!arr) return { ok: false, reason: 'expect-array' };
	const items: EnglishVocabularyItem[] = [];
	for (const row of arr) {
		if (!row || typeof row !== 'object') continue;
		const o = row as Record<string, unknown>;
		const word = typeof o.word === 'string' ? o.word.trim() : '';
		const ipa = typeof o.ipa === 'string' ? o.ipa.trim() : '';
		if (!word || !ipa) continue;
		const pos = typeof o.pos === 'string' ? o.pos.trim().slice(0, 64) : '';
		const translationZh =
			typeof o.translationZh === 'string'
				? o.translationZh
				: typeof o.translation_zh === 'string'
					? o.translation_zh
					: '—';
		const example = typeof o.example === 'string' ? o.example : '—';
		items.push({ word, ipa, pos, translationZh, example });
	}
	if (!items.length) return { ok: false, reason: 'no-vocab' };
	return { ok: true, items };
}

function parseClassicImport(
	data: unknown,
):
	| { ok: true; items: EnglishClassicQuoteItem[] }
	| { ok: false; reason: ParseFailReason } {
	const arr = extractItemArray(data);
	if (!arr) return { ok: false, reason: 'expect-array' };
	const items: EnglishClassicQuoteItem[] = [];
	for (const row of arr) {
		if (!row || typeof row !== 'object') continue;
		const o = row as Record<string, unknown>;
		const english = typeof o.english === 'string' ? o.english.trim() : '';
		const translationZh =
			typeof o.translationZh === 'string'
				? o.translationZh.trim()
				: typeof o.translation_zh === 'string'
					? o.translation_zh.trim()
					: '';
		if (!english || !translationZh) continue;
		const source = typeof o.source === 'string' ? o.source : '—';
		const noteZh =
			typeof o.noteZh === 'string'
				? o.noteZh
				: typeof o.note_zh === 'string'
					? o.note_zh
					: '—';
		items.push({ english, translationZh, source, noteZh });
	}
	if (!items.length) return { ok: false, reason: 'no-classic' };
	return { ok: true, items };
}

export default function EnglishLearningImportPage() {
	const { t } = useI18n();
	const { theme } = useTheme();
	const [searchParams] = useSearchParams();
	const kind: ImportKind = useMemo(() => {
		return searchParams.get('kind') === 'classic' ? 'classic' : 'vocab';
	}, [searchParams]);

	const monacoTheme = useMemo(
		() => (theme === 'black' ? 'vs-dark' : 'vs'),
		[theme],
	);

	const monacoDocumentIdentity = useMemo(
		() => `english-learning-import-${kind}`,
		[kind],
	);

	const monacoClipboardAdapter = useMemo(
		() => ({
			copyToClipboard,
			pasteFromClipboard,
		}),
		[],
	);

	const [previewText, setPreviewText] = useState('');
	const [jsonErrorKind, setJsonErrorKind] = useState<'parse' | 'read' | null>(
		null,
	);
	const [structFailReason, setStructFailReason] =
		useState<ParseFailReason | null>(null);
	const [parsedVocab, setParsedVocab] = useState<
		EnglishVocabularyItem[] | null
	>(null);
	const [parsedClassic, setParsedClassic] = useState<
		EnglishClassicQuoteItem[] | null
	>(null);
	const [importTitle, setImportTitle] = useState('');
	const [vocabSaveLoading, setVocabSaveLoading] = useState(false);
	const reuploadInputRef = useRef<HTMLInputElement>(null);

	const resetParsed = useCallback(() => {
		setParsedVocab(null);
		setParsedClassic(null);
		setStructFailReason(null);
		setJsonErrorKind(null);
	}, []);

	useEffect(() => {
		resetParsed();
		setPreviewText('');
	}, [kind, resetParsed]);

	const processJsonFile = useCallback(
		(file: File) => {
			resetParsed();
			const reader = new FileReader();
			reader.onload = () => {
				const text = typeof reader.result === 'string' ? reader.result : '';
				let parsed: unknown;
				try {
					parsed = text ? JSON.parse(text) : null;
					setJsonErrorKind(null);
				} catch {
					setJsonErrorKind('parse');
					setStructFailReason(null);
					// 非法 JSON 时仍展示完整原始文本，便于对照修正
					setPreviewText(text);
					return;
				}
				const pretty = JSON.stringify(parsed, null, 2);
				setPreviewText(pretty);

				if (kind === 'vocab') {
					const res = parseVocabularyImport(parsed);
					if (res.ok) {
						setParsedVocab(res.items);
						setParsedClassic(null);
						setStructFailReason(null);
					} else {
						setStructFailReason(res.reason);
					}
				} else {
					const res = parseClassicImport(parsed);
					if (res.ok) {
						setParsedClassic(res.items);
						setParsedVocab(null);
						setStructFailReason(null);
					} else {
						setStructFailReason(res.reason);
					}
				}
			};
			reader.onerror = () => {
				setJsonErrorKind('read');
				setPreviewText('');
			};
			reader.readAsText(file, 'UTF-8');
		},
		[kind, resetParsed],
	);

	const onDropZoneFiles = useCallback(
		(result: DragDropAcceptResult) => {
			const file = result.accepted[0];
			if (file) processJsonFile(file);
		},
		[processJsonFile],
	);

	const onDropZoneReject = useCallback(() => {
		Toast({
			type: 'warning',
			title: t('englishLearning.import.dropReject'),
		});
	}, [t]);

	/** 标题栏「重新上传」：清空当前内容并打开文件选择（与拖拽区 accept 一致） */
	const onReuploadHiddenFileChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			e.target.value = '';
			if (file) processJsonFile(file);
		},
		[processJsonFile],
	);

	const onReupload = useCallback(() => {
		resetParsed();
		setPreviewText('');
		reuploadInputRef.current?.click();
	}, [resetParsed]);

	/** 编辑器删空后回到拖拽上传区，并清空解析结果 */
	const onPreviewEditorChange = useCallback(
		(next: string) => {
			if (!next.trim()) {
				setPreviewText('');
				resetParsed();
				return;
			}
			setPreviewText(next);
		},
		[resetParsed],
	);

	// 保存到单词库
	const onSaveToVocab = useCallback(async () => {
		if (jsonErrorKind !== null || structFailReason !== null) {
			Toast({
				type: 'error',
				title: t('englishLearning.import.parseError'),
			});
			return;
		}
		if (!parsedVocab?.length) {
			Toast({
				type: 'error',
				title: t('englishLearning.import.needParsed'),
			});
			return;
		}
		if (!importTitle.trim()) {
			Toast({
				type: 'error',
				title: t('englishLearning.import.titleRequired'),
			});
			return;
		}
		try {
			setVocabSaveLoading(true);
			const res = await uploadEnglishVocabularyLibraryJson({
				title: importTitle.trim(),
				jsonUtf8: previewText,
			});
			if (res.success && res.data) {
				Toast({
					type: 'success',
					title: t('englishLearning.import.saveVocabSuccess', {
						count: String(res.data.wordCount),
					}),
				});
			}
		} catch {
			// 错误文案由 http 层 Toast 统一展示
		} finally {
			setVocabSaveLoading(false);
		}
	}, [importTitle, jsonErrorKind, previewText, structFailReason, t]);

	// 保存到经典语句库
	const onSaveToClassic = useCallback(() => {
		if (jsonErrorKind !== null || structFailReason !== null) {
			Toast({
				type: 'error',
				title: t('englishLearning.import.parseError'),
			});
			return;
		}
		if (!parsedClassic?.length) {
			Toast({
				type: 'error',
				title: t('englishLearning.import.needParsed'),
			});
			return;
		}
		if (!importTitle) {
			Toast({
				type: 'error',
				title: t('englishLearning.import.titleRequired'),
			});
			return;
		}
		console.log('onSaveToClassic', importTitle, parsedClassic.length);
	}, [importTitle, jsonErrorKind, parsedClassic, structFailReason, t]);

	const hint =
		kind === 'vocab'
			? t('englishLearning.import.hintVocab')
			: t('englishLearning.import.hintClassic');

	return (
		<div className="flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden p-5 pt-0">
			<input
				ref={reuploadInputRef}
				type="file"
				accept=".json,application/json"
				className="hidden"
				aria-hidden
				tabIndex={-1}
				onChange={onReuploadHiddenFileChange}
			/>
			<div className="text-textcolor/80 mb-3 shrink-0 leading-relaxed text-sm">
				<div>{hint}</div>
				{`[{"word": "hello", "ipa": "/həˈləʊ/", "pos": "n.", "translationZh": "你好", "example": "Hello, how are you?"}]`}
			</div>

			{jsonErrorKind === 'parse' ? (
				<p className="text-destructive mb-2 shrink-0 text-sm">
					{t('englishLearning.import.parseError')}
				</p>
			) : null}
			{jsonErrorKind === 'read' ? (
				<p className="text-destructive mb-2 shrink-0 text-sm">
					{t('englishLearning.import.readError')}
				</p>
			) : null}
			{structFailReason ? (
				<p className="text-destructive mb-2 shrink-0 text-sm">
					{t('englishLearning.import.validateError')}{' '}
					{t(`englishLearning.import.err.${structFailReason}`)}
				</p>
			) : null}

			<div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col">
				<div className="border-theme-border min-h-0 min-w-0 flex-1 basis-0 overflow-hidden rounded-md border bg-theme/5">
					{previewText ? (
						<MarkdownEditor
							className="h-full min-h-0"
							value={previewText}
							readOnly={false}
							onChange={onPreviewEditorChange}
							language="json"
							theme={monacoTheme}
							height="100%"
							documentIdentity={monacoDocumentIdentity}
							placeholder=""
							enableMarkdownBottomBar={false}
							showTabBar={false}
							stickyScrollEnabled={false}
							clipboardAdapter={monacoClipboardAdapter}
							t={t}
							title={
								<div className="flex flex-1 items-center justify-between pl-3 w-full">
									<div className="flex flex-1 items-center gap-0.5">
										<NotebookPen size={18} className="text-textcolor" />
										<Input
											value={importTitle}
											maxLength={100}
											onChange={(e) => setImportTitle(e.target.value)}
											placeholder={t('englishLearning.import.titlePlaceholder')}
											className="md:text-base h-full mr-5 border-0 bg-transparent pr-2 text-textcolor shadow-none placeholder:text-sm placeholder:text-textcolor/60 focus-visible:border-0 focus-visible:ring-0"
										/>
									</div>
									<div className="flex-1 flex justify-end pr-1 gap-3">
										<Button
											variant="link"
											className="px-0 text-theme"
											onClick={onReupload}
										>
											{t('englishLearning.import.reupload')}
										</Button>
										<Button
											variant="link"
											className="px-0 text-theme"
											disabled={
												kind === 'vocab'
													? vocabSaveLoading ||
														jsonErrorKind !== null ||
														structFailReason !== null ||
														!parsedVocab?.length ||
														!importTitle.trim()
													: false
											}
											onClick={
												kind === 'vocab' ? onSaveToVocab : onSaveToClassic
											}
										>
											{kind === 'vocab' && vocabSaveLoading
												? t('englishLearning.import.saveVocabLoading')
												: kind === 'vocab'
													? t('englishLearning.import.saveToVocab')
													: t('englishLearning.import.saveToClassic')}
										</Button>
									</div>
								</div>
							}
						/>
					) : (
						<DragDropFileUpload
							className="group flex h-full min-h-0 flex-1 flex-col"
							zoneClassName="flex h-full min-h-0 flex-1 flex-col rounded-md border border-dashed border-theme/50 hover:border-theme"
							accept=".json,application/json"
							maxCount={1}
							ariaLabel={t('englishLearning.import.dropReject')}
							onFiles={(result) => onDropZoneFiles(result)}
							onReject={(rejected) => {
								if (rejected.length > 0) onDropZoneReject();
							}}
						>
							<div className="mb-10 pointer-events-none flex h-full min-h-0 flex-col items-center justify-center gap-2 px-4 text-center text-sm">
								<CloudUpload
									className="size-18 text-theme opacity-50 group-hover:opacity-70"
									aria-hidden
								/>
								<div className="max-w-2xl text-theme opacity-65 group-hover:opacity-80">
									{t('englishLearning.import.dropReject')}
								</div>
							</div>
						</DragDropFileUpload>
					)}
				</div>
			</div>
		</div>
	);
}
