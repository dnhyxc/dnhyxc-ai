/**
 * 资源库编辑：修改标题；超级管理员另可设置是否公开
 */
import Model from '@design/Model';
import { Button, Input, Label, Spinner, Switch, Toast } from '@ui/index';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n, useIsSuperAdmin } from '@/hooks';
import {
	patchEnglishClassicQuotesLibraryTitle,
	patchEnglishClassicQuotesLibraryVisibility,
	patchEnglishVocabularyLibraryTitle,
	patchEnglishVocabularyLibraryVisibility,
} from '@/service';
import type { EnglishLibraryListItem, LibraryKind } from '../types';
import { getLibraryItemCount } from '../types';

const LIBRARY_TITLE_MAX_LENGTH = 50;

export type LibraryVisibilityDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	kind: LibraryKind;
	library: EnglishLibraryListItem | null;
	onSaved: (library: EnglishLibraryListItem) => void;
};

export function LibraryEditDialog({
	open,
	onOpenChange,
	kind,
	library,
	onSaved,
}: LibraryVisibilityDialogProps) {
	const { t } = useI18n();
	const isSuperAdmin = useIsSuperAdmin();
	const [editTitle, setEditTitle] = useState('');
	const [isPublic, setIsPublic] = useState(false);
	const [saving, setSaving] = useState(false);

	const canEditTitle = library?.isOwned !== false;

	useEffect(() => {
		if (open && library) {
			setEditTitle(library.title ?? '');
			setIsPublic(Boolean(library.isPublic));
		}
	}, [open, library]);

	const dialogTitle =
		kind === 'vocab'
			? t('englishLearning.library.visibilityDialogTitle')
			: t('englishLearning.library.visibilityDialogTitleClassic');

	const librarySummary = useMemo(() => {
		if (!library) return '';
		const titleForSummary = editTitle.trim() || library.title || '—';
		const count = getLibraryItemCount(library, kind);
		return kind === 'vocab'
			? t('englishLearning.library.visibilityLibrarySummary', {
					title: titleForSummary,
					count,
				})
			: t('englishLearning.library.visibilityLibrarySummaryClassic', {
					title: titleForSummary,
					count,
				});
	}, [editTitle, kind, library, t]);

	const publicHelpText = librarySummary
		? `${librarySummary}${t('englishLearning.library.visibilityPublicHelp')}`
		: t('englishLearning.library.visibilityPublicHelp');

	const titleChanged =
		canEditTitle &&
		library != null &&
		editTitle.trim() !== (library.title ?? '').trim();
	const visibilityChanged =
		isSuperAdmin && library != null && isPublic !== Boolean(library.isPublic);
	const canSave =
		library != null &&
		(titleChanged || visibilityChanged) &&
		(!titleChanged || editTitle.trim().length > 0);

	const handleSave = useCallback(async () => {
		if (!library || saving || !canSave) return;
		const trimmedTitle = editTitle.trim();
		if (titleChanged && !trimmedTitle) {
			Toast({
				type: 'error',
				title: t('englishLearning.library.editTitleRequired'),
			});
			return;
		}

		setSaving(true);
		try {
			let updated: EnglishLibraryListItem = { ...library };

			if (titleChanged) {
				const res =
					kind === 'vocab'
						? await patchEnglishVocabularyLibraryTitle(library.id, trimmedTitle)
						: await patchEnglishClassicQuotesLibraryTitle(
								library.id,
								trimmedTitle,
							);
				updated = { ...updated, ...(res.data ?? {}), title: trimmedTitle };
			}

			if (visibilityChanged) {
				const res =
					kind === 'vocab'
						? await patchEnglishVocabularyLibraryVisibility(
								library.id,
								isPublic,
							)
						: await patchEnglishClassicQuotesLibraryVisibility(
								library.id,
								isPublic,
							);
				updated = { ...updated, ...(res.data ?? {}), isPublic };
			}

			onSaved(updated);
			onOpenChange(false);
			Toast({
				type: 'success',
				title: t('englishLearning.library.editSaveSuccess'),
			});
		} catch {
			// 错误由 http 层 Toast
		} finally {
			setSaving(false);
		}
	}, [
		canSave,
		editTitle,
		isPublic,
		kind,
		library,
		onOpenChange,
		onSaved,
		saving,
		t,
		titleChanged,
		visibilityChanged,
	]);

	/** 弹层打开时回车等同点击保存（标题输入框内 Enter 亦触发） */
	useEffect(() => {
		if (!open) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== 'Enter' || e.repeat || saving || !canSave) return;
			const el = e.target as HTMLElement | null;
			if (el?.closest('textarea, select, [contenteditable="true"]')) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			void handleSave();
		};
		window.addEventListener('keydown', onKeyDown, true);
		return () => window.removeEventListener('keydown', onKeyDown, true);
	}, [open, canSave, saving, handleSave]);

	return (
		<Model
			open={open}
			onOpenChange={onOpenChange}
			title={dialogTitle}
			description={publicHelpText}
			width="30rem"
			footer={null}
			header={
				<div className="pb-2 pr-8">
					<h2 className="text-lg font-semibold leading-snug text-textcolor">
						{dialogTitle}
					</h2>
				</div>
			}
		>
			<div className="flex flex-col gap-4 pt-1">
				<div className="flex flex-col gap-2">
					<Label htmlFor="library-edit-title" className="text-sm font-medium">
						{t('englishLearning.library.editTitleLabel')}
					</Label>
					<Input
						id="library-edit-title"
						value={editTitle}
						onChange={(e) => setEditTitle(e.target.value)}
						disabled={!canEditTitle || saving}
						maxLength={LIBRARY_TITLE_MAX_LENGTH}
						showCount
						placeholder={t('englishLearning.library.editTitlePlaceholder')}
						className="border-theme/20 bg-transparent shadow-none focus-visible:border-theme/40 focus-visible:ring-0"
					/>
					{!canEditTitle ? (
						<p className="text-xs text-textcolor/50">
							{t('englishLearning.library.editTitleReadonlyHint')}
						</p>
					) : null}
				</div>

				{isSuperAdmin ? (
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between gap-3">
							<Label
								htmlFor="library-visibility-public"
								className="cursor-pointer text-sm font-medium"
							>
								{t('englishLearning.library.visibilityPublicLabel')}
							</Label>
							<Switch
								id="library-visibility-public"
								checked={isPublic}
								onCheckedChange={setIsPublic}
								disabled={saving}
								className="shrink-0"
							/>
						</div>
						<p className="text-xs leading-relaxed text-textcolor/55">
							{publicHelpText}
						</p>
					</div>
				) : null}

				<div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
					<Button
						variant="outline"
						disabled={saving}
						className="w-24"
						onClick={() => onOpenChange(false)}
					>
						{t('common.cancel')}
					</Button>
					<Button
						disabled={saving || !canSave}
						onClick={() => void handleSave()}
						className="w-24 bg-teal-600 text-white hover:bg-teal-500"
					>
						{saving ? (
							<>
								<Spinner className="size-3.5 text-white" aria-hidden />
								{t('englishLearning.library.visibilitySaving')}
							</>
						) : (
							t('englishLearning.library.visibilitySaveAction')
						)}
					</Button>
				</div>
			</div>
		</Model>
	);
}
