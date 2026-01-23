import { MdPreview } from 'md-editor-rt';
// import { config, MdPreview } from 'md-editor-rt';
import 'md-editor-rt/lib/style.css';
import { cn } from '@/lib/utils';

interface MarkdownPreviewProps {
	value?: string;
	className?: string;
	width?: string;
	height?: string;
	theme?: 'light' | 'dark';
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
	value = '',
	className,
	width,
	height,
	theme = 'light',
}) => {
	// config({
	// 	markdownItPlugins(plugins, options) {
	// 		return plugins.map((item) => {
	// 			switch (item.type) {
	// 				case 'code': {
	// 					return {
	// 						...item,
	// 						options: {
	// 							...item.options,
	// 							extraTools: '<span class="extra-code-tools">运行代码</span>',
	// 						},
	// 					};
	// 				}
	// 				case 'taskList': {
	// 					return {
	// 						...item,
	// 						options: {
	// 							...item.options,
	// 							enabled: true,
	// 						},
	// 					};
	// 				}

	// 				default: {
	// 					return item;
	// 				}
	// 			}
	// 		});
	// 	},
	// });
	return (
		<div className={cn('flex w-full h-full', className)}>
			<MdPreview
				value={value}
				theme={theme}
				codeFoldable={false}
				autoFoldThreshold={100}
				noImgZoomIn
				language="zh-CN"
				codeTheme="github"
				style={{
					height,
					width,
					borderRadius: '8px',
					backgroundColor: 'var(--theme-background)',
				}}
			/>
		</div>
	);
};

export default MarkdownPreview;
