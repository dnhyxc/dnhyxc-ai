import { useSandpack } from '@codesandbox/sandpack-react';
import { Button } from '@ui/index';

interface ToolbarProps {
	onTogglePreview: () => void;
	onToggleConsole: () => void;
	isPreviewVisible: boolean;
	isConsoleVisible: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
	onTogglePreview,
	onToggleConsole,
	isPreviewVisible,
	isConsoleVisible,
}) => {
	const { dispatch, sandpack } = useSandpack();

	const handleRun = () => {
		dispatch({ type: 'refresh' });
	};

	return (
		<div className="flex gap-2 items-center text-textcolor rounded-t-md p-2 border-b border-theme/5">
			<Button
				onClick={onTogglePreview}
				className="bg-transparent hover:bg-transparent bg-linear-to-r from-blue-600 to-cyan-600"
			>
				{isPreviewVisible ? '👁️ 隐藏预览' : '👁️‍🗨️ 显示预览'}
			</Button>

			<Button
				onClick={onToggleConsole}
				className="bg-transparent hover:bg-transparent bg-linear-to-r from-blue-600 to-cyan-600"
			>
				{isConsoleVisible ? '👁️ 隐藏日志' : '👁️‍🗨️ 显示日志'}
			</Button>

			<Button
				onClick={handleRun}
				disabled={sandpack.status !== 'running'}
				className="bg-transparent hover:bg-transparent bg-linear-to-r from-blue-600 to-cyan-600"
			>
				▶ 强制刷新
			</Button>
		</div>
	);
};

export default Toolbar;
