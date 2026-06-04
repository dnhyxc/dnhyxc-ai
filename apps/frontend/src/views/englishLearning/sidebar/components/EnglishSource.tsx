import { ScrollArea } from '@ui/scroll-area';
import { Layers, Layers2 } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	ENGLISH_SIDEBAR_BTN_GRADIENT,
	ENGLISH_SIDEBAR_ICON_GRADIENT,
} from '../sidebarAccents';

const SOURCE_LINK_GRADIENT = {
	vocab:
		'bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 bg-clip-text text-transparent',
	classic:
		'bg-linear-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 bg-clip-text text-transparent',
} as const;

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
	const btnGradient = isVocab
		? ENGLISH_SIDEBAR_BTN_GRADIENT.vocabSource
		: ENGLISH_SIDEBAR_BTN_GRADIENT.classicSource;

	return (
		<div
			className={cn(
				'rounded-none p-4 pb-0 @container min-w-0',
				isVocab ? 'mt-0' : 'mt-3.5',
			)}
		>
			<div className="mb-3.5 flex items-start gap-3">
				<div
					className={cn(
						'flex size-10 shrink-0 items-center justify-center rounded-md',
						iconGradient,
					)}
				>
					{isVocab ? (
						<Layers className="text-white size-6" aria-hidden />
					) : (
						<Layers2 className="text-white size-6" aria-hidden />
					)}
				</div>
				<div className="min-w-0 flex-1 flex flex-col justify-between">
					<div className="text-textcolor font-semibold leading-tight">
						{title}
					</div>
					<div className="h-5 flex items-center justify-between gap-2 text-textcolor/50 mt-1 text-xs leading-snug">
						{description}
						<button
							type="button"
							className={cn(
								'shrink-0 cursor-pointer',
								SOURCE_LINK_GRADIENT[type],
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
				</div>
			</div>
			<div>
				<label
					htmlFor={isVocab ? 'english-vocab-topic' : 'english-classic-topic'}
					className="text-textcolor/45 mb-2 block text-sm font-medium"
				>
					{isVocab
						? t('englishLearning.import.dataExample')
						: t('englishLearning.import.dataExampleClassic')}
				</label>
				<ScrollArea
					scrollbars="both"
					className={cn(
						'px-2 py-[9px] bg-theme/5 border mb-5 max-h-50 w-full min-w-0 rounded-md',
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
			</div>
			<div className="flex flex-wrap items-center gap-3.5">
				<Button
					type="button"
					size="sm"
					className={cn(
						'h-9 min-w-0 flex-1 gap-2 rounded-md px-3 text-white',
						btnGradient,
					)}
					onClick={() => navigate(`/english-learning/import?kind=${type}`)}
				>
					{isVocab
						? t('englishLearning.vocab.import')
						: t('englishLearning.classic.import')}
				</Button>
				<Button
					type="button"
					size="sm"
					className={cn(
						'h-9 min-w-0 flex-1 gap-2 rounded-md px-3 text-white',
						btnGradient,
					)}
					onClick={() => navigate(`/english-learning/library?kind=${type}`)}
				>
					{isVocab
						? t('englishLearning.library.vocab.bank')
						: t('englishLearning.library.classic.bank')}
				</Button>
			</div>
		</div>
	);
}
