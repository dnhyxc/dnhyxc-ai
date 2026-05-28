/**
 * 英语学习：从 JSON 文件导入单词包或经典语句列表（独立路由页）。
 */

import { Button, Input, Toast } from '@ui/index';
import { CloudUpload, NotebookPen } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { DragDropAcceptResult } from '@/components/design/DragDropFileUpload';
import DragDropFileUpload from '@/components/design/DragDropFileUpload';
import MarkdownEditor from '@/components/design/Monaco';
import { useI18n, useTheme } from '@/hooks';
import {
	type EnglishClassicQuoteItem,
	type EnglishVocabularyItem,
	uploadEnglishClassicQuotesLibraryJson,
	uploadEnglishVocabularyLibraryJson,
} from '@/service';
import { copyToClipboard, pasteFromClipboard } from '@/utils/clipboard';
import {
	isJsonImportFileName,
	JSON_IMPORT_ACCEPT,
	pickEnglishLearningJsonFile,
} from './englishLearningImportFile';

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

/** 取文件名（不含路径）并去掉最后一个扩展名，用于导入标题默认值 */
function fileNameWithoutExtension(name: string): string {
	const base = name.replace(/\\/g, '/').split('/').pop() ?? name;
	const lastDot = base.lastIndexOf('.');
	if (lastDot <= 0) return base;
	return base.slice(0, lastDot);
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
		const segmentation =
			typeof o.segmentation === 'string'
				? o.segmentation.trim().slice(0, 500)
				: '';
		const translationZh =
			typeof o.translationZh === 'string'
				? o.translationZh
				: typeof o.translation_zh === 'string'
					? o.translation_zh
					: '—';
		const example = typeof o.example === 'string' ? o.example : '—';
		items.push({ word, ipa, pos, segmentation, translationZh, example });
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

type ImportValidation = {
	jsonParseError: boolean;
	structFailReason: ParseFailReason | null;
	parsedVocab: EnglishVocabularyItem[] | null;
	parsedClassic: EnglishClassicQuoteItem[] | null;
};

/** 根据当前编辑器 JSON 文本重新校验（导入后与编辑中均适用） */
function validateImportPreview(
	text: string,
	kind: ImportKind,
): ImportValidation {
	const trimmed = text.trim();
	if (!trimmed) {
		return {
			jsonParseError: false,
			structFailReason: null,
			parsedVocab: null,
			parsedClassic: null,
		};
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return {
			jsonParseError: true,
			structFailReason: null,
			parsedVocab: null,
			parsedClassic: null,
		};
	}
	if (kind === 'vocab') {
		const res = parseVocabularyImport(parsed);
		if (res.ok) {
			return {
				jsonParseError: false,
				structFailReason: null,
				parsedVocab: res.items,
				parsedClassic: null,
			};
		}
		return {
			jsonParseError: false,
			structFailReason: res.reason,
			parsedVocab: null,
			parsedClassic: null,
		};
	}
	const res = parseClassicImport(parsed);
	if (res.ok) {
		return {
			jsonParseError: false,
			structFailReason: null,
			parsedVocab: null,
			parsedClassic: res.items,
		};
	}
	return {
		jsonParseError: false,
		structFailReason: res.reason,
		parsedVocab: null,
		parsedClassic: null,
	};
}

export default function EnglishLearningImportPage() {
	const { t } = useI18n();
	const { theme } = useTheme();
	const navigate = useNavigate();
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
	/** 仅文件读取失败时使用；JSON 语法与结构校验随 previewText 派生 */
	const [fileReadError, setFileReadError] = useState(false);
	const [importTitle, setImportTitle] = useState('');
	const [vocabSaveLoading, setVocabSaveLoading] = useState(false);
	const [classicSaveLoading, setClassicSaveLoading] = useState(false);

	const importValidation = useMemo(
		() => validateImportPreview(previewText, kind),
		[previewText, kind],
	);

	const { jsonParseError, structFailReason, parsedVocab, parsedClassic } =
		importValidation;

	useEffect(() => {
		setPreviewText('');
		setFileReadError(false);
	}, [kind]);

	const processJsonFile = useCallback(
		(file: File) => {
			if (!isJsonImportFileName(file.name)) {
				Toast({
					type: 'warning',
					title: t('englishLearning.import.dropReject'),
				});
				return;
			}
			setFileReadError(false);
			setImportTitle(fileNameWithoutExtension(file.name).slice(0, 100));
			const reader = new FileReader();
			reader.onload = () => {
				const text = typeof reader.result === 'string' ? reader.result : '';
				if (!text.trim()) {
					setPreviewText('');
					return;
				}
				try {
					const parsed = JSON.parse(text);
					setPreviewText(JSON.stringify(parsed, null, 2));
				} catch {
					// 非法 JSON 时仍展示完整原始文本，便于对照修正；校验由 importValidation 派生
					setPreviewText(text);
				}
			};
			reader.onerror = () => {
				setFileReadError(true);
				setPreviewText('');
			};
			reader.readAsText(file, 'UTF-8');
		},
		[t],
	);

	const pickImportJsonFiles = useCallback(async (): Promise<File[] | null> => {
		try {
			const file = await pickEnglishLearningJsonFile();
			return file ? [file] : null;
		} catch (e) {
			if (e instanceof Error && e.message === 'not_json') {
				Toast({
					type: 'warning',
					title: t('englishLearning.import.dropReject'),
				});
				return null;
			}
			throw e;
		}
	}, [t]);

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

	/** 标题栏「重新上传」：与拖拽区共用 pickImportJsonFiles（Tauri 为仅 .json 系统对话框） */
	const onReupload = useCallback(() => {
		setFileReadError(false);
		setPreviewText('');
		void pickImportJsonFiles().then((files) => {
			const file = files?.[0];
			if (file) processJsonFile(file);
		});
	}, [pickImportJsonFiles, processJsonFile]);

	/** 编辑器内容变更时同步 previewText，校验结果由 importValidation 自动更新 */
	const onPreviewEditorChange = useCallback((next: string) => {
		if (!next.trim()) {
			setPreviewText('');
			return;
		}
		setPreviewText(next);
	}, []);

	// 保存到单词库
	const onSaveToVocab = useCallback(async () => {
		if (jsonParseError || structFailReason !== null) {
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
				navigate(
					`/english-learning/library?kind=vocab&library=${encodeURIComponent(res.data.id)}`,
					{ replace: true },
				);
			}
		} catch {
			// 错误文案由 http 层 Toast 统一展示
		} finally {
			setVocabSaveLoading(false);
		}
	}, [
		importTitle,
		jsonParseError,
		navigate,
		previewText,
		parsedVocab,
		structFailReason,
		t,
	]);

	// 保存到经典语句库
	const onSaveToClassic = useCallback(async () => {
		if (jsonParseError || structFailReason !== null) {
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
		if (!importTitle.trim()) {
			Toast({
				type: 'error',
				title: t('englishLearning.import.titleRequired'),
			});
			return;
		}
		try {
			setClassicSaveLoading(true);
			const res = await uploadEnglishClassicQuotesLibraryJson({
				title: importTitle.trim(),
				jsonUtf8: previewText,
			});
			if (res.success && res.data) {
				Toast({
					type: 'success',
					title: t('englishLearning.import.saveClassicSuccess', {
						count: String(res.data.quoteCount),
					}),
				});
				navigate(
					`/english-learning/library?kind=classic&library=${encodeURIComponent(res.data.id)}`,
					{ replace: true },
				);
			}
		} catch {
			// 错误文案由 http 层 Toast 统一展示
		} finally {
			setClassicSaveLoading(false);
		}
	}, [
		importTitle,
		jsonParseError,
		navigate,
		previewText,
		parsedClassic,
		structFailReason,
		t,
	]);

	const hint =
		kind === 'vocab'
			? t('englishLearning.import.hintVocab')
			: t('englishLearning.import.hintClassic');

	return (
		<div className="flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden p-5.5 pt-0">
			<div className="text-textcolor/80 mb-3 shrink-0 leading-relaxed text-sm">
				<div className="flex items-start justify-between">
					<div className="-mt-0.5">{hint}</div>
					<Button
						variant="link"
						size="sm"
						className="text-teal-500 hover:text-teal-400 hover:bg-teal-500/5 border border-teal-600/20"
						onClick={() => navigate(`/english-learning/library?kind=${kind}`)}
					>
						{t('route.englishLearning.library.title')}
					</Button>
				</div>
				<div className="max-w-3xl -mt-1">
					{kind === 'vocab'
						? `[{"word": "hello", "ipa": "/həˈləʊ/", "pos": "n.", "segmentation": "hel-lo", "translationZh": "你好", "example": "Hello, how are you?"}]`
						: `[{"english": "Education is not the filling of a pail, but the lighting of a fire.", "translationZh": "教育不是注满一桶水，而是点燃一把火。", "source": "William Butler Yeats", "noteZh": "经典比喻，阐明教育的本质是激发热情。"}]`}
				</div>
			</div>
			{jsonParseError ? (
				<p className="text-destructive mb-2 shrink-0 text-sm">
					{t('englishLearning.import.parseError')}
				</p>
			) : null}
			{fileReadError ? (
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
							readOnly={vocabSaveLoading || classicSaveLoading}
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
														jsonParseError ||
														structFailReason !== null ||
														!parsedVocab?.length ||
														!importTitle.trim()
													: classicSaveLoading ||
														jsonParseError ||
														structFailReason !== null ||
														!parsedClassic?.length ||
														!importTitle.trim()
											}
											onClick={
												kind === 'vocab' ? onSaveToVocab : onSaveToClassic
											}
										>
											{kind === 'vocab' && vocabSaveLoading
												? t('englishLearning.import.saveVocabLoading')
												: kind === 'classic' && classicSaveLoading
													? t('englishLearning.import.saveClassicLoading')
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
							accept={JSON_IMPORT_ACCEPT}
							acceptExtensionOnly
							pickFiles={pickImportJsonFiles}
							maxCount={1}
							ariaLabel={t('englishLearning.import.selectFile')}
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
