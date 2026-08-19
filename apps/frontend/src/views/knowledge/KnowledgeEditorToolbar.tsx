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

/** 固定 16×16；裁切转圈/描边溢出，避免行高被带着上下晃 */
const iconSlot =
	'relative inline-flex size-4 shrink-0 items-center justify-center overflow-hidden [&_svg]:size-4';

/** 关掉 transition-all，避免 loading 重渲染时和描边动画叠出抖动 */
const linkBtn =
	'lucide-stroke-draw-hover flex items-center gap-1 px-0! has-[>svg]:px-0! text-textcolor transition-none hover:text-teal-500 disabled:hover:text-textcolor';

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
	return (
		<div className="flex items-center pr-3 gap-3">
			<Tooltip
				side="top"
				content={shortcutHintImport ?? t('knowledge.shortcuts.import')}
			>
				<Button
					variant="link"
					className={linkBtn}
					onClick={onImport}
					disabled={importLoading}
					aria-busy={importLoading}
				>
					<span className={iconSlot}>
						<SquareArrowRight aria-hidden />
					</span>
					<span>{t('knowledge.toolbar.import')}</span>
				</Button>
			</Tooltip>
			<Tooltip
				side="top"
				content={shortcutHintSave ?? t('knowledge.shortcuts.save')}
			>
				<Button
					variant="link"
					className={linkBtn}
					onClick={onSave}
					disabled={saveLoading}
					aria-busy={saveLoading}
				>
					<span className={iconSlot}>
						<SaveIcon aria-hidden />
					</span>
					<span>{t('knowledge.toolbar.save')}</span>
				</Button>
			</Tooltip>
			<Tooltip
				side="top"
				content={shortcutHintClear ?? t('knowledge.shortcuts.clear')}
			>
				<Button
					variant="link"
					className={cn(linkBtn, 'hover:text-orange-500')}
					onClick={onNewDraft}
				>
					<span className={iconSlot}>
						<OctagonX aria-hidden />
					</span>
					<span>{t('knowledge.toolbar.clear')}</span>
				</Button>
			</Tooltip>
			{isCloudLoggedIn && (
				<Tooltip
					side="top"
					content={shortcutHintShare ?? t('knowledge.shortcuts.share')}
				>
					<Button variant="link" className={linkBtn} onClick={onShareKnowledge}>
						<span className={iconSlot}>
							<Share2 aria-hidden />
						</span>
						<span>{t('knowledge.toolbar.share')}</span>
					</Button>
				</Tooltip>
			)}
			<Tooltip
				side="top"
				content={
					shortcutHintOpenLibrary ?? t('knowledge.shortcuts.openLibrary')
				}
			>
				<Button variant="link" className={linkBtn} onClick={onOpenLibrary}>
					<span className={iconSlot}>
						<LibraryBig aria-hidden />
					</span>
					<span>{t('knowledge.toolbar.library')}</span>
				</Button>
			</Tooltip>
			{isCloudLoggedIn ? (
				<Tooltip
					side="top"
					content={shortcutHintOpenTrash ?? t('knowledge.shortcuts.openTrash')}
				>
					<Button variant="link" className={linkBtn} onClick={onOpenTrash}>
						<span className={iconSlot}>
							<Trash2 aria-hidden />
						</span>
						<span>{t('knowledge.toolbar.trash')}</span>
					</Button>
				</Tooltip>
			) : null}
		</div>
	);
};

export default KnowledgeEditorToolbar;
