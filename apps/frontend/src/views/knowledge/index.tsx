import { ScrollArea } from '@ui/scroll-area';
import { Layers2, LayersPlus } from 'lucide-react';
import { useState } from 'react';
import MarkdownEditor from '@/components/design/Monaco';
import { Button } from '@/components/ui';
import { useTheme } from '@/hooks';
import useStore from '@/store';

const Knowledge = () => {
	const [, setMarkdown] = useState('');

	const { detailStore } = useStore();
	const { theme } = useTheme();

	const getValue = (value: string) => {
		setMarkdown(value);
		detailStore.setMarkdown(value);
	};

	const onDraft = () => {
		console.log('草稿');
	};

	const onSave = () => {
		console.log('保存');
	};

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<ScrollArea className="w-full h-full overflow-y-auto p-5 pt-0 rounded-none">
				<MarkdownEditor
					className="w-full h-full"
					height="calc(100vh - 172px)"
					theme={theme === 'black' ? 'vs-dark' : 'vs'}
					onChange={getValue}
					toolbar={
						<div className="flex items-center pr-3 gap-4">
							<Button
								variant="link"
								className="flex items-center gap-0! px-0!"
								onClick={onDraft}
							>
								<Layers2 />
								<span className="mt-0.5 ml-1">草稿</span>
							</Button>
							<Button
								variant="link"
								className="flex items-center gap-0! px-0!"
								onClick={onSave}
							>
								<LayersPlus />
								<span className="mt-0.5 ml-1">保存</span>
							</Button>
						</div>
					}
				/>
			</ScrollArea>
		</div>
	);
};

export default Knowledge;
