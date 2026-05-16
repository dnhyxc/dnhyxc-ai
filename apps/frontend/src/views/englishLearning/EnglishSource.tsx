import { Layers, Layers2 } from 'lucide-react';
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

	return (
		<div className="rounded-none p-4 pb-0 @container min-w-0 mt-3.5">
			<div className="mb-5 flex items-start gap-3">
				<div
					className={cn(
						'flex size-10 shrink-0 items-center justify-center rounded-md',
						type === 'vocab'
							? 'bg-linear-to-r from-orange-500 to-yellow-500'
							: 'bg-linear-to-r from-lime-500 to-green-500',
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
			<div className="flex items-center gap-2">
				<Button
					type="button"
					size="sm"
					className={cn(
						'h-9 flex-4 min-w-0 gap-2 rounded-md px-3 text-white',
						type === 'vocab'
							? 'bg-linear-to-r from-orange-500 to-yellow-600 hover:bg-linear-to-r hover:from-orange-400 hover:to-yellow-600'
							: 'bg-linear-to-r from-lime-500 to-green-600 hover:bg-linear-to-r hover:from-lime-400 hover:to-green-600',
					)}
					onClick={() => {
						if (type === 'vocab') {
							navigate('/english-learning/import?kind=vocab');
						} else {
							navigate('/english-learning/import?kind=classic');
						}
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
						'h-9 flex-3 min-w-0 gap-2 rounded-md px-3 text-white',
						type === 'vocab'
							? 'bg-linear-to-r from-orange-500 to-yellow-600 hover:bg-linear-to-r hover:from-orange-400 hover:to-yellow-600'
							: 'bg-linear-to-r from-lime-500 to-green-600 hover:bg-linear-to-r hover:from-lime-400 hover:to-green-600',
					)}
					onClick={() => {
						if (type === 'vocab') {
							navigate('/english-learning/import?kind=vocab');
						} else {
							navigate('/english-learning/import?kind=classic');
						}
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
