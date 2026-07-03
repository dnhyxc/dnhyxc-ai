import Confirm from '@design/Confirm';
import Loading from '@design/Loading';
import Tooltip from '@design/Tooltip';
import { Button, ScrollArea, Spinner } from '@ui/index';
import { Toast } from '@ui/sonner';
import { BookOpen, CircuitBoard, FolderOpen } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n, useMembershipActive } from '@/hooks';
import useStore from '@/store';
import ebookStore, { EBOOK_UPLOAD_MEMBERSHIP_REQUIRED } from '@/store/ebook';
import { isTauriRuntime } from '@/utils/runtime';
import { EbookPageShell } from './components/layout/EbookPageShell';
import { EbookPanelHeader } from './components/layout/EbookPanelHeader';
import EbookCategoryManageDialog from './components/shelf/EbookCategoryManageDialog';
import { EbookShelfBookCard } from './components/shelf/EbookShelfBookCard';
import EbookShelfCategoryRail from './components/shelf/EbookShelfCategoryRail';
import { EbookShelfUploadBanner } from './components/shelf/EbookShelfUploadBanner';

function EbookShelfPage() {
	const { t } = useI18n();
	const { isMemberActive } = useMembershipActive();
	const { userStore } = useStore();
	const userId = Number(userStore.userInfo?.id) || 0;
	const nav = useNavigate();
	const fileRef = useRef<HTMLInputElement>(null);
	const [categoryManageOpen, setCategoryManageOpen] = useState(false);

	useEffect(() => {
		if (userId <= 0) return;
		void ebookStore.hydrate();
	}, [userId]);

	const isPublicShelf = ebookStore.activeCategoryKey.kind === 'public';
	const isAllShelf = ebookStore.activeCategoryKey.kind === 'all';

	const onOpen = async (id: string) => {
		const hit = ebookStore.books.find((b) => b.id === id);
		if (isPublicShelf || (isAllShelf && hit?.owner)) {
			try {
				const readingId =
					hit?.readingBookId ?? (await ebookStore.openPublicBook(id));
				nav(`/ebook/read/${readingId}`);
			} catch (e) {
				Toast({
					type: 'error',
					title: t('ebook.err.open'),
					message: e instanceof Error ? e.message : String(e),
				});
			}
			return;
		}
		nav(`/ebook/read/${id}`);
	};

	const onPickTauri = async () => {
		try {
			await ebookStore.addFromTauri();
		} catch (e) {
			Toast({
				type: 'error',
				title: t('ebook.err.open'),
				message: e instanceof Error ? e.message : String(e),
			});
		}
	};

	const onPickWeb = () => {
		if (!isMemberActive) {
			Toast({
				type: 'warning',
				title: t('ebook.shelf.membershipRequiredUploadTitle'),
				message: t('ebook.shelf.membershipRequiredUploadMessage'),
			});
			return;
		}
		fileRef.current?.click();
	};

	const onFile = async (list: FileList | null) => {
		const file = list?.[0];
		if (!file) return;
		if (!isMemberActive) {
			Toast({
				type: 'warning',
				title: t('ebook.shelf.membershipRequiredUploadTitle'),
				message: t('ebook.shelf.membershipRequiredUploadMessage'),
			});
			if (fileRef.current) fileRef.current.value = '';
			return;
		}
		try {
			await ebookStore.addFromFile(file);
		} catch (e) {
			if (
				e instanceof Error &&
				e.message === EBOOK_UPLOAD_MEMBERSHIP_REQUIRED
			) {
				Toast({
					type: 'warning',
					title: t('ebook.shelf.membershipRequiredUploadTitle'),
					message: t('ebook.shelf.membershipRequiredUploadMessage'),
				});
			} else {
				Toast({
					type: 'error',
					title: t('ebook.err.open'),
					message: e instanceof Error ? e.message : String(e),
				});
			}
		}
		if (fileRef.current) fileRef.current.value = '';
	};

	const [deleteBookId, setDeleteBookId] = useState<string | null>(null);
	const deleteBook = deleteBookId
		? ebookStore.books.find((b) => b.id === deleteBookId)
		: undefined;

	const onRequestRemove = useCallback((bookId: string) => {
		setDeleteBookId(bookId);
	}, []);

	const onConfirmRemove = useCallback(async () => {
		if (!deleteBookId) return;
		try {
			await ebookStore.remove(deleteBookId);
			setDeleteBookId(null);
		} catch {
			setDeleteBookId(null);
		}
	}, [deleteBookId]);

	const onSetCover = useCallback(
		async (bookId: string, file: File) => {
			try {
				await ebookStore.setCover(bookId, file);
				Toast({ type: 'success', title: t('ebook.shelf.coverSaved') });
			} catch (e) {
				Toast({
					type: 'error',
					title: t('ebook.shelf.coverFailed'),
					message: e instanceof Error ? e.message : String(e),
				});
				throw e;
			}
		},
		[t],
	);

	const onUpdateTitle = useCallback(
		async (bookId: string, title: string) => {
			try {
				await ebookStore.updateTitle(bookId, title);
				Toast({ type: 'success', title: t('ebook.shelf.titleSaved') });
			} catch (e) {
				Toast({
					type: 'error',
					title: t('ebook.shelf.titleFailed'),
					message: e instanceof Error ? e.message : String(e),
				});
				throw e;
			}
		},
		[t],
	);

	const onMoveCategory = useCallback(
		async (bookId: string, categoryId: string | null) => {
			try {
				await ebookStore.assignBookCategory(bookId, categoryId);
			} catch (e) {
				Toast({
					type: 'error',
					title: t('common.loadFailed'),
					message: e instanceof Error ? e.message : String(e),
				});
			}
		},
		[t],
	);

	const showInitialLoading = !ebookStore.ready && ebookStore.loading;
	const showEmpty =
		ebookStore.ready &&
		ebookStore.total === 0 &&
		!ebookStore.loading &&
		ebookStore.shelfAllCount === 0;
	const showPublicEmpty =
		ebookStore.ready &&
		ebookStore.total === 0 &&
		!ebookStore.loading &&
		isPublicShelf;
	const showCategoryEmpty =
		ebookStore.ready &&
		ebookStore.total === 0 &&
		!ebookStore.loading &&
		ebookStore.totalBookCount > 0 &&
		ebookStore.activeCategoryKey.kind !== 'all' &&
		ebookStore.activeCategoryKey.kind !== 'public';
	const showLoadMoreHint = ebookStore.loadingMore;

	const isTauri = isTauriRuntime();
	const uploading = ebookStore.busy;
	const importHint = isTauri
		? isMemberActive
			? t('ebook.shelf.hintTauriMember')
			: t('ebook.shelf.hintTauri')
		: isMemberActive
			? t('ebook.shelf.hintWebMember')
			: t('ebook.shelf.hintWeb');

	return (
		<>
			<EbookCategoryManageDialog
				open={categoryManageOpen}
				onOpenChange={setCategoryManageOpen}
			/>
			<Confirm
				open={deleteBookId != null}
				onOpenChange={(open) => {
					if (!open) setDeleteBookId(null);
				}}
				title={t('ebook.shelf.deleteConfirmTitle')}
				description={
					deleteBook
						? t('ebook.shelf.deleteConfirmDesc', { title: deleteBook.title })
						: '\u00a0'
				}
				descriptionClassName="text-left"
				confirmText={t('common.delete')}
				cancelText={t('common.cancel')}
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={() => void onConfirmRemove()}
			/>
			<EbookPageShell
				contentPadding={false}
				header={
					<EbookPanelHeader
						className="px-4.5"
						leading={
							<Button
								type="button"
								variant="link"
								size="sm"
								className="h-8 shrink-0 gap-1.5 px-0!"
								onClick={() => setCategoryManageOpen(true)}
							>
								<CircuitBoard className="size-4" aria-hidden />
								{t('ebook.shelf.category.manage')}
							</Button>
						}
						middle={<EbookShelfCategoryRail />}
						trailing={
							isTauri ? (
								<Tooltip
									side="bottom"
									sideOffset={6}
									delayDuration={300}
									shadow
									className="max-w-xs text-left leading-snug"
									content={importHint}
								>
									<Button
										variant="link"
										size="sm"
										className="h-8 shrink-0 gap-1.5 px-0!"
										disabled={uploading}
										onClick={onPickTauri}
									>
										<FolderOpen className="size-4" aria-hidden />
										{t('ebook.shelf.pickLocal')}
									</Button>
								</Tooltip>
							) : (
								<>
									<Tooltip
										side="bottom"
										sideOffset={6}
										delayDuration={300}
										shadow
										className="max-w-xs text-left leading-snug"
										content={importHint}
									>
										<Button
											variant="link"
											size="sm"
											className="h-8 shrink-0 gap-1.5 px-0!"
											disabled={uploading}
											onClick={onPickWeb}
										>
											<BookOpen className="size-4" aria-hidden />
											{t('ebook.shelf.pickFile')}
										</Button>
									</Tooltip>
									<input
										ref={fileRef}
										type="file"
										accept=".epub,.pdf"
										className="hidden"
										onChange={(e) => onFile(e.target.files)}
									/>
								</>
							)
						}
					/>
				}
			>
				<ScrollArea
					className="min-h-0 flex-1 px-4 py-4"
					onScroll={ebookStore.onShelfViewportScroll}
				>
					{ebookStore.uploadState ? (
						<EbookShelfUploadBanner state={ebookStore.uploadState} />
					) : null}
					{showInitialLoading ? (
						<div className="text-textcolor/60 flex flex-1 flex-col items-center justify-center py-12 text-center text-sm">
							<Loading text={t('common.loading')} />
						</div>
					) : showEmpty ? (
						<div className="text-textcolor/60 py-12 text-center text-sm">
							{t('ebook.shelf.empty')}
						</div>
					) : showPublicEmpty ? (
						<div className="text-textcolor/60 py-12 text-center text-sm">
							{t('ebook.shelf.publicEmpty')}
						</div>
					) : showCategoryEmpty ? (
						<div className="text-textcolor/60 py-12 text-center text-sm">
							{t('ebook.shelf.category.empty')}
						</div>
					) : (
						<>
							<div className="grid w-full gap-3 sm:gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,9.5rem),1fr))]">
								{ebookStore.books.map((b) => (
									<EbookShelfBookCard
										key={b.id}
										book={b}
										prog={ebookStore.progOf(b.id)}
										categories={ebookStore.categories}
										shelfMode={
											isPublicShelf || (isAllShelf && b.owner)
												? 'public'
												: 'mine'
										}
										onOpen={onOpen}
										onRemove={onRequestRemove}
										onSetCover={
											isPublicShelf || b.owner ? undefined : onSetCover
										}
										onUpdateTitle={
											isPublicShelf || b.owner ? undefined : onUpdateTitle
										}
										onMoveCategory={
											isPublicShelf || b.owner ? undefined : onMoveCategory
										}
									/>
								))}
							</div>
							{showLoadMoreHint ? (
								<div className="text-textcolor/50 flex items-center justify-center gap-1.5 py-4 text-xs">
									<Spinner className="size-3.5 text-textcolor/50" aria-hidden />
									{t('common.loadingMore')}
								</div>
							) : null}
						</>
					)}
				</ScrollArea>
			</EbookPageShell>
		</>
	);
}

export default observer(EbookShelfPage);
