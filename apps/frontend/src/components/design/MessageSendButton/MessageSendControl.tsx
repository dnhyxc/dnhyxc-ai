import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@ui/index';
import { Keyboard, Loader2, Mic, Rocket, Square, Target } from 'lucide-react';
import {
	type MouseEvent,
	type ReactNode,
	useCallback,
	useRef,
	useState,
} from 'react';
import { cn } from '@/lib/utils';
import { MessageSendButton } from './MessageSendButton';

const STOP_WRAP_CLASS =
	'inline-flex mb-1 h-8 w-8 items-center justify-center rounded-full animate-chat-stop-breathe motion-reduce:animate-none';

const STOP_BUTTON_CLASS =
	'lucide-stroke-draw-hover p-0 h-8.5 w-8.5 flex shrink-0 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/20 text-rose-500 hover:bg-rose-500/30 hover:text-rose-500 shadow-none [&_svg]:overflow-visible';

export type MessageSendControlVoiceMenu = {
	disableTextInput?: boolean;
	inputMode: 'text' | 'voice';
	onInputModeChange: (mode: 'text' | 'voice') => void;
	voiceUiActive: boolean;
	voiceRecording: boolean;
	voiceTranscribing: boolean;
	voicePrimaryShowsSend: boolean;
	labels?: {
		inputMode?: string;
		text?: string;
		voice?: string;
	};
};

export type MessageSendControlProps = {
	loading?: boolean;
	/** 与 loading 同时为真时展示停止生成钮 */
	onStop?: () => void;
	stopLabel?: string;
	sendDisabled?: boolean;
	onSend: () => void | Promise<void>;
	sendLabel?: string;
	/** Web 发送禁用时的 title 提示 */
	sendDisabledHint?: string;
	/** 非停止态且 loading 时，发送钮展示 spinner（知识库等） */
	sendLoading?: boolean;
	/** Tauri 语音输入模式菜单；不传则仅展示发送钮 */
	voiceMenu?: MessageSendControlVoiceMenu;
	className?: string;
};

function VoicePrimaryIcon({
	voicePrimaryShowsSend,
	voiceUiActive,
	voiceTranscribing,
	voiceRecording,
}: Pick<
	MessageSendControlVoiceMenu,
	| 'voicePrimaryShowsSend'
	| 'voiceUiActive'
	| 'voiceTranscribing'
	| 'voiceRecording'
>) {
	if (voicePrimaryShowsSend) {
		return <Rocket className="h-4 w-4 -rotate-45" />;
	}
	if (!voiceUiActive) {
		return <Rocket className="h-4 w-4 -rotate-45" />;
	}
	if (voiceTranscribing) {
		return <Loader2 className="h-4 w-4 animate-spin" />;
	}
	if (voiceRecording) {
		return <Square className="h-3.5 w-3.5 fill-current" />;
	}
	return <Mic className="h-4 w-4" />;
}

function MessageStopButton({
	onClick,
	stopLabel = '停止生成',
}: {
	onClick: () => void;
	stopLabel?: string;
}) {
	return (
		<span className={STOP_WRAP_CLASS}>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				aria-label={stopLabel}
				onClick={onClick}
				className={STOP_BUTTON_CLASS}
			>
				<Target
					className={cn(
						'h-4 w-4 shrink-0 text-rose-500/60',
						'animate-chat-stop-icon-breathe motion-reduce:animate-none',
					)}
				/>
			</Button>
		</span>
	);
}

