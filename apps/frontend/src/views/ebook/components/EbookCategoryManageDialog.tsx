import Confirm from '@design/Confirm';
import Model from '@design/Model';
import { Button, Input, ScrollArea, Spinner } from '@ui/index';
import { Toast } from '@ui/sonner';
import {
	Check,
	ChevronDown,
	ChevronUp,
	Pencil,
	Plus,
	Trash2,
	X,
} from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useRef, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import ebookStore from '@/store/ebook';
import { getRequestErrorMessage } from '@/utils/fetch';

export type EbookCategoryManageDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

function iconActionClass(destructive = false): string {
	return cn(
		'inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-textcolor/55 transition-colors hover:bg-transparent dark:hover:bg-transparent',
		destructive ? 'hover:text-rose-500' : 'hover:text-teal-500',
	);
}

type SortControlProps = {
	canMoveUp: boolean;
	canMoveDown: boolean;
	disabled: boolean;
	onMoveUp: () => void;
	onMoveDown: () => void;
};

function SortControl({
	canMoveUp,
	canMoveDown,
	disabled,
	onMoveUp,
	onMoveDown,
}: SortControlProps) {
	return (
		<div
			className="border-theme/10 bg-theme-background/40 flex shrink-0 items-stretch overflow-hidden rounded-md border"
			role="group"
			aria-label="sort"
		>
			<button
				type="button"
				className="text-textcolor/55 hover:text-textcolor flex items-center justify-center px-1.5 py-2 transition-colors disabled:opacity-25"
				disabled={!canMoveUp || disabled}
				aria-label="↑"
				onClick={onMoveUp}
			>
				<ChevronUp className="size-4" aria-hidden />
			</button>
			<div className="bg-theme/10 w-px self-stretch" aria-hidden />
			<button
				type="button"
				className="text-textcolor/55 hover:text-textcolor flex items-center justify-center px-1.5 py-2 transition-colors disabled:opacity-25"
				disabled={!canMoveDown || disabled}
				aria-label="↓"
				onClick={onMoveDown}
			>
				<ChevronDown className="size-4" aria-hidden />
			</button>
		</div>
	);
}

