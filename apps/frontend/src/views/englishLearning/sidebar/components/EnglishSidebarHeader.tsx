import { type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { ElResumeModuleKey } from '@/views/englishLearning/utils/elResumeModule';
import {
	SIDEBAR_DESC,
	SIDEBAR_HEADER_ROW,
	SIDEBAR_ICON_BOX,
	SIDEBAR_TITLE,
} from '../tokens';
import { EnglishSidebarResumeMenu } from './EnglishSidebarResumeMenu';

type EnglishSidebarHeaderProps = {
	icon: LucideIcon;
	iconGradient: string;
	title: string;
	description?: ReactNode;
	className?: string;
	resumeModuleKey?: ElResumeModuleKey;
};

export function EnglishSidebarHeader({
	icon: Icon,
	iconGradient,
	title,
	description,
	className,
	resumeModuleKey,
}: EnglishSidebarHeaderProps) {
	return (
		<div className={cn(SIDEBAR_HEADER_ROW, className)}>
			<div className={cn(SIDEBAR_ICON_BOX, iconGradient)}>
				<Icon className="size-6 text-white" aria-hidden />
			</div>
			<div className="min-w-0 flex-1 flex flex-col justify-between">
				<div
					className={cn(
						SIDEBAR_TITLE,
						'flex items-center justify-between gap-2 min-w-0',
					)}
				>
					<span className="truncate">{title}</span>
					{resumeModuleKey ? (
						<EnglishSidebarResumeMenu moduleKey={resumeModuleKey} />
					) : null}
				</div>
				{description != null ? (
					<div className={cn(SIDEBAR_DESC, 'flex h-5 items-center gap-2')}>
						{description}
					</div>
				) : null}
			</div>
		</div>
	);
}
