import { ScrollArea } from '@ui/scroll-area';
import {
	CircleChevronDown,
	CircleChevronRight,
	Layers,
	Layers2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	ENGLISH_SIDEBAR_ICON_GRADIENT,
	ENGLISH_SIDEBAR_TEXT_LINK_GRADIENT,
} from '../sidebarAccents';
import { SIDEBAR_LABEL } from '../tokens';
import { EnglishSidebarActions } from './EnglishSidebarActions';
import { EnglishSidebarHeader } from './EnglishSidebarHeader';
import { SidebarPanel } from './SidebarPanel';

const SOURCE_EXAMPLE_PANEL = {
	vocab: 'bg-linear-to-r from-cyan-500/8 to-blue-600/8 border-blue-500/10',
	classic:
		'bg-linear-to-r from-indigo-500/8 to-blue-600/8 border-indigo-500/10',
} as const;

export type EnglishSourceProps = {
	title?: string;
	description?: string;
	type: 'vocab' | 'classic';
};

/** 首页侧栏：词库 / 语句库（导入 + 资源库入口） */
export function EnglishSource({
	title,
	description,
	type,
}: EnglishSourceProps) {
	const { t } = useI18n();
	const navigate = useNavigate();
	const isVocab = type === 'vocab';

	const exampleJson = useMemo(() => {
		return isVocab
			? [
					{
						word: 'hello',
						ipa: '/həˈləʊ/',
						pos: 'n.',
						translationZh: '你好，世界',
						example: 'Hello, world',
					},
				]
			: [
					{
						english:
							'Education is not the filling of a pail, but the lighting of a fire.',
						translationZh: '教育不是注满一桶水，而是点燃一把火。',
						source: 'William Butler Yeats',
						noteZh: '经典比喻，阐明教育的本质是激发热情。',
					},
				];
	}, [isVocab]);

	const iconGradient = isVocab
		? ENGLISH_SIDEBAR_ICON_GRADIENT.vocabSource
		: ENGLISH_SIDEBAR_ICON_GRADIENT.classicSource;
	const gradientKey = isVocab ? 'vocabSource' : 'classicSource';
	const Icon = isVocab ? Layers : Layers2;
	const exampleLabelExpanded = isVocab
		? t('englishLearning.import.dataExampleCollapse')
		: t('englishLearning.import.dataExampleClassicCollapse');
	const exampleLabelCollapsed = isVocab
		? t('englishLearning.import.dataExample')
		: t('englishLearning.import.dataExampleClassic');
	const [exampleExpanded, setExampleExpanded] = useState(false);
	const exampleLabel = exampleExpanded
		? exampleLabelExpanded
		: exampleLabelCollapsed;

	return (
		<SidebarPanel className="@container min-w-0">
			<EnglishSidebarHeader
				icon={Icon}
				iconGradient={iconGradient}
				title={title ?? ''}
				description={description}
			/>
			<div>
				<div
					className={cn(
						'flex items-center justify-between gap-2',
						exampleExpanded ? 'mb-2' : 'mb-2',
					)}
				>
					<button
						type="button"
						className={cn(
							SIDEBAR_LABEL,
							'inline-flex min-w-0 cursor-pointer items-center gap-1.5 text-left transition-colors hover:text-textcolor/65',
						)}
						aria-expanded={exampleExpanded}
						aria-label={exampleLabel}
						onClick={() => setExampleExpanded((v) => !v)}
					>
						{exampleExpanded ? (
							<CircleChevronDown
								className="size-4 shrink-0 transition-transform duration-200"
								aria-hidden
							/>
						) : (
							<CircleChevronRight
								className="size-4 shrink-0 transition-transform duration-200"
								aria-hidden
							/>
						)}
						<span className="min-w-0 truncate">{exampleLabel}</span>
					</button>
					<button
						type="button"
						className={cn(
							'shrink-0 cursor-pointer text-sm leading-snug',
							ENGLISH_SIDEBAR_TEXT_LINK_GRADIENT[type],
						)}
						onClick={() =>
							navigate(
								isVocab
									? '/english-learning/reference/morphology'
									: '/english-learning/reference/grammar',
							)
						}
					>
						{isVocab
							? t('englishLearning.source.morphologyLink')
							: t('englishLearning.source.grammarLink')}
					</button>
				</div>
				{exampleExpanded ? (
					<ScrollArea
						scrollbars="both"
						className={cn(
							'p-1 bg-theme/5 border mb-3 max-h-50 w-full min-w-0 rounded-md',
							SOURCE_EXAMPLE_PANEL[type],
						)}
						viewportClassName="[&>div]:!block [&>div]:w-max"
					>
						<pre
							className={cn('m-0 w-max text-xs leading-relaxed whitespace-pre')}
						>
							{JSON.stringify(exampleJson, null, 2)}
						</pre>
					</ScrollArea>
				) : null}
			</div>
			<EnglishSidebarActions
				className="mt-0"
				actions={[
					{
						label: isVocab
							? t('englishLearning.vocab.import')
							: t('englishLearning.classic.import'),
						onClick: () => navigate(`/english-learning/import?kind=${type}`),
						gradientKey,
					},
					{
						label: isVocab
							? t('englishLearning.library.vocab.bank')
							: t('englishLearning.library.classic.bank'),
						onClick: () => navigate(`/english-learning/library?kind=${type}`),
						gradientKey,
					},
				]}
			/>
		</SidebarPanel>
	);
}
