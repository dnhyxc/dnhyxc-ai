/**
 * 语句库 / Pack 整集词标注：hover 二选（在线标注 | 手动导入）。
 */
import Confirm from '@design/Confirm';
import { Button } from '@ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import { Toast } from '@ui/sonner';
import { WholeWord } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type ChangeEvent,
	type MouseEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { useNavigate } from 'react-router';
import { Spinner } from '@/components/ui';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { importEnglishSentenceWordAnnotations } from '@/service';
import EnglishAnnotateSource from '@/store/englishAnnotateSource';
import { clearSentenceWordAnnotationCache } from '../../practice/utils/sentenceWordAnnotationCache';
import {
	AnnotationImportFormatError,
	parseAnnotationImportJson,
} from '../../utils/parseAnnotationImport';

type AnnotateProps = {
	source: 'library' | 'pack';
	libraryId?: string;
	streamId?: string;
	/** 任务标题（库名 / Pack 主题） */
	title?: string;
	quoteCount?: number;
	variant?: 'icon' | 'text';
	disabled?: boolean;
	className?: string;
	onBeforeClick?: (e: MouseEvent<HTMLButtonElement>) => void;
};

function AnnotateInner({
	source,
	libraryId,
	streamId,
	title,
	quoteCount,
	variant = 'icon',
	disabled,
	className,
	onBeforeClick,
}: AnnotateProps) {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [importing, setImporting] = useState(false);
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		void EnglishAnnotateSource.hydrate();
	}, []);

	useEffect(
		() => () => {
			if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
		},
		[],
	);

	const idOk =
		source === 'library'
			? Boolean(libraryId?.trim())
			: Boolean(streamId?.trim());

	const running = EnglishAnnotateSource.isSourceRunning(
		source,
		libraryId,
		streamId,
	);

	const openMenu = useCallback(() => {
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
		setMenuOpen(true);
	}, []);

	const scheduleCloseMenu = useCallback(() => {
		if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
		closeTimerRef.current = setTimeout(() => setMenuOpen(false), 160);
	}, []);

	const startAndGo = useCallback(() => {
		const label =
			title?.trim() ||
			(source === 'library'
				? t('englishLearning.annotateTasks.untitledLibrary')
				: t('englishLearning.annotateTasks.untitledPack'));
		void (async () => {
			try {
				const { reused, openedStream } = await EnglishAnnotateSource.start({
					source,
					libraryId,
					streamId,
					title: label,
					quoteCountHint: quoteCount,
				});
				setConfirmOpen(false);
				navigate('/english-learning/annotate');
				if (reused && !openedStream) {
					Toast({
						type: 'info',
						title: t('englishLearning.annotateTasks.alreadyActive'),
					});
				}
			} catch {
				Toast({
					type: 'error',
					title: t('englishLearning.annotateSource.failed'),
				});
			}
		})();
	}, [libraryId, navigate, quoteCount, source, streamId, t, title]);

	const onOnlineSelect = useCallback(() => {
		setMenuOpen(false);
		// 仅真正进行中才进「查看进度」；已暂停应回到「在线标注」确认流
		if (running) {
			EnglishAnnotateSource.bumpSourceToFront(source, libraryId, streamId);
			navigate('/english-learning/annotate');
			return;
		}
		setConfirmOpen(true);
	}, [libraryId, navigate, running, source, streamId]);

	const onImportSelect = useCallback(() => {
		setMenuOpen(false);
		// 在线预热进行中：LLM 回写可能覆盖刚导入的同 key，先拦住
		if (running) {
			Toast({
				type: 'info',
				title: t('englishLearning.annotateSource.importBlockedRunning'),
			});
			return;
		}
		fileRef.current?.click();
	}, [running, t]);

	const onFileChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			e.target.value = '';
			if (!file || importing) return;
			setImporting(true);
			void (async () => {
				try {
					const text = await file.text();
					const items = parseAnnotationImportJson(text);
					const res = await importEnglishSentenceWordAnnotations({
						source,
						libraryId: libraryId?.trim(),
						streamId: streamId?.trim(),
						items,
						silent: true,
					});
					clearSentenceWordAnnotationCache();
					const accepted = res.data?.accepted ?? 0;
					const skipped = res.data?.skipped ?? 0;
					const overwritten = res.data?.overwritten ?? 0;
					// 部分导入：accepted>0 即成功，不与 quoteCount 比较
					if (accepted <= 0) {
						Toast({
							type: 'error',
							title: t('englishLearning.annotateSource.importAllSkipped', {
								skipped,
							}),
						});
						return;
					}
					Toast({
						type: 'success',
						title: t('englishLearning.annotateSource.importSuccess', {
							accepted,
							skipped,
							overwritten,
						}),
					});
				} catch (err) {
					const code =
						err instanceof AnnotationImportFormatError ? err.message : '';
					const titleKey =
						code === 'classic_quotes'
							? 'englishLearning.annotateSource.importClassicFile'
							: code === 'empty' || code === 'no_valid_items'
								? 'englishLearning.annotateSource.importEmpty'
								: code
									? 'englishLearning.annotateSource.importInvalid'
									: 'englishLearning.annotateSource.importFailed';
					Toast({ type: 'error', title: t(titleKey) });
				} finally {
					setImporting(false);
				}
			})();
		},
		[importing, libraryId, source, streamId, t],
	);

	if (!idOk) return null;

	const count = quoteCount != null && quoteCount > 0 ? quoteCount : undefined;
	const busy = importing || running;
	const tip = t('englishLearning.annotateSource.action');

	const triggerInner = busy ? (
		<Spinner className="size-3.5 text-textcolor/85" aria-hidden />
	) : (
		<WholeWord className="size-4.5" aria-hidden />
	);

	const iconTrigger = (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			disabled={disabled || importing}
			aria-label={tip}
			aria-haspopup="menu"
			className={cn(
				'h-7 w-7 shrink-0 rounded-md p-0 transition-colors',
				'text-textcolor/65 hover:border hover:border-teal-500/15 hover:bg-teal-500/10 hover:text-teal-500',
				className,
			)}
			onMouseEnter={openMenu}
			onMouseLeave={scheduleCloseMenu}
			onClick={(e) => {
				onBeforeClick?.(e);
				e.stopPropagation();
				if (importing) return;
				setMenuOpen((o) => !o);
			}}
		>
			{triggerInner}
		</Button>
	);

	const textTrigger = (
		<button
			type="button"
			disabled={disabled || importing}
			aria-haspopup="menu"
			className={cn(
				'flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-sm font-medium text-teal-500 hover:text-teal-400',
				(disabled || importing) && 'cursor-not-allowed opacity-50',
				className,
			)}
			onMouseEnter={openMenu}
			onMouseLeave={scheduleCloseMenu}
			onClick={(e) => {
				onBeforeClick?.(e as unknown as MouseEvent<HTMLButtonElement>);
				e.stopPropagation();
				if (importing) return;
				setMenuOpen((o) => !o);
			}}
		>
			{busy ? (
				<Spinner className="size-4 shrink-0 text-teal-500" aria-hidden />
			) : (
				<WholeWord className="size-5 shrink-0" aria-hidden />
			)}
			{t('englishLearning.annotateSource.action')}
		</button>
	);

	return (
		<>
			<input
				ref={fileRef}
				type="file"
				accept="application/json,.json"
				className="hidden"
				onChange={onFileChange}
			/>
			<Confirm
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				title={t('englishLearning.annotateSource.confirmTitle')}
				description={
					count != null
						? t('englishLearning.annotateSource.confirmDescCount', { count })
						: t('englishLearning.annotateSource.confirmDesc')
				}
				descriptionClassName="text-left"
				confirmText={t('englishLearning.annotateSource.confirmAction')}
				cancelText={t('common.cancel')}
				onConfirm={startAndGo}
			/>
			<DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
				<DropdownMenuTrigger asChild>
					{variant === 'text' ? textTrigger : iconTrigger}
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					sideOffset={6}
					scrollable={false}
					className="min-w-34"
					onCloseAutoFocus={(e) => e.preventDefault()}
					onMouseEnter={openMenu}
					onMouseLeave={scheduleCloseMenu}
					onClick={(e) => e.stopPropagation()}
				>
					<DropdownMenuItem
						className="justify-center"
						disabled={importing}
						onSelect={(e) => {
							e.preventDefault();
							onOnlineSelect();
						}}
					>
						{running
							? t('englishLearning.annotateTasks.viewProgress')
							: t('englishLearning.annotateSource.menuOnline')}
					</DropdownMenuItem>
					<DropdownMenuItem
						className="justify-center"
						disabled={importing || running}
						onSelect={(e) => {
							e.preventDefault();
							onImportSelect();
						}}
					>
						{t('englishLearning.annotateSource.menuImport')}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	);
}

export const Annotate = observer(AnnotateInner);
