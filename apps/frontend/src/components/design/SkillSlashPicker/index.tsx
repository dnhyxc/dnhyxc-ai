/**
 * `/` 唤起的 Skill 多选浮层：过滤词来自消息框 `/` 后内容，不抢焦点（对齐 Cursor）。
 */
import { Button, Checkbox, ScrollArea } from '@ui/index';
import { Plus } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type RefObject,
	useEffect,
	useLayoutEffect,
	useMemo,
	useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import skillStore from '@/store/skill';

export type SkillSlashPickerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** `/` 后已输入的过滤词（由消息框驱动） */
	query?: string;
	onConfirm: (ids: string[]) => void;
	/** 锚定输入框容器，用于 fixed 定位 */
	anchorRef?: RefObject<HTMLElement | null>;
	className?: string;
};

const SkillSlashPicker = observer(function SkillSlashPicker({
	open,
	onOpenChange,
	query = '',
	onConfirm,
	anchorRef,
	className,
}: SkillSlashPickerProps) {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [draftIds, setDraftIds] = useState<string[]>([]);
	const [pos, setPos] = useState<{
		bottom: number;
		left: number;
		width: number;
		listHeight: number;
	}>({ bottom: 0, left: 0, width: 288, listHeight: 224 });

	useLayoutEffect(() => {
		if (!open) return;
		const update = () => {
			const el = anchorRef?.current;
			if (!el) return;
			const r = el.getBoundingClientRect();
			const bottom = Math.max(8, window.innerHeight - r.top + 8);
			// 浮层向上展开：hint≈28 + footer≈48 + padding，剩余给列表
			const panelMax = Math.max(160, window.innerHeight - bottom - 12);
			const listHeight = Math.min(224, Math.max(96, panelMax - 84));
			setPos({
				bottom,
				left: r.left,
				width: Math.min(320, Math.max(240, r.width)),
				listHeight,
			});
		};
		update();
		window.addEventListener('resize', update);
		window.addEventListener('scroll', update, true);
		return () => {
			window.removeEventListener('resize', update);
			window.removeEventListener('scroll', update, true);
		};
	}, [open, anchorRef]);

	const selectedKey = skillStore.selectedSkillIds.join('\0');

	useEffect(() => {
		if (!open) return;
		setDraftIds([...skillStore.selectedSkillIds]);
		if (skillStore.list.length === 0) void skillStore.loadList();
	}, [open, selectedKey]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				onOpenChange(false);
			}
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, [open, onOpenChange]);

	const filterQ = query.trim().toLowerCase();
	const filtered = useMemo(() => {
		if (!filterQ) return skillStore.list;
		return skillStore.list.filter((s) =>
			s.title.toLowerCase().includes(filterQ),
		);
	}, [filterQ, skillStore.list]);

	const toggle = (id: string) => {
		setDraftIds((prev) => {
			if (prev.includes(id)) return prev.filter((x) => x !== id);
			if (prev.length >= 8) return prev;
			return [...prev, id];
		});
	};

	/** 点行（非 checkbox）：确保选中该项后确认并关闭，等同点「确认」 */
	const pickAndConfirm = (id: string) => {
		const next = draftIds.includes(id)
			? draftIds
			: draftIds.length < 8
				? [...draftIds, id]
				: [...draftIds.slice(0, 7), id];
		onConfirm(next);
		onOpenChange(false);
	};

	const goCreateSkill = () => {
		onOpenChange(false);
		skillStore.createNew();
		navigate('/skills');
	};

	if (!open || typeof document === 'undefined') return null;

	return createPortal(
		<div
			className={cn(
				// 四向均匀阴影（无偏置），避免向上展开时顶/底不一致
				'z-100 flex flex-col overflow-hidden rounded-md border border-theme/10 bg-theme-background shadow-[0_0_16px_rgba(15,23,42,0.14)]',
				className,
			)}
			style={{
				position: 'fixed',
				bottom: pos.bottom,
				left: pos.left,
				width: pos.width,
			}}
			role="dialog"
			aria-label={t('skill.slash.placeholder')}
			aria-modal={false}
			// 保消息框焦点；滚动条拖动除外
			onMouseDown={(e) => {
				const t = e.target as HTMLElement | null;
				if (t?.closest?.('[data-slot="scroll-area-scrollbar"]')) return;
				e.preventDefault();
			}}
		>
			<div className="flex items-center gap-3 px-2 py-3 mb-1 border-b border-theme/10">
				<div className="text-sm text-textcolor">{t('route.skills.title')}</div>
				{filterQ ? (
					<div className="shrink-0 truncate text-xs text-textcolor/55">
						{t('skill.slash.filtering', { q: query.trim() })}
					</div>
				) : (
					<div className="shrink-0 text-xs text-textcolor/55">
						{t('skill.slash.hint')}
					</div>
				)}
			</div>
			{/* 显式 height：Radix ScrollArea 仅 max-h 时视口常无法形成滚动 */}
			<ScrollArea
				className="w-full"
				style={{ height: pos.listHeight }}
				scrollbarClassName="right-0 w-1.5 border-l-0"
				viewportTabIndex={-1}
				scrollbars="vertical"
			>
				{filtered.length === 0 ? (
					<div className="px-2.5 py-3 text-sm text-textcolor/60">
						{t('skill.slash.empty')}
					</div>
				) : (
					<div className="flex flex-col gap-1 px-2">
						{filtered.map((item) => {
							const checked = draftIds.includes(item.id);
							return (
								<div key={item.id}>
									{/* div 而非 button：Checkbox 内部已是 button，避免嵌套 */}
									<div
										className={cn(
											'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-theme/5',
											checked && 'bg-theme/8',
										)}
										onClick={() => pickAndConfirm(item.id)}
									>
										<Checkbox
											checked={checked}
											tabIndex={-1}
											onClick={(e) => e.stopPropagation()}
											onCheckedChange={() => toggle(item.id)}
										/>
										<span className="min-w-0 flex-1 truncate">
											{item.title}
										</span>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</ScrollArea>
			<div className="mt-1 flex shrink-0 items-center justify-between gap-2 border-t border-theme/10 px-2 py-1.5">
				<Button
					size="sm"
					variant="link"
					className="h-8 shrink-0 gap-1 px-0! text-textcolor/80 hover:text-teal-500"
					onClick={goCreateSkill}
				>
					<Plus className="size-4.5 -ml-0.5" aria-hidden />
					{t('skill.slash.add')}
				</Button>
				<div className="flex shrink-0 gap-2">
					<Button
						size="sm"
						className="w-18"
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						{t('common.cancel')}
					</Button>
					<Button
						size="sm"
						className="w-18"
						onClick={() => {
							onConfirm(draftIds);
							onOpenChange(false);
						}}
					>
						{t('skill.slash.confirm')}
					</Button>
				</div>
			</div>
		</div>,
		document.body,
	);
});

export default SkillSlashPicker;
