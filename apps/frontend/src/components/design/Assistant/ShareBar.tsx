import { Button, Checkbox } from '@ui/index';
import { useI18n } from '@/hooks';
import type { AssistantShareBarProps } from './types';

const DEFAULT_SELECT_ALL_KEY = 'chat.share.selectAll';
const DEFAULT_CREATE_LINK_KEY = 'chat.share.createLink';

/**
 * 助手底栏「分享模式」操作条：全选、已选组数、取消、创建链接。
 * 与 ChatEntry 互斥展示，由父级在 `shareSelection.isSharing` 时挂载。
 */
export function AssistantShareBar({
	messages,
	shareSelection,
	shareFlow,
	setShareModelVisible,
	checkboxId = 'assistant-share-all',
	selectAllLabelKey = DEFAULT_SELECT_ALL_KEY,
	createLinkLabelKey = DEFAULT_CREATE_LINK_KEY,
	className,
}: AssistantShareBarProps) {
	const { t } = useI18n();
	return (
		<div
			className={
				className ?? 'flex w-full items-center justify-between pt-4 pb-4.5'
			}
		>
			<div className="flex flex-1 items-center gap-3 text-textcolor/80">
				<div className="flex items-center">
					<Checkbox
						id={checkboxId}
						checked={shareSelection.isAllChecked(messages)}
						onCheckedChange={(v) => {
							if (v) {
								shareSelection.setAllCheckedMessages(messages);
							} else {
								shareSelection.clearAllCheckedMessages();
							}
						}}
						className="cursor-pointer border-textcolor/60"
					/>
					<label htmlFor={checkboxId} className="text-md ml-2 cursor-pointer">
						{t(selectAllLabelKey)}
					</label>
				</div>
				<div className="border-textcolor/50 h-3 border-l" />
				<div>
					{t('chat.share.selectedPairs', {
						count: shareSelection.selectedPairCount,
					})}
				</div>
			</div>
			<div className="flex items-center gap-3">
				<Button
					variant="outline"
					size="sm"
					className="border-theme"
					onClick={() => {
						shareFlow.onCancelShare();
					}}
				>
					{t('common.cancel')}
				</Button>
				<Button
					variant="dynamic"
					size="sm"
					className="border-theme bg-transparent bg-linear-to-r from-teal-500 to-cyan-600 text-white hover:bg-transparent"
					disabled={shareSelection.checkedMessages.size === 0}
					onClick={() => setShareModelVisible(true)}
				>
					{t(createLinkLabelKey)}
				</Button>
			</div>
		</div>
	);
}
