import Model from '@design/Model';
import { Button, Spinner, Toast } from '@ui/index';
import { CheckCircle, Copy } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useI18n } from '@/hooks';
import {
	appendShareThemeQuery,
	THEMES,
	type ThemeName,
	useTheme,
} from '@/hooks/theme';
import { createShare } from '@/service';
import { ShareInfo } from '@/types';
import { copyToClipboard, getValue } from '@/utils';

export type ShareT = (key: string, params?: Record<string, unknown>) => string;

interface ShareProps {
	open: boolean;
	onOpenChange: () => void;
	checkedMessages: Set<string>;
	/**
	 * 可选：当前会话的展示顺序基准（与 ChatBotView 中 flat 列表 / getDisplayMessages 顺序一致），
	 * 用于稳定 createShare 的 messageIds 顺序；不传则使用 Set 迭代顺序（不可靠）。
	 */
	orderedMessageIds?: string[];
	/** 可选：当不从路由 params 取 sessionId 时由外部注入（例如知识库助手分享） */
	sessionId?: string;
	/** 可选：不传则默认 chat；知识库助手分享建议传 assistant，避免后端走错误回退 */
	sessionType?: 'chat' | 'assistant';
	/** 可选：不传则默认 session；knowledge 表示分享知识文章 */
	shareType?: 'session' | 'knowledge';
	/** i18n 翻译函数（可选）；不传则使用全局 i18n */
	t?: ShareT;
}

const Share: React.FC<ShareProps> = ({
	open,
	onOpenChange,
	checkedMessages,
	orderedMessageIds,
	sessionId,
	sessionType,
	shareType,
	t,
}) => {
	const [shareInfo, setShareInfo] = useState<ShareInfo>();
	const [copied, setCopied] = useState(false);
	const [loading, setLoading] = useState(false);

	const { t: i18nT } = useI18n();
	const tt = t ?? i18nT;

	const { theme } = useTheme();
	const params = useParams();

	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const onCopy = useCallback(
		async (shareUrl: string) => {
			try {
				await navigator.clipboard.writeText(shareUrl);
			} catch {
				await copyToClipboard(shareUrl);
			}
			if (copied) return;
			if (timer.current) {
				clearTimeout(timer.current);
				timer.current = null;
			}
			setCopied(true);
			timer.current = setTimeout(() => setCopied(false), 5000);
		},
		[copied],
	);

	useEffect(() => {
		return () => {
			setShareInfo(undefined);
		};
	}, [open]);

	const onCreateShare = useCallback(async () => {
		setLoading(true);
		const chatSessionId = sessionId ?? params?.id;
		if (!chatSessionId) {
			setLoading(false);
			return;
		}
		const data: {
			chatSessionId: string;
			sessionType?: 'chat' | 'assistant';
			messageIds?: string[];
			baseUrl?: string;
			shareType?: 'session' | 'knowledge';
		} = {
			chatSessionId,
			sessionType,
			shareType,
			baseUrl: import.meta.env.DEV
				? import.meta.env.VITE_DEV_WEB_DOMAIN
				: import.meta.env.VITE_PROD_WEB_DOMAIN, // http://localhost:9226
		};
		if (checkedMessages.size) {
			const selected = [...checkedMessages];
			if (orderedMessageIds?.length) {
				const selectedSet = new Set(selected);
				const orderedSelected = orderedMessageIds.filter((id) =>
					selectedSet.has(id),
				);
				const orderedSet = new Set(orderedSelected);
				const rest = selected.filter((id) => !orderedSet.has(id));
				data.messageIds = [...orderedSelected, ...rest];
			} else {
				data.messageIds = selected;
			}
		}
		const res = await createShare(data);
		setLoading(false);
		if (res.success) {
			// 以 store 为准，避免 useTheme 异步未完成时主题仍是默认值
			const stored = (await getValue('themeType')) as ThemeName;
			const themeName = THEMES.some((t) => t.name === stored) ? stored : theme;
			const shareUrl = appendShareThemeQuery(res.data.shareUrl, themeName);
			setShareInfo({ ...res.data, shareUrl });
			void onCopy(shareUrl);
		} else {
			Toast({
				type: 'error',
				title: res.message,
			});
		}
	}, [
		params?.id,
		checkedMessages,
		orderedMessageIds,
		theme,
		sessionId,
		sessionType,
		shareType,
		onCopy,
	]);

	return (
		<Model
			open={open}
			title={
				shareType === 'knowledge'
					? (tt('share.modal.title.knowledge') ?? '创建文章分享链接')
					: (tt('share.modal.title.session') ?? '创建分享链接')
			}
			width="450px"
			footer={null}
			onOpenChange={onOpenChange}
		>
			<div className="flex flex-col gap-5 overflow-hidden">
				<div className="pt-2 pb-3">
					{tt('share.modal.disclaimer') ??
						'分享链接公开可见，任何人获取后均可查看。请在分享前仔细检查内容，确保不包含敏感信息或隐私数据。'}
				</div>
				{shareInfo?.shareUrl ? (
					<div className="relative border border-theme/20 rounded-md flex items-center h-9.5">
						<div className="truncate pl-3 mr-2">{shareInfo.shareUrl}</div>
						{/* 外部滤镜容器 */}
						<div className="h-full">
							<Button
								variant="dynamic"
								className="text-white rounded-none rounded-r-md border-none h-9.5 w-25 bg-linear-to-r from-teal-500 to-cyan-600"
								disabled={copied}
								onClick={() => onCopy(shareInfo.shareUrl)}
							>
								{copied ? (
									<>
										<CheckCircle className="w-4 h-4 mr-1" />
										{tt('share.modal.copied') ?? '已复制'}
									</>
								) : (
									<>
										<Copy className="w-4 h-4 mr-1" />
										{tt('share.modal.copy') ?? '复制'}
									</>
								)}
							</Button>
						</div>
					</div>
				) : (
					<div className="relative border border-theme/20 rounded-md flex items-center h-9.5">
						<Button
							variant="dynamic"
							className="h-9.5 text-white border-textcolor/30 w-full bg-transparent hover:bg-transparent bg-linear-to-r from-teal-500/80 to-cyan-600/80 hover:from-teal-500 hover:to-cyan-600"
							disabled={loading}
							onClick={onCreateShare}
						>
							{loading ? <Spinner className="text-textcolor" /> : null}
							{tt('share.modal.createAndCopy') ?? '创建并复制链接'}
						</Button>
					</div>
				)}
			</div>
		</Model>
	);
};

export default Share;
