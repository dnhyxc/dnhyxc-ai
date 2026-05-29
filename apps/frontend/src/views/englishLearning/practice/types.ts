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
	| 'mistakes';

export type PracticeOrder = 'random' | 'sequential';

export type PracticeVocabItem = EnglishVocabularyItem & {
	contentKind: 'vocab';
	/** 去重键，与收藏 wordKey 一致 */
	key: string;
};

export type PracticeClassicItem = EnglishClassicQuoteItem & {
	contentKind: 'classic';
	/** 去重键，与经典句收藏 contentKey 一致 */
	key: string;
};

export type PracticeItem = PracticeVocabItem | PracticeClassicItem;

export type PracticeCountOption = 10 | 20 | 30 | 40 | 50;

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
	title: string;
	subtitle?: string;
	onBack?: () => void;
	backLabel?: string;
	headerRight?: ReactNode;
	children: ReactNode;
	/** fill：内容顶对齐并占满剩余高度（结算页错题列表等） */
	contentLayout?: 'center' | 'fill';
};

export type PracticeSegmentOption<T extends string> = {
	value: T;
	label: string;
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
	onStarted: (
		queue: PracticeItem[],
		config: PracticeSetupConfig,
		cursor: PracticeSessionCursor,
	) => void;
};

export type SessionProps = {
	mode: PracticeMode;
	item: PracticeItem;
	/** 当前题为本轮最后一题（答错揭示后按钮文案为「查看练习结果」） */
	isLastQuestion?: boolean;
	onStepComplete: (result: PracticeAttemptResult) => void;
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
};

export type SummaryActionsProps = {
	hasWrongItems: boolean;
	continueLoading: boolean;
	saveMistakesLoading?: boolean;
	mistakesPath?: string;
	labels: {
		retryWrong: string;
		practiceAgain: string;
		continuePractice: string;
		openMistakes: string;
		saveMistakes: string;
	};
	onRetryWrong: () => void;
	onBackToSetup: () => void;
	onContinuePractice: () => void;
	onSaveMistakes?: () => void;
};

// —— 单题 Session 子组件 ——

export type PracticeItemPhase = 'prompt' | 'revealed';

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

export type SessionStageHeaderProps = {
	icon: ReactNode;
	title: string;
	trailing?: ReactNode;
};

export type SessionPromptPanelProps = {
	children: ReactNode;
	className?: string;
	scrollable?: boolean;
	fillHeight?: boolean;
};

export type SpellingPromptBodyProps = {
	promptLabel: string;
	translationZh: string;
	pos?: string;
	hintOpen: boolean;
	hintContent: PracticeHintFields;
};

export type VocabWordPlayButtonProps = {
	playing: boolean;
	playAriaLabel: string;
	stopAriaLabel: string;
	onPlay: () => void;
};

export type WordAnswerDetailProps = {
	item: PracticeVocabItem;
	correctAnswerLabel: string;
	showDivider?: boolean;
	wordRowTrailing?: ReactNode;
};

export type SentenceAnswerDetailProps = {
	item: PracticeClassicItem;
	correctAnswerLabel: string;
	showDivider?: boolean;
	sentenceRowTrailing?: ReactNode;
};

export type RevealedPanelInnerProps = {
	yourAnswerPrefix: string;
	wrongInput: string;
	item: PracticeItem;
	correctAnswerLabel: string;
	playButton: ReactNode;
};
