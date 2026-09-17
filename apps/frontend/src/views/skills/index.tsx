/**
 * Skills 三栏：列表 / Monaco 编辑 / 右侧 Agent 试跑。
 * 列表默认隐藏；打开时用三栏比例，关闭时编辑器+试跑 50/50（对齐知识库助手分栏）。
 */
import Confirm from '@design/Confirm';
import { Button, Input, ScrollArea } from '@ui/index';
import {
	FilePlus,
	FolderClosed,
	FolderOpen,
	NotebookPen,
	SaveIcon,
	Trash2,
} from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import MarkdownEditor from '@/components/design/Monaco';
import { useAssistantSelectionSpeak } from '@/components/design/SelectionSpeak';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useI18n, useTheme } from '@/hooks';
import { bindDocumentShortcutHandlers } from '@/hooks/useDocumentShortcuts';
import { cn } from '@/lib/utils';
import skillStore from '@/store/skill';
import { copyToClipboard, pasteFromClipboard } from '@/utils/clipboard';
import SkillTryPanel from './SkillTryPanel';

/** 与知识库编辑器顶栏一致：link 按钮 + 固定图标槽 */
const iconSlot =
	'relative inline-flex size-4 shrink-0 items-center justify-center overflow-hidden [&_svg]:size-4';
const linkBtn =
	'lucide-stroke-draw-hover flex items-center gap-1 px-0! has-[>svg]:px-0! text-textcolor transition-none hover:text-teal-500 disabled:hover:text-textcolor';

const handleClass = cn(
	'w-0 bg-transparent',
	'before:bg-theme/10 before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2',
);

function formatUpdatedAt(raw: string): string {
	try {
		const d = new Date(raw);
		if (Number.isNaN(d.getTime())) return '';
		return d.toLocaleString();
	} catch {
		return '';
	}
}

