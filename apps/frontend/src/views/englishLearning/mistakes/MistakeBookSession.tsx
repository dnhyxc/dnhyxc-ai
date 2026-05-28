import { ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';

/** 英语学习首页侧栏：错题集入口 */
export function MistakeBookSession() {
	const { t } = useI18n();
	const navigate = useNavigate();

	return (
		<div className="rounded-none @container min-w-0 mt-3.5 p-4 pb-0">
			<div className="mb-3.5 flex items-start gap-3">
				<div
					className={cn(
						'flex size-10 shrink-0 items-center justify-center rounded-md',
						'bg-linear-to-r from-rose-500 to-orange-500',
					)}
				>
					<ClipboardList className="size-6 text-white" aria-hidden />
				</div>
				<div className="min-w-0 flex-1 flex flex-col justify-between">
					<div className="text-textcolor font-semibold leading-tight">
						{t('route.englishLearning.mistakes.title')}
					</div>
					<div className="text-textcolor/50 mt-1 text-xs leading-snug">
						{t('englishLearning.mistakes.desc')}
					</div>
				</div>
			</div>
			<Button
				type="button"
				size="sm"
				className={cn(
					'mt-2 h-9 w-full gap-2 rounded-md px-3 text-white',
					'bg-linear-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-500',
				)}
				onClick={() => navigate('/english-learning/mistakes')}
			>
				{t('englishLearning.mistakes.nav')}
			</Button>
		</div>
	);
}
