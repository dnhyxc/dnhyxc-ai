import Tooltip from '@design/Tooltip';
import { Button } from '@ui/index';
import {
	LibraryBig,
	OctagonX,
	SaveIcon,
	Share2,
	SquareArrowRight,
	Trash2,
} from 'lucide-react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';

/** 编辑器顶栏：知识库 / 草稿 / 保存 */
const KnowledgeEditorToolbar = (props: {
	onOpenLibrary: () => void;
	onOpenTrash: () => void;
	onNewDraft: () => void;
	onSave: () => void;
	onImport: () => void;
	onShareKnowledge: () => void;
	/** 保存请求进行中：禁用保存按钮 */
	saveLoading?: boolean;
	/** 导入请求进行中：禁用导入按钮 */
	importLoading?: boolean;
	/** 是否登录云端 */
	isCloudLoggedIn?: boolean;
	/** 系统设置中配置的快捷键文案（用于 Tooltip） */
	shortcutHintSave?: string;
	shortcutHintImport?: string;
	shortcutHintClear?: string;
	shortcutHintOpenLibrary?: string;
	shortcutHintOpenTrash?: string;
	/** 分享组合键提示；未登录时不展示分享按钮，父页 `knowledge/index` 亦不会响应分享快捷键 */
	shortcutHintShare?: string;
}) => {
	const { t } = useI18n();
	const {
		onOpenLibrary,
		onOpenTrash,
		onNewDraft,
		onSave,
		onImport,
		onShareKnowledge,
		saveLoading = false,
		importLoading = false,
		isCloudLoggedIn = false,
		shortcutHintSave,
		shortcutHintImport,
		shortcutHintClear,
		shortcutHintOpenLibrary,
		shortcutHintOpenTrash,
		shortcutHintShare,
	} = props;
	const linkBtn =
		'lucide-stroke-draw-hover flex items-center gap-1 px-0 has-[>svg]:px-0 disabled:hover:text-textcolor' as const;
	return (
		<div className="flex items-center pr-3 gap-3">
			<Tooltip
				side="bottom"
				content={shortcutHintImport ?? t('knowledge.shortcuts.import')}
			>
				<Button
					variant="link"
					className={linkBtn}
					onClick={onImport}
					disabled={importLoading}
					aria-busy={importLoading}
				>
					<SquareArrowRight className="mt-0.5" />
					<span className="mt-0.5">{t('knowledge.toolbar.import')}</span>
				</Button>
			</Tooltip>
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
			{isCloudLoggedIn && (
				<Tooltip
					side="bottom"
					content={shortcutHintShare ?? t('knowledge.shortcuts.share')}
				>
					<Button variant="link" className={linkBtn} onClick={onShareKnowledge}>
						<Share2 className="mt-0.5" />
						<span className="mt-0.5">{t('knowledge.toolbar.share')}</span>
					</Button>
				</Tooltip>
			)}
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
			{isCloudLoggedIn ? (
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
