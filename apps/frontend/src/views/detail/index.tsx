import { ScrollArea } from '@ui/scroll-area';
import MarkdownPreview from '@/components/design/Markdown';
import useStore from '@/store';

const Detail = () => {
	const { detailStore } = useStore();

	return (
		<div className="w-full h-full flex flex-col pt-1.5 justify-center items-center m-0">
			<ScrollArea className="w-full h-full overflow-y-auto p-2.5 pt-0 rounded-none">
				<div className="bg-theme-background p-2 rounded-md">
					<div className="text-xl">MARKDOWN</div>
					<MarkdownPreview
						value={detailStore.markdown}
						// height="calc(100vh - 135px)"
						width="calc(100vw - 148px)"
						className="bg-theme-background"
					/>
				</div>
			</ScrollArea>
		</div>
	);
};

export default Detail;
