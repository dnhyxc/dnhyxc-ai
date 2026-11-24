/**
 * 语句库 / Pack 整集词标注：hover 二选（在线标注 | 手动导入）。
 */
import Confirm from '@design/Confirm';
import Model from '@design/Model';
import { Button } from '@ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import { Toast } from '@ui/sonner';
import { CheckCircle, Copy, WholeWord } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type MouseEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { useNavigate } from 'react-router';
import DragDropFileUpload from '@/components/design/DragDropFileUpload';
import { ScrollArea, Spinner } from '@/components/ui';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { importEnglishSentenceWordAnnotations } from '@/service';
import EnglishAnnotateSource from '@/store/englishAnnotateSource';
import { copyToClipboard } from '@/utils/clipboard';
import {
	JSON_IMPORT_ACCEPT,
	pickEnglishLearningJsonFile,
} from '../../import/englishLearningImportFile';
import { clearSentenceWordAnnotationCache } from '../../practice/utils/sentenceWordAnnotationCache';
import {
	AnnotationImportFormatError,
	parseAnnotationImportJson,
} from '../../utils/parseAnnotationImport';

/** 给第三方应用或模型：读入语句库 JSON，产出可手动导入的标注文件。 */
const ANNOTATION_IMPORT_PROMPT = `请为导入的语句 JSON 文件中 items 里的每一条 english 生成词标注。
输入文件顶层是 { "title": "", "items": [ ... ] }。每条 item 含 english，以及 translationZh、source、noteZh。只根据 english 标注。不要把 title、translationZh、source、noteZh 写进输出。
english 必须原样复制输入里的 english，不要翻译，不要改大小写，不要改标点，不要改空格。
输出只有一个 JSON 对象。顶层是 { "items": [ ... ] }。每个 item 只有 english 和 words。
words 覆盖该句每一个词，顺序与句中一致，不要跳词或合并。每个词含 word、posZh、ipa、meaningZh、roleZh。
word 保留句中原词的大小写。
posZh 只能是：冠词、限定词、名词、动词、助动词、形容词、副词、介词、代词、连词、数词、感叹词、短语。
ipa 用英式 RP 的 Unicode，不要加 // 或 []。例：dance→dɑːns，water→ˈwɔːtə，car→kɑː（词尾 r 不发音）。
th：清音 θ（think、with、three），浊音 ð（this、that、the）。with 标 wɪθ，不要标 wɪð。
meaningZh 按本句搭配和语法功能释义，2 到 12 个字，不要只抄词典第一义。
roleZh 按该词在本句中的句法功能标注。先分析句子结构，再落标签。必须准确，符合严格句法分析，禁止按词性猜测。
roleZh 只能是：主语、谓语、主语和谓语、宾语、表语、定语、状语、补语、同位语、其他成分。
先分出主句和从句。每个词只标它所在分句里的功能。
主语是句法主语的中心词，包括形式主语 it、there。
谓语是谓语动词词组里的助动词、情态动词和主要动词，包括疑问句里提前的助动词。主语和谓语分开标。
「主语和谓语」只用于一个词里同时含有主语和谓语的缩合，如 I'm、he's、that's、what's。已经分开的词禁止用这个标签。
宾语是及物动词或介词的宾语中心词。双宾语的两个中心词都标「宾语」。
表语是系动词后说明主语的形容词或名词中心词，以及作表语的介词。
补语是宾语补足语或主语补足语的中心词，不与宾语、表语混用。
定语是修饰名词的冠词、限定词、形容词、名词，以及作定语的介词。中心词仍标它所在短语的句法功能。
状语是修饰动词、形容词、副词或全句的副词和介词，包括句首疑问副词。状语内部的宾语和定语仍按内部功能标注，不要整段都标「状语」。
同位语是对前一词复指说明的中心词。
其他成分是并列连词、从属连词、感叹词，以及不承担上述功能的词。
连续同一成分写同一个 roleZh；中间隔了别的成分就分开。不要把词性写进 roleZh。
能确定就必须填写。只有残缺到无法判断句法功能时才留空字符串。
例：Why are you smiling? → Why=状语，are=谓语，you=主语，smiling=谓语。
例：The old man made him happy. → The=定语，old=定语，man=主语，made=谓语，him=宾语，happy=补语。
助动词标「助动词」；the、a、an 标「冠词」；this、that、my、your 标「限定词」。
字符串里不要出现未转义的英文双引号。
如果一次写不完，只输出已经写完的句子。JSON 必须能被完整解析，不要截断在半个对象。
输出示例：
{
  "items": [
    {
      "english": "Why are you smiling?",
      "words": [
        {
          "word": "Why",
          "posZh": "副词",
          "ipa": "/waɪ/",
          "meaningZh": "为什么",
          "roleZh": "状语"
        },
        {
          "word": "are",
          "posZh": "助动词",
          "ipa": "/ɑː/",
          "meaningZh": "构成进行时",
          "roleZh": "谓语"
        },
        {
          "word": "you",
          "posZh": "代词",
          "ipa": "/juː/",
          "meaningZh": "你",
          "roleZh": "主语"
        },
        {
          "word": "smiling",
          "posZh": "动词",
          "ipa": "/ˈsmaɪlɪŋ/",
          "meaningZh": "微笑",
          "roleZh": "谓语"
        }
      ]
    }
  ]
}
注意：最终必须要以 .json 文件形式输出。如果当前应用不能输出 .json 文件，则改为 markdown 形式输出，用 json 代码块包住同一个 JSON 对象。一定不能直接通过文本的形式输出。能输出 .json 文件时优先输出 .json 文件。`;

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
	const [importOpen, setImportOpen] = useState(false);
	const [importing, setImporting] = useState(false);
	const [promptCopied, setPromptCopied] = useState(false);
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const copiedTimer = useRef<number | null>(null);
	const menuOpenRef = useRef(false);
	menuOpenRef.current = menuOpen;

	useEffect(() => {
		void EnglishAnnotateSource.hydrate();
	}, []);

	useEffect(
		() => () => {
			if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
			if (copiedTimer.current != null) window.clearTimeout(copiedTimer.current);
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
		// 已打开时勿反复 setState，避免 hover 抖动打爆渲染
		if (!menuOpenRef.current) setMenuOpen(true);
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
		setImportOpen(true);
	}, [running, t]);

	const copyPrompt = useCallback(() => {
		void copyToClipboard(ANNOTATION_IMPORT_PROMPT)
			.then(() => {
				setPromptCopied(true);
				if (copiedTimer.current != null)
					window.clearTimeout(copiedTimer.current);
				copiedTimer.current = window.setTimeout(() => {
					copiedTimer.current = null;
					setPromptCopied(false);
				}, 1000);
			})
			.catch(() => {
				Toast({
					type: 'error',
					title: t('englishLearning.annotateSource.importPromptCopyFailed'),
				});
			});
	}, [t]);

	const pickImportJsonFiles = useCallback(async (): Promise<File[] | null> => {
		try {
			const file = await pickEnglishLearningJsonFile();
			return file ? [file] : null;
		} catch (e) {
			if (e instanceof Error && e.message === 'accept') {
				Toast({
					type: 'warning',
					title: t('englishLearning.import.dropReject'),
				});
				return null;
			}
			throw e;
		}
	}, [t]);

	const importFile = useCallback(
		(file: File) => {
			if (importing) return;
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
					setImportOpen(false);
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
			<Model
				open={importOpen}
				onOpenChange={(next) => {
					if (!next && importing) return;
					setImportOpen(next);
				}}
				title={t('englishLearning.annotateSource.importTitle')}
				width="42rem"
				footer={null}
				contentClassName="overflow-visible"
			>
				<DragDropFileUpload
					className="group"
					zoneClassName="rounded-md border border-dashed border-theme/20 hover:border-teal-500"
					accept={JSON_IMPORT_ACCEPT}
					acceptExtensionOnly
					pickFiles={pickImportJsonFiles}
					maxCount={1}
					disabled={importing}
					ariaLabel={t('englishLearning.import.selectFile')}
					onFiles={(result) => {
						const file = result.accepted[0];
						if (file) importFile(file);
					}}
					onReject={(rejected) => {
						if (rejected.length > 0) {
							Toast({
								type: 'warning',
								title: t('englishLearning.import.dropReject'),
							});
						}
					}}
				>
					<div className="flex flex-col gap-3 py-4 text-sm">
						<div className="px-4 text-center text-base font-medium text-theme/70 group-hover:opacity-80">
							{t('englishLearning.import.dropReject')}
						</div>
						<div
							className="overflow-hidden"
							onClick={(event) => {
								const target = event.target as HTMLElement | null;
								// 滚条和正在选中的文字不打开文件框；卡片其余区域交给外层拖拽区
								if (target?.closest('[data-slot="scroll-area-scrollbar"]')) {
									event.stopPropagation();
									return;
								}
								const selected = window.getSelection();
								if (selected && !selected.isCollapsed && selected.toString()) {
									event.stopPropagation();
								}
							}}
						>
							<ScrollArea
								className="h-80"
								viewportTabIndex={-1}
								scrollbarClassName="pr-0 border-l-0"
							>
								<div className="flex flex-col gap-3 px-4">
									<div className="rounded-md border border-theme/5 bg-theme/5 p-3">
										<div className="mb-2 flex items-center justify-between gap-2">
											<div className="text-sm font-semibold text-textcolor/70">
												{t('englishLearning.annotateSource.importPromptTitle')}
											</div>
											<Button
												type="button"
												variant="link"
												className="h-auto shrink-0 gap-1 p-0! text-sm text-textcolor/70 hover:text-textcolor"
												onClick={(event) => {
													event.stopPropagation();
													copyPrompt();
												}}
											>
												{promptCopied ? (
													<CheckCircle size={13} />
												) : (
													<Copy size={13} />
												)}
												{promptCopied ? t('common.copied') : t('common.copy')}
											</Button>
										</div>
										<pre className="m-0 whitespace-pre-wrap text-left text-xs leading-snug text-textcolor/60 select-text">
											{ANNOTATION_IMPORT_PROMPT}
										</pre>
									</div>
								</div>
							</ScrollArea>
						</div>
					</div>
				</DragDropFileUpload>
			</Model>
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
			{/* modal=false：hover 菜单勿锁 body，反复开关否则易卡死 */}
			<DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
				<DropdownMenuTrigger asChild>
					{variant === 'text' ? textTrigger : iconTrigger}
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="center"
					sideOffset={6}
					scrollable={false}
					className="min-w-28"
					onCloseAutoFocus={(e) => e.preventDefault()}
					onMouseEnter={openMenu}
					onMouseLeave={scheduleCloseMenu}
					onClick={(e) => e.stopPropagation()}
				>
					<DropdownMenuItem
						className="flex w-full items-center justify-center text-center"
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
						className="flex w-full items-center justify-center text-center"
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