function VoiceMenuSendButton({
	voiceMenu,
	sendDisabled,
	sendLabel,
	onSend,
}: {
	voiceMenu: MessageSendControlVoiceMenu;
	sendDisabled?: boolean;
	sendLabel?: string;
	onSend: () => void | Promise<void>;
}) {
	const {
		disableTextInput,
		inputMode,
		onInputModeChange,
		voiceUiActive,
		voiceRecording,
		voiceTranscribing,
		voicePrimaryShowsSend,
		labels,
	} = voiceMenu;

	const [menuOpen, setMenuOpen] = useState(false);
	const closeTimerRef = useRef<number | null>(null);

	const clearCloseTimer = useCallback(() => {
		if (closeTimerRef.current !== null) {
			window.clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
	}, []);

	const scheduleCloseMenu = useCallback(() => {
		clearCloseTimer();
		closeTimerRef.current = window.setTimeout(() => {
			closeTimerRef.current = null;
			setMenuOpen(false);
		}, 220);
	}, [clearCloseTimer]);

	const openMenu = useCallback(() => {
		if (disableTextInput) return;
		clearCloseTimer();
		setMenuOpen(true);
	}, [clearCloseTimer, disableTextInput]);

	const handleMenuOpenChange = useCallback(
		(next: boolean) => {
			if (disableTextInput) {
				setMenuOpen(false);
				return;
			}
			setMenuOpen(next);
		},
		[disableTextInput],
	);

	const handlePrimaryClick = (e: MouseEvent<HTMLButtonElement>) => {
		e.stopPropagation();
		setMenuOpen(false);
		void onSend();
	};

	return (
		<DropdownMenu
			modal={false}
			open={disableTextInput ? false : menuOpen}
			onOpenChange={handleMenuOpenChange}
		>
			<DropdownMenuTrigger asChild>
				<MessageSendButton
					className={cn(
						voiceUiActive && voiceRecording && 'animate-pulse ring-teal-400/60',
					)}
					onPointerEnter={disableTextInput ? undefined : openMenu}
					onPointerLeave={disableTextInput ? undefined : scheduleCloseMenu}
					onClick={handlePrimaryClick}
					disabled={sendDisabled}
					sendLabel={sendLabel}
				>
					<VoicePrimaryIcon
						voicePrimaryShowsSend={voicePrimaryShowsSend}
						voiceUiActive={voiceUiActive}
						voiceTranscribing={voiceTranscribing}
						voiceRecording={voiceRecording}
					/>
				</MessageSendButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				side="top"
				align="end"
				sideOffset={6}
				className="min-w-26"
				onPointerEnter={clearCloseTimer}
				onPointerLeave={scheduleCloseMenu}
				onCloseAutoFocus={(e) => e.preventDefault()}
			>
				<DropdownMenuLabel className="text-xs font-normal text-textcolor/60">
					{labels?.inputMode ?? '输入模式'}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className={cn(
						'gap-2',
						inputMode === 'text' &&
							'text-teal-500 focus:text-teal-500 data-highlighted:text-teal-500',
					)}
					onSelect={() => onInputModeChange('text')}
				>
					<Keyboard
						className={cn(
							'h-3.5 w-3.5 shrink-0 text-textcolor/95',
							inputMode === 'text' && 'text-teal-500',
						)}
					/>
					{labels?.text ?? '文本输入'}
				</DropdownMenuItem>
				<DropdownMenuItem
					className={cn(
						'gap-2',
						inputMode === 'voice' &&
							'text-teal-500 focus:text-teal-500 data-highlighted:text-teal-500',
					)}
					onSelect={() => onInputModeChange('voice')}
				>
					<Mic
						className={cn(
							'h-3.5 w-3.5 shrink-0 text-textcolor/95',
							inputMode === 'voice' && 'text-teal-500',
						)}
					/>
					{labels?.voice ?? '语音输入'}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function MessageSendControl({
	loading,
	onStop,
	stopLabel,
	sendDisabled,
	onSend,
	sendLabel = '发送',
	sendDisabledHint,
	sendLoading,
	voiceMenu,
	className,
}: MessageSendControlProps) {
	if (loading && onStop) {
		return <MessageStopButton onClick={onStop} stopLabel={stopLabel} />;
	}

	const sendButton: ReactNode = voiceMenu ? (
		<VoiceMenuSendButton
			voiceMenu={voiceMenu}
			sendDisabled={sendDisabled}
			sendLabel={sendLabel}
			onSend={onSend}
		/>
	) : (
		<MessageSendButton
			title={sendDisabled ? sendDisabledHint : undefined}
			sendLabel={sendLabel}
			onClick={() => void onSend()}
			disabled={sendDisabled}
			loading={sendLoading}
		/>
	);

	return (
		<div className={cn('mb-1 flex items-center gap-1', className)}>
			{sendButton}
		</div>
	);
}

export default MessageSendControl;