const SkillsPage = observer(function SkillsPage() {
	const { t } = useI18n();
	const { theme } = useTheme();
	/** 与知识库 / 插件配置页一致：黑主题用 vs-dark，否则 vs */
	const monacoTheme = useMemo(
		() => (theme === 'black' ? 'vs-dark' : 'vs'),
		[theme],
	);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	/** 左侧技能列表：默认隐藏，对齐知识库「库」抽屉默认关 */
	const [listOpen, setListOpen] = useState(false);
	/** 挂在本页：listOpen 会 remount ResizablePanelGroup，勿放进 SkillTryPanel 以免打断朗读 */
	const selectionSpeak = useAssistantSelectionSpeak({
		initialWidth: listOpen ? 219 : 344,
	});
	const clipboardAdapter = useMemo(
		() => ({ copyToClipboard, pasteFromClipboard }),
		[],
	);

	useEffect(() => {
		void skillStore.loadList();
	}, []);

	const onSave = useCallback(() => {
		if (skillStore.saving) return;
		void skillStore.save();
	}, []);

	const onNew = useCallback(() => {
		skillStore.createNew();
	}, []);

	useEffect(
		() => bindDocumentShortcutHandlers({ onSave, onNew }),
		[onSave, onNew],
	);

	const onDelete = useCallback(async () => {
		if (!deleteId) return;
		const ok = await skillStore.remove(deleteId);
		if (ok) setDeleteId(null);
	}, [deleteId]);

	return (
		<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden p-5.5 pt-0 rounded-md">
			{/*
			 * key 随 listOpen 切换，强制按对应 defaultLayout 重建：
			 * - 开列表：28 / 44 / 28（当前三栏）
			 * - 关列表：50 / 50（对齐知识库 Monaco 编辑器+助手）
			 */}
			<ResizablePanelGroup
				key={listOpen ? 'skills-with-list' : 'skills-editor-try'}
				id={listOpen ? 'skills-split-list' : 'skills-split-editor'}
				orientation="horizontal"
				className="min-h-0 min-w-0 flex-1 gap-0 rounded-md"
				defaultLayout={
					listOpen
						? {
								'skills-list': 28,
								'skills-editor': 44,
								'skills-try': 28,
							}
						: {
								'skills-editor': 58,
								'skills-try': 42,
							}
				}
			>
				{listOpen ? (
					<>
						<ResizablePanel
							id="skills-list"
							defaultSize="28%"
							className="min-h-0 min-w-0 overflow-hidden"
						>
							<aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-theme-background">
								<ScrollArea className="min-h-0 flex-1">
									{skillStore.list.length === 0 ? (
										<p className="p-4 text-sm text-textcolor/60">
											{t('skill.list.empty')}
										</p>
									) : (
										<div className="flex flex-col gap-0.5 p-2">
											{skillStore.list.map((item) => {
												const selected = skillStore.editingId === item.id;
												return (
													<div key={item.id}>
														{/* 布局对齐知识库列表行：操作区 absolute，hover 显删 */}
														<div
															role="button"
															tabIndex={0}
															className={cn(
																'group relative w-full cursor-pointer overflow-hidden rounded-md px-2 pb-1.5 pt-[5px] text-left text-sm transition-colors',
																selected ? 'bg-theme/10' : 'hover:bg-theme/10',
															)}
															onClick={() => void skillStore.openSkill(item.id)}
															onKeyDown={(e) => {
																if (e.key === 'Enter' || e.key === ' ') {
																	e.preventDefault();
																	void skillStore.openSkill(item.id);
																}
															}}
														>
															<div className="min-w-0 w-full group-hover:pr-8">
																<div className="truncate font-medium text-textcolor">
																	{item.title}
																</div>
																<div className="truncate mt-1 text-xs text-textcolor/50">
																	{formatUpdatedAt(item.updatedAt)}
																</div>
															</div>
															<div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto">
																<button
																	type="button"
																	aria-label={t('skill.delete')}
																	className={cn(
																		'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-textcolor/80',
																		'hover:text-destructive hover:bg-destructive/10',
																	)}
																	onClick={(e) => {
																		e.stopPropagation();
																		setDeleteId(item.id);
																	}}
																>
																	<Trash2 size={16} />
																</button>
															</div>
														</div>
													</div>
												);
											})}
										</div>
									)}
								</ScrollArea>
							</aside>
						</ResizablePanel>
						<ResizableHandle withHandle className={handleClass} />
					</>
				) : null}

				<ResizablePanel
					id="skills-editor"
					defaultSize={listOpen ? '44%' : '58%'}
					className="min-h-0 min-w-0 overflow-hidden"
				>
					<section className="h-full min-h-0 min-w-0 overflow-hidden">
						<MarkdownEditor
							className="h-full min-h-0"
							rounded={false}
							value={skillStore.content}
							onChange={(v) => skillStore.setContent(v)}
							height="100%"
							language="markdown"
							theme={monacoTheme}
							placeholder={t('skill.content.placeholder')}
							documentIdentity={skillStore.editingId ?? 'skill-new'}
							showTabBar={false}
							enableMarkdownPreview={false}
							clipboardAdapter={clipboardAdapter}
							title={
								<div className="flex flex-1 items-center pl-3">
									<NotebookPen size={16} className="shrink-0 text-textcolor" />
									<Input
										value={skillStore.title}
										onChange={(e) => skillStore.setTitle(e.target.value)}
										placeholder={t('skill.title.placeholder')}
										maxLength={200}
										aria-label={t('skill.title.placeholder')}
										className="md:text-base h-full border-0 bg-transparent pr-2 text-textcolor shadow-none placeholder:text-sm placeholder:text-textcolor/60 focus-visible:border-0 focus-visible:ring-0"
									/>
								</div>
							}
							toolbar={
								<div className="flex items-center gap-3 pr-3">
									<Button variant="link" className={linkBtn} onClick={onNew}>
										<span className={iconSlot}>
											<FilePlus aria-hidden />
										</span>
										<span>{t('skill.new')}</span>
									</Button>
									<Button
										variant="link"
										className={linkBtn}
										disabled={skillStore.saving}
										aria-busy={skillStore.saving}
										aria-label={
											skillStore.isDraftDirty
												? t('skill.save.unsaved')
												: t('skill.save')
										}
										onClick={onSave}
									>
										{/* overflow 外层放脏点，避免 iconSlot overflow-hidden 裁切 */}
										<span className="relative inline-flex shrink-0">
											<span className={iconSlot}>
												<SaveIcon aria-hidden />
											</span>
											{skillStore.isDraftDirty ? (
												<span
													className="pointer-events-none absolute -right-1 -top-1 size-2 rounded-full bg-orange-500"
													aria-hidden
												/>
											) : null}
										</span>
										<span>{t('skill.save')}</span>
									</Button>
									<Button
										variant="link"
										className={cn(
											linkBtn,
											listOpen && 'text-teal-500 hover:text-teal-500',
										)}
										aria-pressed={listOpen}
										aria-label={
											listOpen
												? t('skill.toolbar.libraryHide')
												: t('skill.toolbar.libraryShow')
										}
										onClick={() => setListOpen((v) => !v)}
									>
										<span className={iconSlot}>
											{listOpen ? (
												<FolderOpen aria-hidden />
											) : (
												<FolderClosed aria-hidden />
											)}
										</span>
										<span>{t('skill.toolbar.library')}</span>
									</Button>
								</div>
							}
						/>
					</section>
				</ResizablePanel>

				<ResizableHandle withHandle className={handleClass} />

				<ResizablePanel
					id="skills-try"
					defaultSize={listOpen ? '28%' : '42%'}
					className="min-h-0 min-w-0 overflow-hidden"
				>
					<SkillTryPanel selectionSpeak={selectionSpeak} />
				</ResizablePanel>
			</ResizablePanelGroup>

			<Confirm
				open={deleteId != null}
				onOpenChange={(open) => {
					if (!open) setDeleteId(null);
				}}
				title={t('skill.delete.confirmTitle')}
				description={t('skill.delete.confirmDesc')}
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={() => void onDelete()}
			/>
		</div>
	);
});

export default SkillsPage;
