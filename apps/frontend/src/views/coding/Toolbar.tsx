import {
	type CodeEditorRef,
	type SANDBOX_TEMPLATES,
	useSandpack,
} from '@codesandbox/sandpack-react';
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@ui/index';
import { PackagePlus, RotateCw } from 'lucide-react';
import type { RefObject } from 'react';
import { useI18n } from '@/hooks';
import { TEMPLATES } from './template';

interface ToolbarProps {
	editorRef?: RefObject<CodeEditorRef | null>;
	onTogglePreview?: () => void;
	onToggleConsole?: () => void;
	isPreviewVisible?: boolean;
	isConsoleVisible?: boolean;
	template?: keyof typeof SANDBOX_TEMPLATES;
	setTemplate?: (template: keyof typeof SANDBOX_TEMPLATES) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
	onTogglePreview,
	onToggleConsole,
	isPreviewVisible,
	isConsoleVisible,
	template,
	setTemplate,
}) => {
	const { dispatch, sandpack } = useSandpack();
	const { t } = useI18n();

	const handleRun = () => {
		dispatch({ type: 'refresh' });
	};

	const onSelectTemplate = (template: keyof typeof SANDBOX_TEMPLATES) => {
		setTemplate?.(template);
	};

	return (
		<div className="flex h-11 items-center justify-between gap-2 rounded-t-md border-b border-theme/5 px-3">
			<div className="flex items-center gap-2">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="link" className="px-0 has-[>svg]:px-0">
							<PackagePlus />
							<span>{t('coding.toolbar.selectTemplate')}</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-40 max-h-80 border-theme/10 bg-theme-secondary text-textcolor"
						align="start"
					>
						{TEMPLATES.map((i) => {
							return (
								<DropdownMenuItem
									key={i}
									className="text-textcolor focus:bg-theme/15 focus:text-textcolor"
									onClick={() =>
										onSelectTemplate(
											i as unknown as keyof typeof SANDBOX_TEMPLATES,
										)
									}
								>
									{i}
								</DropdownMenuItem>
							);
						})}
					</DropdownMenuContent>
				</DropdownMenu>
				{onTogglePreview && (
					<Button
						variant="link"
						onClick={onTogglePreview}
						className="text-textcolor hover:bg-theme/10 hover:text-theme"
					>
						{isPreviewVisible
							? t('coding.toolbar.preview.hide')
							: t('coding.toolbar.preview.show')}
					</Button>
				)}

				{onToggleConsole && (
					<Button
						variant="link"
						onClick={onToggleConsole}
						className="text-textcolor hover:bg-theme/10 hover:text-theme"
					>
						{isConsoleVisible
							? t('coding.toolbar.console.hide')
							: t('coding.toolbar.console.show')}
					</Button>
				)}

				<Button
					variant="link"
					onClick={handleRun}
					disabled={sandpack.status !== 'running'}
					className="ml-2 px-0 has-[>svg]:px-0 disabled:hover:text-textcolor/50"
				>
					<RotateCw />
					<span>{t('coding.toolbar.forceRefresh')}</span>
				</Button>
			</div>
			<div className="font-medium text-sm text-textcolor h-full flex items-center">
				<span>{t('coding.toolbar.currentTemplate')}：</span>
				<span className="text-lg text-theme">{template}</span>
			</div>
		</div>
	);
};

export default Toolbar;
