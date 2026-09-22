/**
 * 单词练习模块 — 类型定义
 */

import type { HTMLAttributes, ReactNode } from 'react';
import type { EnglishClassicQuoteItem, EnglishVocabularyItem } from '@/service';

// —— 领域模型 ——

export type PracticeContentKind = 'vocab' | 'classic';

export type PracticeMode = 'dictation' | 'spelling';

export type PracticeSource =
	| 'favorites'
	| 'library'
	| 'pack'
	| 'live'
	| 'mistakes'
	| 'dailyMemorize'
	| 'review';

export type PracticeOrder = 'random' | 'sequential';

/** 报告保存方式：手动点按钮 / 进入结算自动写 */
export type PracticeReportSaveMode = 'manual' | 'auto';

export type PracticeVocabItem = EnglishVocabularyItem & {
	contentKind: 'vocab';
	/** 去重键，与收藏 wordKey 一致 */
	key: string;
	/** 当前用户已收藏时返回收藏 id，否则 null */
	favoriteId?: string | null;
};

export type PracticeClassicItem = EnglishClassicQuoteItem & {
	contentKind: 'classic';
	/** 去重键，与经典句收藏 contentKey 一致 */
	key: string;
	/** 当前用户已收藏时返回收藏 id，否则 null */
	favoriteId?: string | null;
};

export type PracticeItem = PracticeVocabItem | PracticeClassicItem;

export type PracticeCountOption =
	| 10
	| 20
	| 30
	| 40
	| 50
	| 60
	| 70
	| 80
	| 90
	| 100;

/** 分页拉词进度：顺序模式记下一页；随机模式记录已用过的页码 */
export type PracticeSessionCursor = {
	nextSequentialPageIndex: number;
	usedRandomPageIndices: number[];
};

export type PracticeSessionFetchResult = {
	items: PracticeItem[];
	cursor: PracticeSessionCursor;
};

export type PracticeSetupConfig = {
	contentKind: PracticeContentKind;
	mode: PracticeMode;
	source: PracticeSource;
	order: PracticeOrder;
	count: PracticeCountOption;
	libraryId?: string;
	streamId?: string;
	/** 词表总量（URL 或会话内传递，用于分页） */
	poolTotal?: number;
	/** 与 Setup 顶栏一致的来源标题（词库名 / 收藏等） */
	sourceTitle?: string;
	/** 报告保存方式；缺省按 manual */
	reportSaveMode?: PracticeReportSaveMode;
	/** 本场是否由「重练错题」进入 */
	isRetryWrong?: boolean;
};

export type PracticeAttemptResult = {
	item: PracticeItem;
	userInput: string;
	correct: boolean;
};

export type PracticePhase = 'setup' | 'running' | 'summary';

// —— 路由 / 链接 ——

export type BuildEnglishPracticeSearchParamsInput = {
	contentKind?: PracticeContentKind;
	source: PracticeSource;
	mode?: PracticeMode;
	libraryId?: string;
	streamId?: string;
	/** 词表来源展示名（词库 title、拉取主题、收藏等） */
	sourceTitle?: string;
	/** 词表总量，用于分页拉词（刷新后避免重复探测接口） */
	poolTotal?: number;
	/** 练习结束后返回的结果页 streamId（与 streamId 词表来源可不同，如历史抽屉） */
	returnStreamId?: string;
	/** 固定返回路径：home → /english-learning */
	returnTo?: 'home';
};

// —— 词表拉取 ——

export type PracticePaginatedPage = { items: PracticeItem[] };

export type PracticeFetchContext = {
	contentKind: PracticeContentKind;
	source: PracticeSource;
	libraryId?: string;
	streamId?: string;
};

export type PracticeSessionParams = {
	contentKind: PracticeContentKind;
	source: PracticeSource;
	count: number;
	order: PracticeOrder;
	libraryId?: string;
	streamId?: string;
	poolTotal?: number;
	cursor?: PracticeSessionCursor | null;
	excludeKeys?: readonly string[];
};

// —— 来源标题解析 ——

export type ResolvePracticeSourceTitleParams = {
	contentKind: PracticeContentKind;
	source: PracticeSource;
	libraryId?: string;
	streamId?: string;
	/** URL 带入的标题，优先于接口请求 */
	sourceTitleFromUrl?: string;
	t: (key: string) => string;
};

// —— 页面壳 / 通用 UI ——

export type PracticePageShellProps = {
	title?: ReactNode;
	subtitle?: ReactNode;
	onBack?: () => void;
	backLabel?: string;
	headerRight?: ReactNode;
	children: ReactNode;
	/** fill：内容顶对齐并占满剩余高度（结算页错题列表等） */
	contentLayout?: 'center' | 'fill';
	/** 作答页：隐藏壳顶栏、内容无内边距，由 Session 铺满白色区域 */
	flush?: boolean;
};

export type PracticeShortcutsMenuProps = {
	/** 进行中练习模式；未传时展示完整说明（含听写 ←） */
	practiceMode?: PracticeMode;
	/** 经典词槽：展示词性/音标快捷键 */
	slotBoard?: boolean;
};

