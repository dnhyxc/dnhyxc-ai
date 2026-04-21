import Tooltip from '@design/Tooltip';
import { Button } from '@ui/index';
import { LibraryBig, OctagonX, SaveIcon, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** 编辑器顶栏：知识库 / 草稿 / 保存 */
const KnowledgeEditorToolbar = (props: {
	onOpenLibrary: () => void;
	onOpenTrash: () => void;
	onNewDraft: () => void;
	onSave: () => void;
	/** 保存请求进行中：禁用保存按钮 */
	saveLoading?: boolean;
	/** 未登录等场景隐藏回收站入口 */
	showTrash?: boolean;
	/** 系统设置中配置的快捷键文案（用于 Tooltip） */
	shortcutHintSave?: string;
	shortcutHintClear?: string;
	shortcutHintOpenLibrary?: string;
	shortcutHintOpenTrash?: string;
}) => {
	const {
		onOpenLibrary,
		onOpenTrash,
		onNewDraft,
		onSave,
		saveLoading = false,
		showTrash = true,
		shortcutHintSave,
		shortcutHintClear,
		shortcutHintOpenLibrary,
		shortcutHintOpenTrash,
	} = props;
	const linkBtn =
		'lucide-stroke-draw-hover flex items-center gap-1 px-0 has-[>svg]:px-0 disabled:hover:text-textcolor' as const;
	return (
		<div className="flex items-center pr-3 gap-4">
			<Tooltip
				side="bottom"
				content={shortcutHintSave ?? 'Meta + S / Control + S'}
			>
				<Button
					variant="link"
					className={linkBtn}
					onClick={onSave}
					disabled={saveLoading}
					aria-busy={saveLoading}
				>
					<SaveIcon className="mt-0.5" />
					<span className="mt-0.5">保存</span>
				</Button>
			</Tooltip>
			<Tooltip side="bottom" content={shortcutHintClear ?? 'Meta + Shift + D'}>
				<Button
					variant="link"
					className={cn(linkBtn, 'hover:text-orange-500')}
					onClick={onNewDraft}
				>
					<OctagonX className="mt-0.5" />
					<span className="mt-0.5">清空</span>
				</Button>
			</Tooltip>
			<Tooltip
				side="bottom"
				content={shortcutHintOpenLibrary ?? 'Meta + Shift + L'}
			>
				<Button variant="link" className={linkBtn} onClick={onOpenLibrary}>
					<LibraryBig className="mt-0.5" />
					<span className="mt-0.5">知识库</span>
				</Button>
			</Tooltip>
			{showTrash ? (
				<Tooltip
					side="bottom"
					content={shortcutHintOpenTrash ?? 'Meta + Shift + T'}
				>
					<Button variant="link" className={linkBtn} onClick={onOpenTrash}>
						<Trash2 className="mt-0.5" />
						<span className="mt-0.5">回收站</span>
					</Button>
				</Tooltip>
			) : null}
		</div>
	);
};

export default KnowledgeEditorToolbar;
