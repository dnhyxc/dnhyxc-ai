import { ScrollArea } from '@ui/scroll-area';
import { Layers, Layers2 } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';

interface EnglishSourceProps {
	title?: string;
	description?: string;
	type?: 'vocab' | 'classic';
}

const EnglishSource = ({ title, description, type }: EnglishSourceProps) => {
	const { t } = useI18n();

	const navigate = useNavigate();

	const vocabExample = useMemo(() => {
		return type === 'vocab'
			? [
					{
						word: 'hello',
						ipa: '/həˈləʊ/',
						pos: 'n.',
						translationZh: '你好',
						example: 'Hello, how are you?',
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
	}, [type]);

	return (
		<div
			className={cn(
				'rounded-none p-4 pb-0 @container min-w-0',
				type === 'vocab' ? 'mt-0' : 'mt-3.5',
			)}
		>
			<div className="mb-3.5 flex items-start gap-3">
				<div
					className={cn(
						'flex size-10 shrink-0 items-center justify-center rounded-md',
						type === 'vocab'
							? 'bg-linear-to-r from-cyan-500 to-blue-600'
							: 'bg-linear-to-r from-indigo-500 to-blue-600',
					)}
				>
					{type === 'vocab' ? (
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
					</div>
				</div>
			</div>
			<div className="">
				<label
					htmlFor="english-vocab-topic"
					className="text-textcolor/45 mb-2 block text-sm font-medium"
				>
					{type === 'vocab'
						? t('englishLearning.import.dataExample')
						: t('englishLearning.import.dataExampleClassic')}
				</label>
				<ScrollArea
					scrollbars="both"
					className="bg-theme/5 border border-theme/10 mb-5 max-h-50 w-full min-w-0 rounded-md"
					viewportClassName="[&>div]:!block [&>div]:w-max"
				>
					<pre className="m-0 w-max px-2 py-2.5 text-xs leading-relaxed whitespace-pre">
						{JSON.stringify(vocabExample, null, 2)}
					</pre>
				</ScrollArea>
			</div>
			<div className="flex flex-wrap items-center gap-3.5">
				<Button
					type="button"
					size="sm"
					className={cn(
						'h-9 min-w-0 flex-1 gap-2 rounded-md px-3 text-white',
						type === 'vocab'
							? 'bg-linear-to-r from-cyan-500 to-blue-600 hover:bg-linear-to-r hover:from-cyan-400 hover:to-blue-600'
							: 'bg-linear-to-r from-indigo-500 to-blue-600 hover:bg-linear-to-r hover:from-indigo-400 hover:to-blue-600',
					)}
					onClick={() => {
						navigate(`/english-learning/import?kind=${type}`);
					}}
				>
					{type === 'vocab'
						? t('englishLearning.vocab.import')
						: t('englishLearning.classic.import')}
				</Button>
				<Button
					type="button"
					size="sm"
					className={cn(
						'h-9 min-w-0 flex-1 gap-2 rounded-md px-3 text-white',
						type === 'vocab'
							? 'bg-linear-to-r from-cyan-500 to-blue-600 hover:bg-linear-to-r hover:from-cyan-400 hover:to-blue-600'
							: 'bg-linear-to-r from-indigo-500 to-blue-600 hover:bg-linear-to-r hover:from-indigo-400 hover:to-blue-600',
					)}
					onClick={() => {
						navigate(`/english-learning/library?kind=${type}`);
					}}
				>
					{type === 'vocab'
						? t('englishLearning.library.vocab.bank')
						: t('englishLearning.library.classic.bank')}
				</Button>
			</div>
		</div>
	);
};

export default EnglishSource;
