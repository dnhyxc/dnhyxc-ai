import '@dnhyxc-ai/tools/styles.css';
import { ScrollArea } from '@ui/scroll-area';
import { config } from 'md-editor-rt';
// import MarkdownParser from '@/utils/markdownParser';
import { useState } from 'react';
import MarkdownEditor from '@/components/design/Monaco';
import { useTheme } from '@/hooks';
import useStore from '@/store';

const Editor = () => {
	const [markdown, setMarkdown] = useState('');

	const { detailStore } = useStore();
	const { theme } = useTheme();

	const getValue = (value: string) => {
		setMarkdown(value);
		detailStore.setMarkdown(value);
	};

	config({
		markdownItPlugins(plugins, _options) {
			return plugins.map((item) => {
				switch (item.type) {
					case 'code': {
						return {
							...item,
							options: {
								...item.options,
								extraTools: '<span class="extra-code-tools">运行代码</span>',
							},
						};
					}
					case 'taskList': {
						return {
							...item,
							options: {
								...item.options,
								enabled: true,
							},
						};
					}

					default: {
						return item;
					}
				}
			});
		},
	});

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<ScrollArea className="w-full h-full overflow-y-auto p-5 pt-0 rounded-none">
				<MarkdownEditor
					className="w-full h-full"
					height="calc(100vh - 169px)"
					theme={theme === 'black' ? 'vs-dark' : 'vs'}
					onChange={getValue}
				/>
			</ScrollArea>
		</div>
	);
};
export default Editor;
