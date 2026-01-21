import { ScrollArea } from '@ui/scroll-area';
import MarkdownEditor from '@/components/design/Monaco';
import { useTheme } from '@/hooks';

const Editor = () => {
	const { theme } = useTheme();

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<ScrollArea className="w-full h-full overflow-y-auto p-2.5 pt-0 rounded-none">
				<MarkdownEditor
					className="w-full h-full"
					height="calc(100vh - 161px)"
					theme={theme === 'black' ? 'vs-dark' : 'vs'}
				/>
			</ScrollArea>
		</div>
	);
};
export default Editor;
