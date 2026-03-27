/**
 * Markdown 预览封装：底层为 md-editor-rt 的 MdPreview，props 不变时不应重复触发其内部重解析。
 * 外层使用 React.memo 做浅比较，配合上层「消息对象引用稳定」可减少无意义更新。
 */
import { MdPreview } from 'md-editor-rt';
// import { config, MdPreview } from 'md-editor-rt';
import 'md-editor-rt/lib/style.css';
// memo：导出组件用 memo 包裹后的结果，默认导出仍为 MarkdownPreview 名称
import { memo } from 'react';
import { cn } from '@/lib/utils';

interface MarkdownPreviewProps {
	value?: string;
	className?: string;
	width?: string;
	height?: string;
	padding?: string;
	theme?: 'light' | 'dark';
	background?: string;
}

/** 实际渲染 MdPreview 的内部组件，供 memo 包裹 */
const MarkdownPreviewInner: React.FC<MarkdownPreviewProps> = ({
	value = '',
	className,
	width,
	height,
	theme = 'light',
	padding,
	background,
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
					padding: padding || '5px 10px',
					// borderRadius: '8px',
					backgroundColor: background,
					color: theme === 'light' ? 'black' : 'white',
				}}
			/>
		</div>
	);
};

/**
 * 默认导出：memo 后仅当 value/theme/样式相关 props 变化才重渲染 MdPreview，
 * areEqual 返回 true 表示 props 等价、跳过本次渲染。
 */
const MarkdownPreview = memo(
	MarkdownPreviewInner,
	(prev, next) =>
		prev.value === next.value && // value 变会触发 md 重解析（最重）
		prev.theme === next.theme && // 亮暗切换须重算 md-editor 主题
		prev.className === next.className && // 外层布局类名变须重排
		prev.width === next.width && // 与 style 尺寸绑定
		prev.height === next.height &&
		prev.padding === next.padding &&
		prev.background === next.background, // 如 backgroundColor，皮肤不变则少 paint 相关更新
);

export default MarkdownPreview;
