/**
 * 通用导出菜单：hover 打开；多格式可并行，busy 落在对应项；
 * 触发图标有 loading 但不因导出禁用。业务侧只声明 items。
 * modal=false：hover 菜单勿锁 body，反复开关否则易卡死。
 */
import { Button } from '@ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import { FileDown } from 'lucide-react';
import {
	type MouseEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from 'react';
import { Spinner } from '@/components/ui';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';

export type ExportMenuItem = {
	/** 并行 busy 的稳定键 */
	id: string;
	label: ReactNode;
	/** 默认 true；false 时不渲染 */
	when?: boolean;
	disabled?: boolean;
	onSelect: () => void | Promise<void>;
};

export type ExportMenuProps = {
	items: ExportMenuItem[];
	disabled?: boolean;
	/** 无有效资源 id 等：禁用触发器 */
	triggerDisabled?: boolean;
	menuLabel?: string;
	onBeforeClick?: (e: MouseEvent<HTMLButtonElement>) => void;
	className?: string;
	contentClassName?: string;
};

export function ExportMenu({
	items,
	disabled,
	triggerDisabled,
	menuLabel: menuLabelProp,
	onBeforeClick,
	className,
	contentClassName,
}: ExportMenuProps) {
	const { t } = useI18n();
	const menuLabel = menuLabelProp ?? t('englishLearning.export.menu');
	const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());
	const [menuOpen, setMenuOpen] = useState(false);
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const menuOpenRef = useRef(false);
	menuOpenRef.current = menuOpen;
	const busyRef = useRef(busyIds);
	busyRef.current = busyIds;

	const visible = items.filter((it) => it.when !== false);
	const anyBusy = busyIds.size > 0;

	useEffect(
		() => () => {
			if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
		},
		[],
	);

	const openMenu = () => {
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
		// 已打开时勿反复 setState，避免 hover 抖动打爆渲染
		if (!menuOpenRef.current) setMenuOpen(true);
	};

	const scheduleCloseMenu = () => {
		if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
		closeTimerRef.current = setTimeout(() => setMenuOpen(false), 160);
	};

	const setBusy = (id: string, on: boolean) => {
		setBusyIds((prev) => {
			const next = new Set(prev);
			if (on) next.add(id);
			else next.delete(id);
			return next;
		});
	};

	const runItem = (item: ExportMenuItem) => {
		if (item.disabled || busyRef.current.has(item.id)) return;
		setBusy(item.id, true);
		void Promise.resolve()
			.then(() => item.onSelect())
			.finally(() => setBusy(item.id, false));
	};

	return (
		<DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={disabled || triggerDisabled}
					aria-label={menuLabel}
					aria-busy={anyBusy}
					title={menuLabel}
					className={cn(
						'h-7 w-7 shrink-0 rounded-md p-0 transition-colors',
						'text-textcolor/65 hover:border hover:border-teal-500/15 hover:bg-teal-500/10 hover:text-teal-500',
						className,
					)}
					onClick={(e) => {
						onBeforeClick?.(e);
						e.stopPropagation();
						openMenu();
					}}
					onMouseEnter={openMenu}
					onMouseLeave={scheduleCloseMenu}
				>
					{anyBusy ? (
						<Spinner className="size-3.5 text-textcolor" aria-hidden />
					) : (
						<FileDown className="size-3.5" aria-hidden />
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="center"
				sideOffset={6}
				scrollable={false}
				className={cn('min-w-34', contentClassName)}
				onCloseAutoFocus={(e) => e.preventDefault()}
				onMouseEnter={openMenu}
				onMouseLeave={scheduleCloseMenu}
				onClick={(e) => e.stopPropagation()}
			>
				{visible.map((item) => {
					const busy = busyIds.has(item.id);
					return (
						<DropdownMenuItem
							key={item.id}
							className="flex w-full items-center justify-center gap-1.5 text-center"
							disabled={item.disabled || busy}
							onSelect={(e) => {
								e.preventDefault();
								setMenuOpen(false);
								runItem(item);
							}}
						>
							{busy ? (
								<Spinner
									className="size-3.5 shrink-0 text-textcolor"
									aria-hidden
								/>
							) : null}
							{item.label}
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
