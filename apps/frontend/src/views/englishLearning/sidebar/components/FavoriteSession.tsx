import { Layers } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	ENGLISH_SIDEBAR_BTN_GRADIENT,
	ENGLISH_SIDEBAR_ICON_GRADIENT,
} from '../sidebarAccents';

/** 首页侧栏：我的收藏 */
export function FavoriteSession() {
	const { t } = useI18n();
	const navigate = useNavigate();

	return (
		<div className="rounded-none pt-4 @container min-w-0 mt-3.5">
			<div className="mb-3.5 flex items-start gap-3">
				<div
					className={cn(
						'flex size-10 shrink-0 items-center justify-center rounded-md',
						ENGLISH_SIDEBAR_ICON_GRADIENT.favorites,
					)}
				>
					<Layers className="text-white size-6" aria-hidden />
				</div>
				<div className="min-w-0 flex-1 flex flex-col justify-between">
					<div className="text-textcolor font-semibold leading-tight">
						{t('route.englishLearning.favorites.title')}
					</div>
					<div className="h-5 flex items-center justify-between gap-2 text-textcolor/50 mt-1 text-xs leading-snug">
						{t('englishLearning.favorites.desc')}
					</div>
				</div>
			</div>
			<div className="flex flex-wrap items-center gap-3.5 mt-4.5">
				<Button
					type="button"
					size="sm"
					className={cn(
						'h-9 min-w-0 flex-1 gap-2 rounded-md px-3 text-white',
						ENGLISH_SIDEBAR_BTN_GRADIENT.favorites,
					)}
					onClick={() => navigate('/english-learning/favorites?kind=vocab')}
				>
					{t('englishLearning.favorites.vocab.nav')}
				</Button>
				<Button
					type="button"
					size="sm"
					className={cn(
						'h-9 min-w-0 flex-1 gap-2 rounded-md px-3 text-white',
						ENGLISH_SIDEBAR_BTN_GRADIENT.favorites,
					)}
					onClick={() => navigate('/english-learning/favorites?kind=classic')}
				>
					{t('englishLearning.favorites.classic.nav')}
				</Button>
			</div>
		</div>
	);
}
