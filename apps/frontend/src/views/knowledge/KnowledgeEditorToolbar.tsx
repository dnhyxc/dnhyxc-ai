import Tooltip from '@design/Tooltip';
import { Button } from '@ui/index';
import {
	FilePlus,
	Globe,
	LibraryBig,
	SaveIcon,
	Share2,
	SquareArrowRight,
	Trash2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '@/hooks';

/** 固定 16×16；裁切转圈/描边溢出，避免行高被带着上下晃 */
const iconSlot =
	'relative inline-flex size-4 shrink-0 items-center justify-center overflow-hidden [&_svg]:size-4';

/** 关掉 transition-all，避免 loading 重渲染时和描边动画叠出抖动 */
const linkBtn =
	'lucide-stroke-draw-hover flex items-center gap-1 px-0! has-[>svg]:px-0! text-textcolor transition-none hover:text-teal-500 disabled:hover:text-textcolor';

/** 编辑器顶栏：导入 / 新建 / 保存 / … */
const KnowledgeEditorToolbar = (props: {
	onOpenLibrary: () => void;
	onOpenTrash: () => void;
	onNewDraft: () => void;
	onSave: () => void;
	onImport: () => void;
	onShareKnowledge: () => void;
	/** 他人公开文档：导入 / 保存 / 分享不可用 */
	readOnly?: boolean;
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
	/** 已保存的本人文档才展示；文案随当前是否公开切换 */
	showVisibility?: boolean;
	isPublic?: boolean;
	onToggleVisibility?: () => void;
	shortcutHintVisibility?: string;
	/** 跟回收站同一行的额外按钮，例如留言 */
	extra?: ReactNode;
}) => {
	const { t } = useI18n();
	const {
		onOpenLibrary,
		onOpenTrash,
		onNewDraft,
		onSave,
		onImport,
		onShareKnowledge,
		readOnly = false,
		saveLoading = false,
		importLoading = false,
		isCloudLoggedIn = false,
		shortcutHintSave,
		shortcutHintImport,
		shortcutHintClear,
		shortcutHintOpenLibrary,
		shortcutHintOpenTrash,
		shortcutHintShare,
		showVisibility = false,
		isPublic = false,
		onToggleVisibility,
		shortcutHintVisibility,
		extra,
	} = props;
	return (
		<div className="flex items-center pr-3 gap-3">
			<Tooltip
				side="top"
				content={
					readOnly
						? t('knowledge.readonly.othersPublic')
						: (shortcutHintImport ?? t('knowledge.shortcuts.import'))
				}
			>
				<Button
					variant="link"
					className={linkBtn}
					onClick={onImport}
					disabled={importLoading || readOnly}
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
				content={shortcutHintClear ?? t('knowledge.shortcuts.clear')}
			>
				<Button variant="link" className={linkBtn} onClick={onNewDraft}>
					<span className={iconSlot}>
						<FilePlus aria-hidden />
					</span>
					<span>{t('skill.new')}</span>
				</Button>
			</Tooltip>
			<Tooltip
				side="top"
				content={
					readOnly
						? t('knowledge.readonly.othersPublic')
						: (shortcutHintSave ?? t('knowledge.shortcuts.save'))
				}
			>
				<Button
					variant="link"
					className={linkBtn}
					onClick={onSave}
					disabled={saveLoading || readOnly}
					aria-busy={saveLoading}
				>
					<span className={iconSlot}>
						<SaveIcon aria-hidden />
					</span>
					<span>{t('common.save')}</span>
				</Button>
			</Tooltip>
			{isCloudLoggedIn && (
				<Tooltip
					side="top"
					content={
						readOnly
							? t('knowledge.readonly.othersPublic')
							: (shortcutHintShare ?? t('knowledge.shortcuts.share'))
					}
				>
					<Button
						variant="link"
						className={linkBtn}
						onClick={onShareKnowledge}
						disabled={readOnly}
					>
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
						<span>{t('knowledge.trash.title')}</span>
					</Button>
				</Tooltip>
			) : null}
			{showVisibility ? (
				<Tooltip
					side="top"
					content={
						shortcutHintVisibility ?? t('knowledge.shortcuts.toggleVisibility')
					}
				>
					<Button
						variant="link"
						className={`${linkBtn}${isPublic ? ' text-teal-500' : ''}`}
						onClick={onToggleVisibility}
					>
						<span className={iconSlot}>
							<Globe aria-hidden />
						</span>
						<span>
							{isPublic ? t('common.makePrivate') : t('common.publicBadge')}
						</span>
					</Button>
				</Tooltip>
			) : null}
			{extra}
		</div>
	);
};

export default KnowledgeEditorToolbar;
