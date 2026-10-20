import { StreamingMarkdownBody } from '@design/ChatAssistantMessage/StreamingMarkdownBody';
import {
	bindMarkdownCodeFenceActions,
	MarkdownParser,
} from '@dnhyxc-ai/markdown-kit';
import '@dnhyxc-ai/markdown-kit/styles.css';
import { ScrollArea } from '@ui/index';
import { Spinner } from '@ui/spinner';
import { useEffect, useMemo, useRef } from 'react';
import { getChatMarkdownHighlightTheme } from '@/constants';
import { useI18n } from '@/hooks';
import { useTheme } from '@/hooks/theme';
import { useStickToBottomScroll } from '@/hooks/useStickToBottomScroll';
import { cn } from '@/lib/utils';
import { downloadChatCodeBlock } from '@/utils/chatCodeToolbar';

export function StreamPreview({
	text,
	generating,
}: {
	text: string;
	generating: boolean;
}) {
	const { t } = useI18n();
	const { theme } = useTheme();
	const rootRef = useRef<HTMLDivElement>(null);
	const { viewportRef, scrollViewportHandlers } = useStickToBottomScroll({
		isStreaming: generating,
		contentRevision: text.length,
		idleFlushKey: generating ? null : 'paused',
	});
	const parser = useMemo(
		() =>
			new MarkdownParser({
				enableChatCodeFenceToolbar: true,
				chatCodeFenceToolbarTexts: {
					copy: t('common.copy'),
					download: t('common.download'),
				},
				enableMermaid: false,
				highlightTheme: getChatMarkdownHighlightTheme(theme),
			}),
		[theme, t],
	);
	useEffect(() => {
		const el = rootRef.current;
		if (!el) return;
		return bindMarkdownCodeFenceActions(el, {
			onDownload(payload) {
				void downloadChatCodeBlock(payload.block, payload.lang);
			},
		});
	}, []);
	const markdown = text
		? `\`\`\`json\n${text}${generating ? '' : '\n```'}`
		: '';
	return (
		<ScrollArea
			ref={viewportRef}
			className="h-full min-w-0 flex-1"
			viewportClassName="[overflow-anchor:none]"
			scrollbarClassName="right-0 w-1.5 border-l-0 p-0"
			{...scrollViewportHandlers}
		>
			<div
				ref={rootRef}
				data-stick-scroll-content
				className="message-md-wrap p-3 [&_.chat-md-code-block]:my-0"
			>
				{markdown ? (
					<StreamingMarkdownBody
						markdown={markdown}
						parser={parser}
						preferDark={theme === 'black'}
						isStreaming={generating}
						t={t}
						className={cn(
							'min-w-0 w-full max-w-full [&_.streaming-md-body]:min-w-0 [&_.markdown-body]:text-textcolor/90! [&_.markdown-body]:rounded-md',
							generating ? 'mb-2.5' : 'mb-0',
						)}
					/>
				) : null}
				{generating ? (
					<div className="flex items-center">
						<Spinner className="mr-2 h-4 w-4 text-textcolor/50" />
						<span className="text-sm text-textcolor/50">
							{t('chat.assistant.generating')}
						</span>
					</div>
				) : null}
			</div>
		</ScrollArea>
	);
}
