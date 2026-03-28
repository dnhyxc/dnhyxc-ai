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

	const handleRun = () => {
		dispatch({ type: 'refresh' });
	};

	const onSelectTemplate = (template: keyof typeof SANDBOX_TEMPLATES) => {
		setTemplate?.(template);
	};

	return (
		<div className="flex justify-between gap-2 items-center text-textcolor rounded-t-md p-2 border-b border-theme/5">
			<div className="flex gap-2 items-center">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button className="bg-transparent hover:bg-transparent bg-linear-to-r from-blue-600 to-cyan-600">
							<PackagePlus />
							选择模版
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-40 bg-theme-secondary text-textcolor max-h-80 border-theme/10"
						align="start"
					>
						{TEMPLATES.map((i) => {
							return (
								<DropdownMenuItem
									key={i}
									className="hover:bg-amber-300"
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
						onClick={onTogglePreview}
						className="bg-transparent hover:bg-transparent bg-linear-to-r from-blue-600 to-cyan-600"
					>
						{isPreviewVisible ? '👁️ 隐藏预览' : '👁️‍🗨️ 显示预览'}
					</Button>
				)}

				{onToggleConsole && (
					<Button
						onClick={onToggleConsole}
						className="bg-transparent hover:bg-transparent bg-linear-to-r from-blue-600 to-cyan-600"
					>
						{isConsoleVisible ? '👁️ 隐藏日志' : '👁️‍🗨️ 显示日志'}
					</Button>
				)}

				<Button
					onClick={handleRun}
					disabled={sandpack.status !== 'running'}
					className="bg-transparent hover:bg-transparent bg-linear-to-r from-blue-600 to-cyan-600"
				>
					<RotateCw />
					强制刷新
				</Button>
			</div>
			<div className="text-theme/90 font-medium">
				当前语言：<span className="text-lg">{template}</span>
			</div>
		</div>
	);
};

export default Toolbar;