export type PracticeSegmentOption<T extends string> = {
	value: T;
	label: ReactNode;
};

export type PracticeSegmentedProps<T extends string> = {
	value: T;
	options: PracticeSegmentOption<T>[];
	onChange: (value: T) => void;
	className?: string;
};

export type PracticeCardProps = {
	children: ReactNode;
	className?: string;
} & HTMLAttributes<HTMLDivElement>;

// —— 各阶段页面 ——

export type SetupProps = {
	initialContentKind: PracticeContentKind;
	initialSource: PracticeSource;
	initialMode: PracticeMode;
	initialLibraryId?: string;
	initialStreamId?: string;
	initialSourceTitle?: string;
	initialPoolTotal?: number;
	headerExtra?: ReactNode;
	onStarted: (
		queue: PracticeItem[],
		config: PracticeSetupConfig,
		cursor: PracticeSessionCursor,
	) => void;
};

export type SessionProps = {
	mode: PracticeMode;
	item: PracticeItem;
	/** 与 Setup 顶栏一致的来源标题 */
	sourceTitle?: string;
	/** 当前题为本轮最后一题（答错揭示后按钮文案为「查看练习结果」） */
	isLastQuestion?: boolean;
	/** 是否可回到上一题（非本轮第一题） */
	canGoPrevious?: boolean;
	/** 从错题态切回上一题（由父级递减 index 并截断 results） */
	onGoPrevious?: () => void;
	onStepComplete: (result: PracticeAttemptResult) => void;
	/** 铺满页壳时的进度文案，如「第 1 / 20 题」 */
	progressLabel?: string;
	headerExtra?: ReactNode;
};

export type SummaryProps = {
	results: PracticeAttemptResult[];
	/** 本会话累计已练词数（含继续练习、重练错题） */
	practicedTotal: number;
	config: PracticeSetupConfig;
	continueLoading?: boolean;
	onRetryWrong: (queue: PracticeAttemptResult['item'][]) => void;
	onContinuePractice: () => void;
	onBackToSetup: () => void;
};

// —— 结算页子组件 ——

export type SummaryMetricTone =
	| 'accent'
	| 'correct'
	| 'wrong'
	| 'total'
	| 'practiced';

export type SummaryMetricProps = {
	label: string;
	value: string | number;
	tone: SummaryMetricTone;
	compact?: boolean;
};

export type SummaryWordListVariant = 'wrong' | 'correct';

export type WrongListItemProps = {
	item: PracticeItem;
	playing: boolean;
	onTogglePlay: () => void;
	playLabel: string;
	stopLabel: string;
	/** 错题红左边框；正确绿左边框 */
	variant?: SummaryWordListVariant;
	/** 作答明细：用户当次输入（有内容才展示） */
	userInput?: string;
};

export type SummaryActionsProps = {
	hasWrongItems: boolean;
	continueLoading: boolean;
	saveMistakesLoading?: boolean;
	mistakesPath?: string;
	/** 保存报告：idle 可点；saving 转圈；saved 禁用示已保存；hidden 不展示按钮 */
	reportSaveState?: 'idle' | 'saving' | 'saved' | 'hidden';
	labels: {
		retryWrong: string;
		practiceAgain: string;
		continuePractice: string;
		openMistakes: string;
		saveMistakes: string;
		saveReport: string;
		reportSaved: string;
		viewReports: string;
	};
	onRetryWrong: () => void;
	onBackToSetup: () => void;
	onContinuePractice: () => void;
	onSaveMistakes?: () => void;
	onSaveReport?: () => void;
	onViewReports?: () => void;
};

// —— 单题 Session 子组件 ——

export type PracticeItemPhase =
	| 'prompt'
	| 'soft_wrong'
	| 'revealed'
	/** 经典句看中写：全对后的中间展示态（自动展开词性/音标/释义） */
	| 'correct_reveal';

export type DictationStepProgressProps = {
	stepListen: string;
	stepSpell: string;
	playing: boolean;
	spellStepActive: boolean;
};

export type PracticeHintFields = {
	ipa?: string | null;
	translationZh?: string | null;
	source?: string | null;
	noteZh?: string | null;
};

export type DictationPromptBodyProps = {
	hint: string;
	hintOpen: boolean;
	hintContent: PracticeHintFields;
	playing: boolean;
	playLabel: string;
	onPlay: () => void;
	stepListen: string;
	stepSpell: string;
	spellStepActive: boolean;
};

export type SessionPromptPanelProps = {
	children: ReactNode;
	className?: string;
	fillHeight?: boolean;
};

export type SpellingPromptBodyProps = {
	promptLabel: string;
	translationZh: string;
	pos?: string;
	hintOpen: boolean;
	hintContent: PracticeHintFields;
	playing: boolean;
	playLabel: string;
	onPlay: () => void;
};

export type RevealedPanelInnerProps = {
	answerLabel: string;
	wrongInput: string;
	item: PracticeItem;
	correctAnswerLabel: string;
	playing: boolean;
	playLabel: string;
	onPlay: () => void;
};
