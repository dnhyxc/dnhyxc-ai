import Model from '@design/Model';
import { Button, Spinner, Toast } from '@ui/index';
import { CheckCircle, Copy } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import {
	appendShareThemeQuery,
	THEMES,
	type ThemeName,
	useTheme,
} from '@/hooks/theme';
import { createShare } from '@/service';
import { ShareInfo } from '@/types';
import { copyToClipboard, getValue } from '@/utils';

interface ShareProps {
	open: boolean;
	onOpenChange: () => void;
	checkedMessages: Set<string>;
}

const Share: React.FC<ShareProps> = ({
	open,
	onOpenChange,
	checkedMessages,
}) => {
	const [shareInfo, setShareInfo] = useState<ShareInfo>();
	const [copied, setCopied] = useState(false);
	const [loading, setLoading] = useState(false);

	const { theme } = useTheme();
	const params = useParams();

	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			setShareInfo(undefined);
		};
	}, [open]);

	const onCreateShare = useCallback(async () => {
		setLoading(true);
		const chatSessionId = params?.id;
		if (chatSessionId) {
			const data: {
				chatSessionId: string;
				messageIds?: string[];
				baseUrl?: string;
			} = {
				chatSessionId,
				baseUrl: 'http://localhost:9002', // http://localhost:9226
			};
			if (checkedMessages.size) {
				data.messageIds = [...checkedMessages];
			}
			const res = await createShare(data);
			setLoading(false);
			if (res.success) {
				// 以 store 为准，避免 useTheme 异步未完成时主题仍是默认值
				const stored = (await getValue('themeType')) as ThemeName;
				const themeName = THEMES.some((t) => t.name === stored)
					? stored
					: theme;
				const shareUrl = appendShareThemeQuery(res.data.shareUrl, themeName);
				setShareInfo({ ...res.data, shareUrl });
				onCopy(shareUrl);
			} else {
				Toast({
					type: 'error',
					title: res.message,
				});
			}
		}
	}, [params?.id, checkedMessages, theme]);

	const onCopy = async (shareUrl: string) => {
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
	};

	return (
		<Model
			open={open}
			title="创建分享链接"
			width="450px"
			footer={null}
			onOpenChange={onOpenChange}
		>
			<div className="flex flex-col gap-5 overflow-hidden">
				<div>
					分享链接公开可见，任何人获取后均可查看。请在分享前仔细检查对话内容，确保不包含敏感信息或隐私数据。
				</div>
				{shareInfo?.shareUrl ? (
					<div className="relative border border-theme/20 rounded-md flex items-center">
						<div className="truncate pl-3 mr-2">{shareInfo.shareUrl}</div>
						{/* 外部滤镜容器 */}
						<div className=" h-full">
							<Button
								variant="outline"
								className="rounded-none rounded-r-md border-none h-full w-25 bg-linear-to-r from-teal-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-600 "
								disabled={copied}
								onClick={() => onCopy(shareInfo.shareUrl)}
							>
								{copied ? (
									<>
										<CheckCircle className="w-4 h-4 mr-1" />
										已复制
									</>
								) : (
									<>
										<Copy className="w-4 h-4 mr-1" />
										复制
									</>
								)}
							</Button>
						</div>
					</div>
				) : (
					<Button
						variant="outline"
						className="border-textcolor/30 w-full bg-transparent hover:bg-transparent bg-linear-to-r from-teal-500/80 to-cyan-600/80 hover:from-teal-500 hover:to-cyan-600"
						disabled={loading}
						onClick={onCreateShare}
					>
						{loading ? <Spinner className="text-textcolor" /> : null}
						创建并复制链接
					</Button>
				)}
			</div>
		</Model>
	);
};

export default Share;
