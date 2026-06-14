import Confirm from '@design/Confirm';
import Loading from '@design/Loading';
import { Button, ScrollArea } from '@ui/index';
import { Toast } from '@ui/sonner';
import { BookOpen, FolderOpen } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import ebookStore from '@/store/ebook';
import { isTauriRuntime } from '@/utils/runtime';
import { EbookPageShell } from './components/EbookPageShell';
import { EbookPanelHeader } from './components/EbookPanelHeader';
import { EbookShelfBookCard } from './components/EbookShelfBookCard';

function EbookShelfPage() {
	const { t } = useI18n();
	const nav = useNavigate();
	const fileRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!ebookStore.ready) ebookStore.hydrate();
	}, []);

	const onOpen = (bookId: string) => {
		nav(`/ebook/read/${bookId}`);
	};

	const onPickTauri = async () => {
		try {
			const book = await ebookStore.addFromTauri();
			if (book) onOpen(book.id);
		} catch (e) {
			Toast({
				type: 'error',
				title: t('ebook.err.open'),
				message: e instanceof Error ? e.message : String(e),
			});
		}
	};

	const onPickWeb = () => fileRef.current?.click();

	const onFile = async (list: FileList | null) => {
		const file = list?.[0];
		if (!file) return;
		try {
			const book = await ebookStore.addFromFile(file);
			onOpen(book.id);
		} catch (e) {
			Toast({
				type: 'error',
				title: t('ebook.err.open'),
				message: e instanceof Error ? e.message : String(e),
			});
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

	const showInitialLoading = !ebookStore.ready;
	const showEmpty = ebookStore.ready && ebookStore.books.length === 0;

	const isTauri = isTauriRuntime();

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
								{ebookStore.ready ? (
									<span className="text-textcolor/50 ml-1 text-sm font-normal">
										（{ebookStore.books.length}）
									</span>
								) : null}
							</>
						}
						trailing={
							<div className="flex min-w-0 items-center justify-end gap-2">
								<span className="mr-1.5 text-textcolor/55 min-w-0 max-w-[min(100vw-10rem,16rem)] text-right text-xs leading-snug wrap-break-word">
									{isTauri
										? t('ebook.shelf.hintTauri')
										: t('ebook.shelf.hintWeb')}
								</span>
								{isTauri ? (
									<Button
										variant="link"
										size="sm"
										className="shrink-0 gap-1.5 px-0!"
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
				<ScrollArea className="min-h-0 flex-1 px-4 py-4">
					{showInitialLoading ? (
						<div className="text-textcolor/60 flex flex-1 flex-col items-center justify-center py-12 text-center text-sm">
							<Loading text={t('common.loading')} />
						</div>
					) : showEmpty ? (
						<div className="text-textcolor/60 py-12 text-center text-sm">
							{t('ebook.shelf.empty')}
						</div>
					) : (
						<div className="grid w-full gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))]">
							{ebookStore.books.map((b) => (
								<EbookShelfBookCard
									key={b.id}
									book={b}
									prog={ebookStore.progOf(b.id)}
									onOpen={onOpen}
									onRemove={onRequestRemove}
								/>
							))}
						</div>
					)}
				</ScrollArea>
			</EbookPageShell>
		</>
	);
}

export default observer(EbookShelfPage);