function EbookCategoryManageDialog({
	open,
	onOpenChange,
}: EbookCategoryManageDialogProps) {
	const { t } = useI18n();
	const [newName, setNewName] = useState('');
	const [adding, setAdding] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editDraft, setEditDraft] = useState('');
	const [savingId, setSavingId] = useState<string | null>(null);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const listScrollRef = useRef<HTMLDivElement>(null);
	const addInputRef = useRef<HTMLInputElement>(null);

	const scrollListToBottom = useCallback(() => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				const viewport = listScrollRef.current;
				if (!viewport) return;
				viewport.scrollTop = viewport.scrollHeight;
			});
		});
	}, []);

	const focusAddInput = useCallback(() => {
		requestAnimationFrame(() => {
			addInputRef.current?.focus();
		});
	}, []);

	const resetEdit = useCallback(() => {
		setEditingId(null);
		setEditDraft('');
	}, []);

	const showCategoryNameError = (e: unknown) => {
		const message = getRequestErrorMessage(e);
		const duplicateTitle = t('ebook.shelf.category.duplicateName');
		Toast({
			type: 'error',
			title: duplicateTitle,
			message: message !== duplicateTitle ? message : undefined,
		});
	};

	const onAdd = async () => {
		const name = newName.trim();
		if (!name || adding) return;
		setAdding(true);
		let added = false;
		try {
			await ebookStore.createCategory(name);
			setNewName('');
			added = true;
			scrollListToBottom();
		} catch (e) {
			showCategoryNameError(e);
		} finally {
			setAdding(false);
			if (added) {
				focusAddInput();
			}
		}
	};

	const onSaveRename = async (id: string) => {
		const name = editDraft.trim();
		if (!name || savingId) return;
		setSavingId(id);
		try {
			await ebookStore.renameCategory(id, name);
			resetEdit();
		} catch (e) {
			showCategoryNameError(e);
		} finally {
			setSavingId(null);
		}
	};

	const onConfirmDelete = async () => {
		if (!deleteId || busy) return;
		setBusy(true);
		try {
			await ebookStore.deleteCategory(deleteId);
			setDeleteId(null);
		} catch (e) {
			Toast({
				type: 'error',
				title: t('common.loadFailed'),
				message: getRequestErrorMessage(e),
			});
		} finally {
			setBusy(false);
		}
	};

	const manageTitle = t('ebook.shelf.category.manage');

	return (
		<>
			<Confirm
				open={deleteId != null}
				onOpenChange={(next) => {
					if (!next) setDeleteId(null);
				}}
				title={t('ebook.shelf.category.delete')}
				description={t('ebook.shelf.category.deleteConfirm')}
				confirmText={t('common.delete')}
				cancelText={t('common.cancel')}
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={() => void onConfirmDelete()}
			/>
			<Model
				open={open}
				onOpenChange={onOpenChange}
				title={manageTitle}
				description={manageTitle}
				width="35rem"
				footer={null}
				header={
					<div className="pr-8">
						<h2 className="h-8 flex items-center text-textcolor text-lg leading-snug font-semibold">
							{manageTitle}
						</h2>
					</div>
				}
			>
				<div className="flex min-w-0 flex-col">
					<ScrollArea
						ref={listScrollRef}
						className="max-h-72 -mx-4.5 min-w-0 w-[calc(100%+2.25rem)]"
						viewportClassName="min-w-0 max-w-full [&>div]:!min-w-0 [&>div]:!max-w-full"
					>
						<div className="flex min-w-0 flex-col gap-2 px-4.5 pb-2">
							{ebookStore.categories.length === 0 ? (
								<p className="text-textcolor/50 py-8 text-center text-sm">
									{t('ebook.shelf.category.add')}
								</p>
							) : (
								ebookStore.categories.map((cat, index) => {
									const isEditing = editingId === cat.id;
									const isSaving = savingId === cat.id;
									return (
										<div
											key={cat.id}
											className={cn(
												'flex min-w-0 items-center gap-2 overflow-hidden rounded-md border px-2 py-1.5 transition-colors',
												isEditing
													? 'border-theme/15 bg-theme/8 ring-1 ring-theme/10'
													: 'border-theme/10 bg-theme/5',
											)}
										>
											<SortControl
												canMoveUp={index > 0}
												canMoveDown={index < ebookStore.categories.length - 1}
												disabled={busy || isEditing}
												onMoveUp={() =>
													void ebookStore.moveCategory(cat.id, 'up')
												}
												onMoveDown={() =>
													void ebookStore.moveCategory(cat.id, 'down')
												}
											/>

											{isEditing ? (
												<Input
													autoFocus
													value={editDraft}
													maxLength={20}
													showCount
													className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0"
													disabled={isSaving}
													onChange={(e) => setEditDraft(e.target.value)}
													onKeyDown={(e) => {
														if (e.key === 'Enter') {
															e.preventDefault();
															void onSaveRename(cat.id);
														}
														if (e.key === 'Escape') {
															resetEdit();
														}
													}}
												/>
											) : (
												<div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
													<span
														className="text-textcolor min-w-0 shrink truncate text-sm font-medium"
														title={cat.name}
													>
														{cat.name}
													</span>
													<span className="bg-theme/10 inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-xs leading-none text-textcolor/55 tabular-nums">
														{cat.bookCount}
													</span>
												</div>
											)}

											<div className="flex shrink-0 items-center gap-0.5">
												{isEditing ? (
													<>
														<button
															type="button"
															className={iconActionClass()}
															disabled={isSaving}
															aria-label={t('common.confirm')}
															onClick={() => void onSaveRename(cat.id)}
														>
															{isSaving ? (
																<Spinner
																	className="size-3.5 text-textcolor"
																	aria-hidden
																/>
															) : (
																<Check className="size-5" aria-hidden />
															)}
														</button>
														<button
															type="button"
															className={iconActionClass(true)}
															disabled={isSaving}
															aria-label={t('common.cancel')}
															onClick={resetEdit}
														>
															<X className="size-5" aria-hidden />
														</button>
													</>
												) : (
													<>
														<button
															type="button"
															className={iconActionClass()}
															aria-label={t('ebook.shelf.category.rename')}
															onClick={() => {
																setEditingId(cat.id);
																setEditDraft(cat.name);
															}}
														>
															<Pencil className="size-4" aria-hidden />
														</button>
														<button
															type="button"
															className={iconActionClass(true)}
															aria-label={t('ebook.shelf.category.delete')}
															onClick={() => setDeleteId(cat.id)}
														>
															<Trash2 className="size-4" aria-hidden />
														</button>
													</>
												)}
											</div>
										</div>
									);
								})
							)}
						</div>
					</ScrollArea>

					<div className="border-theme/10 -mx-4.5 mt-4 min-w-0 px-4.5">
						<div className="border-theme/10 bg-theme/5 flex min-w-0 items-center gap-1 overflow-hidden rounded-md border p-1 pl-2">
							<Input
								ref={addInputRef}
								value={newName}
								maxLength={20}
								placeholder={t('ebook.shelf.category.add')}
								className="h-8 min-w-0 flex-1 truncate border-0 bg-transparent px-1 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0"
								disabled={adding}
								showCount
								onChange={(e) => setNewName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										void onAdd();
									}
								}}
							/>
							<Button
								size="sm"
								className="h-8 shrink-0 gap-1 px-3"
								disabled={adding || !newName.trim()}
								onClick={() => void onAdd()}
							>
								{adding ? (
									<Spinner className="size-3.5" aria-hidden />
								) : (
									<Plus className="size-3.5" aria-hidden />
								)}
								{t('ebook.shelf.category.add')}
							</Button>
						</div>
					</div>
				</div>
			</Model>
		</>
	);
}

export default observer(EbookCategoryManageDialog);
