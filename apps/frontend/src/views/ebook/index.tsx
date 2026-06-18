import Confirm from '@design/Confirm';
import Loading from '@design/Loading';
import { Button, ScrollArea, Spinner } from '@ui/index';
import { Toast } from '@ui/sonner';
import { BookOpen, FolderOpen } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n, useMembershipActive } from '@/hooks';
import useStore from '@/store';
import ebookStore, { EBOOK_UPLOAD_MEMBERSHIP_REQUIRED } from '@/store/ebook';
import { isTauriRuntime } from '@/utils/runtime';
import { EbookPageShell } from './components/EbookPageShell';
import { EbookPanelHeader } from './components/EbookPanelHeader';
import { EbookShelfBookCard } from './components/EbookShelfBookCard';
import { EbookShelfUploadBanner } from './components/EbookShelfUploadBanner';

function EbookShelfPage() {
	const { t } = useI18n();
	const { isMemberActive } = useMembershipActive();
	const { userStore } = useStore();
	const userId = Number(userStore.userInfo?.id) || 0;
	const nav = useNavigate();
	const fileRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (userId <= 0) return;
		void ebookStore.hydrate();
	}, [userId]);

	const onOpen = (bookId: string) => {
		nav(`/ebook/read/${bookId}`);
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

	const shelfTotal =
		Number.isFinite(ebookStore.total) && ebookStore.total > 0
			? ebookStore.total
			: null;
	const showInitialLoading = !ebookStore.ready && ebookStore.loading;
	const showEmpty =
		ebookStore.ready && ebookStore.total === 0 && !ebookStore.loading;
	const showLoadMoreHint = ebookStore.loadingMore;

	const isTauri = isTauriRuntime();
	const uploading = ebookStore.busy;

	return (
		<>
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
						title={
							<>
								{t('ebook.shelf.title')}
								{shelfTotal != null ? (
									<span className="text-textcolor/50 ml-1 text-sm font-normal">
										（{shelfTotal}）
									</span>
								) : null}
							</>
						}
						trailing={
							<div className="flex min-w-0 items-center justify-end gap-2">
								<span className="mr-1.5 text-textcolor/55 min-w-0 text-right text-xs leading-snug wrap-break-word">
									{isTauri
										? isMemberActive
											? t('ebook.shelf.hintTauriMember')
											: t('ebook.shelf.hintTauri')
										: isMemberActive
											? t('ebook.shelf.hintWebMember')
											: t('ebook.shelf.hintWeb')}
								</span>
								{isTauri ? (
									<Button
										variant="link"
										size="sm"
										className="shrink-0 gap-1.5 px-0!"
										disabled={uploading}
										onClick={onPickTauri}
									>
										<FolderOpen className="size-4" aria-hidden />
										{t('ebook.shelf.pickLocal')}
									</Button>
								) : (
									<>
										<Button
											variant="link"
											size="sm"
											className="shrink-0 gap-1.5 px-0!"
											disabled={uploading}
											onClick={onPickWeb}
										>
											<BookOpen className="size-4" aria-hidden />
											{t('ebook.shelf.pickFile')}
										</Button>
										<input
											ref={fileRef}
											type="file"
											accept=".epub,.pdf"
											className="hidden"
											onChange={(e) => onFile(e.target.files)}
										/>
									</>
								)}
							</div>
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
					) : (
						<>
							<div className="grid w-full gap-3 sm:gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,9.5rem),1fr))]">
								{ebookStore.books.map((b) => (
									<EbookShelfBookCard
										key={b.id}
										book={b}
										prog={ebookStore.progOf(b.id)}
										onOpen={onOpen}
										onRemove={onRequestRemove}
										onSetCover={onSetCover}
										onUpdateTitle={onUpdateTitle}
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
