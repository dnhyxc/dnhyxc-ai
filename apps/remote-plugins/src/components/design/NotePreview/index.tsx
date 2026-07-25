import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import RichEditor from '../RichEditor';
import '../RichEditor/styles.css';
import './styles.css';

export type NotePreviewProps = {
	/** 顶栏标题（替代编辑器 toolbar） */
	title: string;
	/** TipTap HTML 或 JSON 内容 */
	html?: string;
	/** 顶栏标题旁/下方的次要信息（时间、标签等） */
	meta?: ReactNode;
	/** 顶栏右侧操作（返回编辑、列表开关等） */
	headerExtra?: ReactNode;
	/** 自定义正文；传入时忽略 html */
	children?: ReactNode;
	footer?: ReactNode;
	className?: string;
	bodyClassName?: string;
	emptyText?: string;
};

/** 去掉文档内嵌的 title NodeView，正文只渲染 block 内容（兼容旧 API） */
export function stripNoteTitleHtml(html: string): string {
	if (!html) return '';
	if (typeof DOMParser === 'undefined') {
		return html.replace(
			/<div[^>]*data-type=["']note-title["'][^>]*>[\s\S]*?<\/div>/i,
			'',
		);
	}
	const doc = new DOMParser().parseFromString(html, 'text/html');
	for (const el of doc.querySelectorAll('[data-type="note-title"]')) {
		el.remove();
	}
	return doc.body.innerHTML;
}

/**
 * 笔记只读预览：顶栏标题 + 可滚动正文。
 * - 使用 RichEditor 只读模式渲染，与编辑效果完全一致
 * - schema 层面禁用 title 节点，并用 stripNoteTitleHtml 预处理内容
 * - children / headerExtra / footer / meta 可扩展
 */
export function NotePreview({
	title,
	html,
	meta,
	headerExtra,
	children,
	footer,
	className,
	bodyClassName,
	emptyText = '暂无内容',
}: NotePreviewProps) {
	const bodyHtml = html ? stripNoteTitleHtml(html) : '';

	return (
		<div
			className={cn(
				'note-preview flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-r-md',
				className,
			)}
		>
			<header className="note-preview-header h-10 border-theme/10 flex shrink-0 items-center gap-3 border-b pl-3 pr-1.5 py-2.5">
				<div className="min-w-0 flex-1">
					<h1 className="text-textcolor truncate text-base font-semibold leading-snug">
						{title.trim() || '无标题笔记'}
					</h1>
					{meta ? (
						<div className="text-textcolor/45 mt-0.5 truncate text-xs">
							{meta}
						</div>
					) : null}
				</div>
				{headerExtra ? (
					<div className="flex shrink-0 items-center gap-0.5">
						{headerExtra}
					</div>
				) : null}
			</header>

			<div className="note-preview-body min-h-0 flex-1">
				{children != null ? (
					children
				) : bodyHtml ? (
					<RichEditor
						content={bodyHtml}
						editable={false}
						autofocus={false}
						showToolbar={false}
						showBubbleMenu={false}
						showCharCount={false}
						showTitle={false}
						className={cn('note-preview-editor', bodyClassName)}
						editorClassName="note-preview-tiptap"
					/>
				) : (
					<p className="text-textcolor/45 p-3 text-sm">{emptyText}</p>
				)}
			</div>

			{footer ? <div className="shrink-0">{footer}</div> : null}
		</div>
	);
}

export default NotePreview;
