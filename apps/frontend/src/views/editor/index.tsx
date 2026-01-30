import { MarkdownParser } from '@dnhyxc-ai/tools';
import '@dnhyxc-ai/tools/styles.css';
import { Button } from '@ui/index';
import { ScrollArea } from '@ui/scroll-area';
import { config } from 'md-editor-rt';
// import MarkdownParser from '@/utils/markdownParser';
import { useMemo, useState } from 'react';
import MarkdownEditor from '@/components/design/Monaco';
import { useTheme } from '@/hooks';
import useStore from '@/store';

const Editor = () => {
	const [markdown, setMarkdown] = useState('');
	const [htmlContent, setHtmlContent] = useState('');

	const { detailStore } = useStore();
	const { theme } = useTheme();

	// 1. 初始化解析器
	const parser = useMemo(() => {
		return new MarkdownParser();
	}, []);

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

	const onParser = () => {
		const htmlContent = parser.render(markdown);
		console.log(htmlContent, 'htmlContent');
		setHtmlContent(htmlContent);
	};

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<ScrollArea className="w-full h-full overflow-y-auto p-2.5 pt-0 rounded-none">
				<Button onClick={onParser}>解析 MD</Button>
				<div
					className="h-full w-full border border-[red]"
					dangerouslySetInnerHTML={{ __html: htmlContent }}
				/>
				<MarkdownEditor
					className="w-full h-full"
					height="calc(100vh - 161px)"
					theme={theme === 'black' ? 'vs-dark' : 'vs'}
					onChange={getValue}
				/>
			</ScrollArea>
		</div>
	);
};
export default Editor;
