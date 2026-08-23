import Confirm from '@design/Confirm';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import { Toast } from '@ui/index';
import { Settings2 } from 'lucide-react';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { hasValidAuthToken } from '@/router/authPaths';
import {
	clearElResumeModule,
	type ElResumeModuleKey,
	hydrateElResumeModuleSettings,
	isElResumeModuleEnabled,
	setElResumeModuleEnabled,
	subscribeElResumeSettings,
} from '@/views/englishLearning/utils/elResumeModule';

type EnglishSidebarResumeMenuProps = {
	moduleKey: ElResumeModuleKey;
	className?: string;
};

export function EnglishSidebarResumeMenu({
	moduleKey,
	className,
}: EnglishSidebarResumeMenuProps) {
	const { t } = useI18n();
	const [clearOpen, setClearOpen] = useState(false);
	const enabled = useSyncExternalStore(
		subscribeElResumeSettings,
		() => isElResumeModuleEnabled(moduleKey),
		() => isElResumeModuleEnabled(moduleKey),
	);

	useEffect(() => {
		void hydrateElResumeModuleSettings();
	}, []);

	const onToggleEnabled = useCallback(async () => {
		if (!hasValidAuthToken()) {
			Toast({
				type: 'error',
				title: t('englishLearning.resume.loginRequired'),
			});
			return;
		}
		try {
			await setElResumeModuleEnabled(moduleKey, !enabled);
			Toast({
				type: 'success',
				title: enabled
					? t('englishLearning.resume.disabledToast')
					: t('englishLearning.resume.enabledToast'),
			});
		} catch {
			Toast({
				type: 'error',
				title: t('englishLearning.resume.toggleFailed'),
			});
		}
	}, [enabled, moduleKey, t]);

	const onConfirmClear = useCallback(async () => {
		try {
			await clearElResumeModule(moduleKey);
			setClearOpen(false);
			Toast({
				type: 'success',
				title: t('englishLearning.resume.clearSuccess'),
			});
		} catch {
			Toast({
				type: 'error',
				title: t('englishLearning.resume.clearFailed'),
			});
		}
	}, [moduleKey, t]);

	return (
		<>
			<Confirm
				open={clearOpen}
				onOpenChange={setClearOpen}
				title={t('englishLearning.resume.clearConfirmTitle')}
				description={t('englishLearning.resume.clearConfirmDesc')}
				descriptionClassName="text-left"
				confirmText={t('englishLearning.resume.clearConfirmAction')}
				cancelText={t('common.cancel')}
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={() => void onConfirmClear()}
			/>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className={cn(
							'cursor-pointer border-0 bg-transparent p-0 shadow-none outline-none text-sm text-textcolor opacity-55 -mr-0.5 hover:text-teal-500 hover:opacity-100 focus-visible:ring-0 focus-visible:border-transparent data-[state=open]:border-0 data-[state=open]:shadow-none data-[state=open]:ring-0',
							className,
						)}
						aria-label={t('englishLearning.resume.settingsAria')}
					>
						<Settings2 className="size-4.5" aria-hidden />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					className="min-w-auto w-30"
					align="end"
					sideOffset={6}
					scrollable={false}
				>
					<DropdownMenuLabel className="text-textcolor px-[13px] py-1 text-sm font-medium opacity-60">
						{t('englishLearning.resume.settingsLabel')}
					</DropdownMenuLabel>
					<DropdownMenuSeparator className="mx-0" />
					<DropdownMenuItem
						className="flex items-center justify-center"
						onSelect={() => setClearOpen(true)}
					>
						{t('englishLearning.resume.clearAction')}
					</DropdownMenuItem>
					<DropdownMenuItem
						className="flex items-center justify-center"
						onSelect={() => void onToggleEnabled()}
					>
						{enabled
							? t('englishLearning.resume.disableAction')
							: t('englishLearning.resume.enableAction')}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	);
}
