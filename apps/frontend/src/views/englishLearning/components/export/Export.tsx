/**
 * 词库 / 语句库（及历史行）导出：JSON；library 源另支持 Word。
 * UI 与并行 busy 由 ExportMenu 承担；本组件只区分 kind 与下载逻辑。
 */
import { Toast } from '@ui/sonner';
import type { MouseEvent } from 'react';
import { useI18n } from '@/hooks';
import {
	downloadEnglishClassicQuotesLibraryDocx,
	downloadEnglishVocabularyLibraryDocx,
} from '@/service';
import { isTauriRuntime } from '@/utils/runtime';
import { exportClassicQuotesJson } from '../../utils/exportClassicQuotes';
import { exportDocxFileName } from '../../utils/exportFileName';
import { exportVocabularyJson } from '../../utils/exportVocabulary';
import { ExportMenu, type ExportMenuItem } from './ExportMenu';

export type ExportKind = 'vocab' | 'classic';

export type ExportProps = {
	kind: ExportKind;
	source: 'library' | 'pack';
	libraryId?: string;
	streamId?: string;
	title?: string;
	/** 条目数（单词数 / 名句数） */
	count?: number;
	disabled?: boolean;
	onBeforeClick?: (e: MouseEvent<HTMLButtonElement>) => void;
};

export function Export({
	kind,
	source,
	libraryId,
	streamId,
	title,
	count: countProp,
	disabled,
	onBeforeClick,
}: ExportProps) {
	const { t } = useI18n();
	const idOk =
		source === 'library'
			? Boolean(libraryId?.trim())
			: Boolean(streamId?.trim());
	const count = Math.max(0, countProp ?? 0);
	const canWord = source === 'library' && idOk;
	const i18n = {
		fallback:
			kind === 'vocab'
				? 'englishLearning.vocab.exportFileFallback'
				: 'englishLearning.classic.exportFileFallback',
		empty:
			kind === 'vocab'
				? 'englishLearning.vocab.exportEmpty'
				: 'englishLearning.classic.exportEmpty',
		docxOk:
			kind === 'vocab'
				? 'englishLearning.vocab.exportDocxSuccess'
				: 'englishLearning.classic.exportDocxSuccess',
	} as const;
	const name = title?.trim() || t(i18n.fallback);

	const items: ExportMenuItem[] = [
		{
			id: 'json',
			label: t('englishLearning.export.json'),
			onSelect: async () => {
				if (!idOk) return;
				try {
					if (kind === 'vocab') {
						await exportVocabularyJson(
							source === 'library'
								? {
										source,
										libraryId: libraryId!.trim(),
										title: name,
										wordCount: countProp,
									}
								: {
										source,
										streamId: streamId!.trim(),
										title: name,
										wordCount: countProp,
									},
						);
					} else {
						await exportClassicQuotesJson(
							source === 'library'
								? {
										source,
										libraryId: libraryId!.trim(),
										title: name,
										quoteCount: countProp,
									}
								: {
										source,
										streamId: streamId!.trim(),
										title: name,
										quoteCount: countProp,
									},
						);
					}
				} catch (err: unknown) {
					const empty = err instanceof Error && err.message === 'empty';
					Toast({
						type: 'error',
						title: t(empty ? i18n.empty : 'englishLearning.export.failed'),
					});
				}
			},
		},
		{
			id: 'docx',
			label: t('englishLearning.export.docxMenu'),
			when: canWord,
			onSelect: async () => {
				if (count === 0) {
					Toast({ type: 'error', title: t(i18n.empty) });
					return;
				}
				try {
					const id = libraryId!.trim();
					const fileName = exportDocxFileName(name);
					if (kind === 'vocab') {
						await downloadEnglishVocabularyLibraryDocx(id, fileName);
					} else {
						await downloadEnglishClassicQuotesLibraryDocx(id, fileName);
					}
					// Tauri：`downloadBlob` 已 Toast 成功/取消，避免再弹「下载成功」
					if (!isTauriRuntime()) {
						Toast({ type: 'success', title: t(i18n.docxOk) });
					}
				} catch {
					Toast({
						type: 'error',
						title: t('englishLearning.export.failed'),
					});
				}
			},
		},
	];

	return (
		<ExportMenu
			items={items}
			disabled={disabled}
			triggerDisabled={!idOk}
			onBeforeClick={onBeforeClick}
		/>
	);
}
