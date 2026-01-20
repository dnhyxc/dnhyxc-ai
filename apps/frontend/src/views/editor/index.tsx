import { ScrollArea } from '@ui/scroll-area';
import RichTextEditor from '@/components/design/RichTextEditor';

const Editor = () => {
	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<ScrollArea className="w-full h-full overflow-y-auto p-2.5 rounded-none">
				<RichTextEditor />
			</ScrollArea>
		</div>
	);
};
export default Editor;
