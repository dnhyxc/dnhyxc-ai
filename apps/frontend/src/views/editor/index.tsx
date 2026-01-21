import { ScrollArea } from '@ui/scroll-area';
// import RichTextEditor from '@/components/design/RichTextEditor';
import RichEditor from '@/components/design/Editor';

const Editor = () => {
	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<ScrollArea className="w-full h-full overflow-y-auto p-2.5 pt-0 rounded-none">
				{/* <RichTextEditor /> */}
				<RichEditor />
			</ScrollArea>
		</div>
	);
};
export default Editor;
