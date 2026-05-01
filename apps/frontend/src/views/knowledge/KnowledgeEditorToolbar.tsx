import Tooltip from '@design/Tooltip';
import { Button } from '@ui/index';
import { LibraryBig, OctagonX, SaveIcon, Share2, Trash2 } from 'lucide-react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';

/** 编辑器顶栏：知识库 / 草稿 / 保存 */
const KnowledgeEditorToolbar = (props: {
	onOpenLibrary: () => void;
	onOpenTrash: () => void;
	onNewDraft: () => void;
	onSave: () => void;
	onShareKnowledge: () => void;
	/** 保存请求进行中：禁用保存按钮 */
	saveLoading?: boolean;
	/** 未登录等场景隐藏回收站入口 */
	showTrash?: boolean;
	/** 系统设置中配置的快捷键文案（用于 Tooltip） */
	shortcutHintSave?: string;
	shortcutHintClear?: string;
	shortcutHintOpenLibrary?: string;
	shortcutHintOpenTrash?: string;
	shortcutHintShare?: string;
}) => {
	const { t } = useI18n();
	const {
		onOpenLibrary,
		onOpenTrash,
		onNewDraft,
		onSave,
		onShareKnowledge,
		saveLoading = false,
		showTrash = true,
		shortcutHintSave,
		shortcutHintClear,
		shortcutHintOpenLibrary,
		shortcutHintOpenTrash,
		shortcutHintShare,
	} = props;
	const linkBtn =
		'lucide-stroke-draw-hover flex items-center gap-1 px-0 has-[>svg]:px-0 disabled:hover:text-textcolor' as const;
	return (
		<div className="flex items-center pr-3 gap-4">
			<Tooltip
				side="bottom"
				content={shortcutHintSave ?? t('knowledge.shortcuts.save')}
			>
				<Button
					variant="link"
					className={linkBtn}
					onClick={onSave}
					disabled={saveLoading}
					aria-busy={saveLoading}
				>
					<SaveIcon className="mt-0.5" />
					<span className="mt-0.5">{t('knowledge.toolbar.save')}</span>
				</Button>
			</Tooltip>
			<Tooltip
				side="bottom"
				content={shortcutHintClear ?? t('knowledge.shortcuts.clear')}
			>
				<Button
					variant="link"
					className={cn(linkBtn, 'hover:text-orange-500')}
					onClick={onNewDraft}
				>
					<OctagonX className="mt-0.5" />
					<span className="mt-0.5">{t('knowledge.toolbar.clear')}</span>
				</Button>
			</Tooltip>
			<Tooltip
				side="bottom"
				content={shortcutHintShare ?? t('knowledge.shortcuts.share')}
			>
				<Button variant="link" className={linkBtn} onClick={onShareKnowledge}>
					<Share2 className="mt-0.5" />
					<span className="mt-0.5">{t('knowledge.toolbar.share')}</span>
				</Button>
			</Tooltip>
			<Tooltip
				side="bottom"
				content={
					shortcutHintOpenLibrary ?? t('knowledge.shortcuts.openLibrary')
				}
			>
				<Button variant="link" className={linkBtn} onClick={onOpenLibrary}>
					<LibraryBig className="mt-0.5" />
					<span className="mt-0.5">{t('knowledge.toolbar.library')}</span>
				</Button>
			</Tooltip>
			{showTrash ? (
				<Tooltip
					side="bottom"
					content={shortcutHintOpenTrash ?? t('knowledge.shortcuts.openTrash')}
				>
					<Button variant="link" className={linkBtn} onClick={onOpenTrash}>
						<Trash2 className="mt-0.5" />
						<span className="mt-0.5">{t('knowledge.toolbar.trash')}</span>
					</Button>
				</Tooltip>
			) : null}
		</div>
	);
};

export default KnowledgeEditorToolbar;
