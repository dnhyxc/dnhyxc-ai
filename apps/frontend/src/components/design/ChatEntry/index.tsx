import ChatFileList from '@design/ChatFileList';
import ChatTextArea from '@design/ChatTextArea';
import Upload from '@design/Upload';
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	ScrollArea,
	ScrollBar,
} from '@ui/index';
import { Toast } from '@ui/sonner';
import {
	ChevronFirst,
	ChevronLast,
	CirclePlus,
	Globe,
	Keyboard,
	Link,
	Loader2,
	Mic,
	Rocket,
	Square,
	Target,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHAT_VALIDTYPES } from '@/constant';
import { cn } from '@/lib/utils';
import { transcribeSpeechAudio } from '@/service';
import { FileWithPreview, UploadedFile } from '@/types';
import { Message } from '@/types/chat';
import {
	formatGetUserMediaError,
	patchNavigatorMediaDevices,
} from '@/utils/navigatorMediaDevices';
import { isTauriRuntime } from '@/utils/runtime';

/**
 * Tauri 增量 ASR：由 MediaRecorder.ondataavailable 驱动尝试转写（有数据才跑），
 * 首轮/后续用不同体积门槛折中出字速度与 WebM 稳定性。
 */
/** 尚未成功送过一轮转写时（lastSent===0），用较小体积尽快触发首次识别 */
const TAURI_LIVE_MIN_BYTES_FIRST = 4800;
/** 已有转写基线后，用较大体积减轻不完整容器带来的错字 */
const TAURI_LIVE_MIN_BYTES_STEADY = 7800;
/** 相对上次上传体积的最小增量（仅第二轮起生效） */
const TAURI_LIVE_MIN_GROWTH_STEADY = 2800;

/**
 * 无法使用麦克风时的说明（多为「非安全上下文」：HTTP + 局域网 IP）
 * Tauri WebView 可能错误上报 isSecureContext，故壳内不在此拦截，交给 getUserMedia 实测。
 * 返回 null 表示可尝试请求麦克风。
 */
function getMicrophoneUnavailableReason(): string | null {
	if (typeof window === 'undefined') return null;

	patchNavigatorMediaDevices();

	// 桌面壳内由系统权限与 WKWebView 决定，避免仅靠 isSecureContext 误判
	if (!isTauriRuntime() && !window.isSecureContext) {
		const { protocol, hostname, port } = window.location;
		const p = port ? `${port}` : '';
		if (
			protocol === 'http:' &&
			hostname !== 'localhost' &&
			hostname !== '127.0.0.1'
		) {
			return `麦克风仅在「安全页面」可用：你用 ${protocol}//${hostname}${p ? `:${p}` : ''}（局域网 IP）通过 HTTP 打开时，浏览器会禁用麦克风。请在本机用地址栏输入 http://localhost${p ? `:${p}` : ':9002'} 访问（与 vite 端口一致），或部署 HTTPS。`;
		}
		return '当前页面不是安全上下文，请使用 HTTPS，或通过 http://localhost / http://127.0.0.1 访问本地开发服务。';
	}

	if (!navigator.mediaDevices?.getUserMedia) {
		return '浏览器未提供麦克风接口（mediaDevices.getUserMedia）。请使用 Chrome / Edge 最新版；若在桌面壳内仍失败，请更新应用或联系开发者检查 WebView 权限。';
	}

	return null;
}

/** 获取麦克风音频流（先补丁前缀 API，再走标准 mediaDevices） */
async function getAudioMediaStream(): Promise<MediaStream> {
	patchNavigatorMediaDevices();
	if (!navigator.mediaDevices?.getUserMedia) {
		throw new Error('NO_GET_USER_MEDIA');
	}
	try {
		return await navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
				channelCount: { ideal: 1 },
			},
		});
	} catch (err) {
		// 部分 WebView 不支持组合约束时降级为默认麦克风
		if (err instanceof DOMException && err.name === 'OverconstrainedError') {
			return navigator.mediaDevices.getUserMedia({ audio: true });
		}
		throw err;
	}
}

/** Tauri 壳内麦克风失败时追加系统/构建说明 */
function withTauriMicNote(message: string): string {
	if (!isTauriRuntime()) return message;
	return `${message}（Tauri 桌面：请在系统设置「隐私与安全性」→「麦克风」中允许本应用；macOS 需在 Info.plist 声明 NSMicrophoneUsageDescription 并重新执行 tauri dev 或打包。）`;
}

export type ChatEntryT = (
	key: string,
	params?: Record<string, unknown>,
) => string;

interface ChatEntryProps {
	input: string;
	setInput: (val: string) => void;
	uploadedFiles?: UploadedFile[];
	setUploadedFiles?: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
	loading?: boolean;
	editMessage?: Message | null;
	setEditMessage?: (msg: Message | null) => void;
	handleEditChange?: (
		e: React.ChangeEvent<HTMLTextAreaElement> | string,
	) => void;
	sendMessage: (
		content?: string,
		index?: number,
		isEdit?: boolean,
		attachments?: any,
	) => void;
	onUploadFile?: (data: FileWithPreview | FileWithPreview[]) => Promise<void>;
	clearChat?: () => void;
	stopGenerating?: () => void;
	chatInputRef?: React.RefObject<HTMLTextAreaElement | null>; // 新增
	children?: React.ReactNode;
	entryChildren?: React.ReactNode;
	className?: string;
	uploadLoading?: boolean;
	/** 是否启用 Serper 联网搜索（由后端注入检索上下文） */
	webSearchEnabled?: boolean;
	onWebSearchEnabledChange?: (enabled: boolean) => void;
	/** 文本域样式 */
	textareaClassName?: string;
	/** 为 true 时禁用底部输入框（知识库：左侧编辑器无正文时禁止在助手框输入） */
	disableTextInput?: boolean;
	placeholder?: string;
	/** i18n 翻译函数（可选）；不传则沿用组件内默认中文文案 */
	t?: ChatEntryT;
}

const ChatEntry: React.FC<ChatEntryProps> = ({
	input,
	setInput,
	uploadedFiles,
	setUploadedFiles,
	loading,
	editMessage,
	setEditMessage,
	handleEditChange,
	sendMessage,
	onUploadFile,
	clearChat,
	stopGenerating,
	chatInputRef,
	children,
	entryChildren,
	className,
	uploadLoading,
	webSearchEnabled = false,
	onWebSearchEnabledChange,
	textareaClassName,
	disableTextInput = false,
	placeholder: placeholderProp,
	t,
}) => {
	const scrollContainer = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
	// 记录当前聚焦/锚点的索引，初始为 0
	const [currentIndex, setCurrentIndex] = useState(0);
	// 新增：记录滚动位置状态 (用于禁用判断)
	const [scrollState, setScrollState] = useState({
		left: 0,
		width: 0,
		clientWidth: 0,
	});

	/**
	 * 动态计算当前索引 & 更新滚动位置状态
	 */
	const handleScrollUpdate = () => {
		const container = scrollContainer.current;
		if (!container) return;

		// 更新所有滚动相关状态
		setScrollState({
			left: container.scrollLeft,
			width: container.scrollWidth,
			clientWidth: container.clientWidth,
		});

		// ... 锚点索引计算逻辑保持不变 ...
		const containerLeft = container.getBoundingClientRect().left;
		for (let i = 0; i < itemRefs.current.length; i++) {
			const node = itemRefs.current[i];
			if (node) {
				const rect = node.getBoundingClientRect();
				if (rect.left >= containerLeft - 1) {
					setCurrentIndex(i);
					return;
				}
			}
		}
		if (itemRefs.current.length > 0) {
			setCurrentIndex(itemRefs.current.length - 1);
		}
	};

	const onJumpTo = useCallback(
		(position: 'left' | 'right') => {
			if (position === 'left') {
				const nextIndex = currentIndex - 1;
				setCurrentIndex(nextIndex);
				const targetNode = itemRefs.current[nextIndex];
				if (targetNode) {
					// scrollIntoView 是最简单的锚点实现方式
					// block: 'nearest' 防止垂直滚动，inline: 'start' 强制左对齐
					targetNode.scrollIntoView({
						behavior: 'smooth',
						inline: 'start',
						block: 'nearest',
					});
				}
			} else {
				const nextIndex = currentIndex + 1;
				setCurrentIndex(nextIndex);
				const targetNode = itemRefs.current[nextIndex];
				if (targetNode) {
					// 将目标元素移动到最左侧
					targetNode.scrollIntoView({
						behavior: 'smooth',
						inline: 'start',
						block: 'nearest',
					});
				}
			}
		},
		[currentIndex],
	);

	// 计算是否可以继续滚动
	// scrollLeft 为 0 表示在最左侧，scrollLeft + clientWidth >= scrollWidth 表示在最右侧 (允许 1px 误差)
	const isAtStart = scrollState.left <= 0;
	const isAtEnd =
		scrollState.width > scrollState.clientWidth &&
		scrollState.left + scrollState.clientWidth >= scrollState.width - 1;

	/** 主发送区：文本（默认）或语音转写回填 */
	const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
	const [voiceRecording, setVoiceRecording] = useState(false);
	const [voiceTranscribing, setVoiceTranscribing] = useState(false);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const mediaChunksRef = useRef<BlobPart[]>([]);
	const mediaStreamRef = useRef<MediaStream | null>(null);
	/** 开始本条语音会话前输入框已有内容（前缀），实时识别结果追加在其后 */
	const voiceBaseRef = useRef('');
	const voiceRecordingRef = useRef(false);
	const tauriLivePollBusyRef = useRef(false);
	/** 递增即可使进行中的 live 转写在返回后放弃写入（停录/卸载/新会话） */
	const tauriLiveEpochRef = useRef(0);
	/** 本轮录音已尝试上传时的 Blob 体积，用于要求「新增足够音频」再请求，省接口次数 */
	const tauriLiveLastSentBytesRef = useRef(0);
	/** 上一次 live 回填的纯文本，避免与后端返回相同内容时反复 setInput */
	const tauriLiveLastTextRef = useRef('');
	/** Tauri：悬停发送钮时展开输入模式菜单 */
	const [inputModeMenuOpen, setInputModeMenuOpen] = useState(false);
	const closeInputModeMenuTimerRef = useRef<number | null>(null);

	const clearCloseInputModeMenuTimer = useCallback(() => {
		if (closeInputModeMenuTimerRef.current !== null) {
			window.clearTimeout(closeInputModeMenuTimerRef.current);
			closeInputModeMenuTimerRef.current = null;
		}
	}, []);

	const scheduleCloseInputModeMenu = useCallback(() => {
		clearCloseInputModeMenuTimer();
		closeInputModeMenuTimerRef.current = window.setTimeout(() => {
			closeInputModeMenuTimerRef.current = null;
			setInputModeMenuOpen(false);
		}, 220);
	}, [clearCloseInputModeMenuTimer]);

	const openInputModeMenu = useCallback(() => {
		if (disableTextInput) return;
		clearCloseInputModeMenuTimer();
		setInputModeMenuOpen(true);
	}, [clearCloseInputModeMenuTimer, disableTextInput]);

	const handleInputModeMenuOpenChange = useCallback(
		(next: boolean) => {
			if (disableTextInput) {
				setInputModeMenuOpen(false);
				return;
			}
			setInputModeMenuOpen(next);
		},
		[disableTextInput],
	);

	const runTauriLiveTranscribePoll = useCallback(async () => {
		if (!isTauriRuntime()) return;
		if (!voiceRecordingRef.current) return;
		if (tauriLivePollBusyRef.current) return;
		const epochAtStart = tauriLiveEpochRef.current;
		const rec = mediaRecorderRef.current;
		if (!rec || rec.state !== 'recording') return;

		const chunks = mediaChunksRef.current;
		if (chunks.length === 0) return;

		try {
			rec.requestData?.();
		} catch {
			/* 忽略 */
		}

		const blob = new Blob([...chunks], {
			type: rec.mimeType || 'audio/webm',
		});
		const lastSent = tauriLiveLastSentBytesRef.current;
		const minBytes =
			lastSent === 0 ? TAURI_LIVE_MIN_BYTES_FIRST : TAURI_LIVE_MIN_BYTES_STEADY;
		// 过小的片段许多 ASR 无法解码；未完成 webm 也可能失败（静默忽略）
		if (blob.size < minBytes) return;
		if (lastSent > 0 && blob.size - lastSent < TAURI_LIVE_MIN_GROWTH_STEADY)
			return;

		tauriLivePollBusyRef.current = true;
		try {
			const res = await transcribeSpeechAudio(blob, `live-${Date.now()}.webm`);
			if (epochAtStart !== tauriLiveEpochRef.current) return;
			if (!voiceRecordingRef.current || rec.state !== 'recording') return;
			const payload = res?.data as { text?: string } | undefined;
			const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
			// 本轮快照已消费：推进体积基线，避免同一段反复请求；失败同理等待更多音频再试
			const bumpSent = () => {
				tauriLiveLastSentBytesRef.current = blob.size;
			};
			if (!text) {
				bumpSent();
				return;
			}
			if (text === tauriLiveLastTextRef.current) {
				bumpSent();
				return;
			}
			tauriLiveLastTextRef.current = text;
			bumpSent();
			const base = voiceBaseRef.current;
			// 不用 startTransition：语音回填走高优先级更新，降低「出字慢一拍」体感
			setInput(base ? `${base} ${text}`.trim() : text);
		} catch {
			tauriLiveLastSentBytesRef.current = blob.size;
			/* 未完成容器或非完整编码时接口可能失败，静默等待更多音频后再试 */
		} finally {
			tauriLivePollBusyRef.current = false;
		}
	}, [setInput]);

	const pickRecorderMimeType = useCallback((): string => {
		if (typeof MediaRecorder === 'undefined') return '';
		const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
		return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
	}, []);

	const stopMediaTracks = useCallback(() => {
		mediaStreamRef.current?.getTracks().forEach((tr) => {
			tr.stop();
		});
		mediaStreamRef.current = null;
	}, []);

	/**
	 * 启动语音录制与实时转写流程（仅 Tauri 环境下可用）。
	 * 1. 校验环境及权限，弹窗反馈无法录音的原因
	 * 2. 记录当前输入文本作为语音内容前缀
	 * 3. 初始化 MediaRecorder，设置录音格式和码率，绑定数据事件
	 * 4. 短 timeslice 启动 MediaRecorder，在 ondataavailable 中累积分片并触发 live 转写尝试
	 */
	const startVoiceCapture = useCallback(async () => {
		// 1. 仅在浏览器环境下，Tauri 壳内允许启动语音输入，否则直接返回
		if (typeof navigator === 'undefined') return;
		if (!isTauriRuntime()) return;
		if (disableTextInput) return;

		// 2. 检查麦克风使用可用性（安全上下文、接口存在性等），如不可用直接提示用户
		const micBlocked = getMicrophoneUnavailableReason();
		if (micBlocked) {
			Toast({
				type: 'error',
				title: withTauriMicNote(micBlocked),
			});
			return;
		}

		// 将当前输入内容作为语音识别前缀（前置文本），稍后回填时拼接使用
		voiceBaseRef.current = input.trim();

		// 3. 仅在支持 MediaRecorder 的环境下启动，防御 Safari/小众浏览器等兼容性问题
		if (typeof MediaRecorder === 'undefined') {
			Toast({
				type: 'error',
				title:
					t?.('chat.entry.voice.noRecorder') ??
					'当前浏览器不支持 MediaRecorder 录音',
			});
			return;
		}

		try {
			// 4. 异步获取麦克风音频流（带回声消除等约束）
			const stream = await getAudioMediaStream();
			mediaStreamRef.current = stream;
			// 初始化音频分片列表
			mediaChunksRef.current = [];

			// 5. 根据支持的 mimeType 选出最佳音频格式，并设定较高录音码率（便于语音识别），优先用高码率，退而求其次
			const mimeType = pickRecorderMimeType();
			let recorder: MediaRecorder;
			const withBitrate: MediaRecorderOptions = {
				...(mimeType ? { mimeType } : {}),
				audioBitsPerSecond: 128_000,
			};
			try {
				recorder = new MediaRecorder(stream, withBitrate);
			} catch {
				// 某些浏览器新参数不兼容时降级
				try {
					recorder = new MediaRecorder(
						stream,
						mimeType ? { mimeType } : undefined,
					);
				} catch (err) {
					// 创建失败需及时释放流资源、防止设备被“锁住”，弹窗反馈
					stopMediaTracks();
					Toast({
						type: 'error',
						title:
							t?.('chat.entry.voice.noRecorder') ??
							`无法创建录音器：${err instanceof Error ? err.message : String(err)}`,
					});
					return;
				}
			}

			// 6. 先置会话标记，避免极少数环境下 start 同步触发 ondataavailable 时 poll 误判未在录
			voiceRecordingRef.current = true;
			setVoiceRecording(true);
			tauriLiveEpochRef.current += 1;
			tauriLiveLastSentBytesRef.current = 0;
			tauriLiveLastTextRef.current = '';

			// 7. 绑定 recorder：分片到达即尝试转写（无 setInterval 空转；门槛与 busy 在 poll 内处理）
			mediaRecorderRef.current = recorder;
			recorder.ondataavailable = (ev) => {
				if (ev.data.size > 0) {
					mediaChunksRef.current.push(ev.data);
				}
				void runTauriLiveTranscribePoll();
			};
			// 8. 较短 timeslice → ondataavailable 更密，有增量即可能触发转写
			recorder.start(280);
		} catch (err) {
			// 捕获“用户拒绝”或“硬件/环境错误”，弹窗告知，同时增加定制麦克风说明
			const base =
				t?.('chat.entry.voice.micDenied') ?? formatGetUserMediaError(err);
			Toast({
				type: 'error',
				title: withTauriMicNote(base),
			});
		}
	}, [
		input,
		pickRecorderMimeType,
		runTauriLiveTranscribePoll,
		stopMediaTracks,
		t,
		disableTextInput,
	]);

	/**
	 * finalizeVoiceAndTranscribe
	 * 停录收尾（用于「点击完成录音」）：停止 MediaRecorder、释放麦克风流与分片缓存。
	 * 识别结果仅依赖 ondataavailable 驱动的 live 转写（transcribeSpeechAudio），此处不再整段请求。
	 * 流程要点：递增 epoch 丢弃进行中的 live 异步回写；voiceRecordingRef/recorder 清理与 sendMessage 前 discard 一致。
	 */
	const finalizeVoiceAndTranscribe = useCallback(async () => {
		tauriLiveEpochRef.current += 1;
		voiceRecordingRef.current = false;

		const recorder = mediaRecorderRef.current;
		if (!recorder || recorder.state === 'inactive') {
			setVoiceRecording(false);
			stopMediaTracks();
			return;
		}

		await new Promise<void>((resolve) => {
			recorder.addEventListener('stop', () => resolve(), { once: true });
			recorder.stop();
		});

		mediaChunksRef.current = [];
		mediaRecorderRef.current = null;
		stopMediaTracks();
		setVoiceRecording(false);
		chatInputRef?.current?.focus();
	}, [chatInputRef, stopMediaTracks]);

	/**
	 * 停止当前语音识别会话：关菜单、停录并丢弃未完成音频（不调用转写接口）；不改变输入模式（仍为语音时可继续点麦开录）。
	 * 用于发送后 / 清空输入框等场景，与 finalizeVoiceAndTranscribe（停录收尾、不整段转写）分离。
	 */
	const discardActiveVoiceCapture = useCallback(async () => {
		if (!isTauriRuntime()) return;
		const needsTeardown =
			voiceRecordingRef.current ||
			voiceRecording ||
			voiceTranscribing ||
			mediaRecorderRef.current?.state === 'recording';
		if (!needsTeardown) return;

		tauriLiveEpochRef.current += 1;
		clearCloseInputModeMenuTimer();
		setInputModeMenuOpen(false);
		voiceRecordingRef.current = false;

		const recorder = mediaRecorderRef.current;
		if (recorder && recorder.state !== 'inactive') {
			await new Promise<void>((resolve) => {
				recorder.addEventListener('stop', () => resolve(), { once: true });
				recorder.stop();
			});
		}
		mediaChunksRef.current = [];
		mediaRecorderRef.current = null;
		stopMediaTracks();
		setVoiceRecording(false);
		setVoiceTranscribing(false);
	}, [
		clearCloseInputModeMenuTimer,
		stopMediaTracks,
		voiceRecording,
		voiceTranscribing,
	]);

	/**
	 * 发送消息并重置语音状态：
	 * 1. 主用于「语音输入模式」下，用户点击发送按钮时，
	 *    保证在发送文本内容前，先彻底关闭/清理掉可能的录音会话和 ASR 状态
	 *    —— 避免残留的 MediaRecorder 或 ASR 进程影响后续输入体验。
	 * 2. 调用 discardActiveVoiceCapture()，其会：停掉录音、丢弃未转写内容、关闭菜单，复位所有语音相关数据。
	 * 3. 然后实际触发 sendMessage（继续使用当前输入框内容及可选参数）。
	 *
	 * @param content    消息正文（可缺省，若无则用当前 input 状态）
	 * @param index      编辑时指定修改哪一条消息（可选）
	 * @param isEdit     是否为编辑操作（可选）
	 * @param attachments 附件（如文件/图片，可选）
	 */
	const sendMessageWithVoiceReset = useCallback(
		async (
			content?: string,
			index?: number,
			isEdit?: boolean,
			attachments?: any,
		) => {
			// 发送前先终止并清理录音/语音状态，保证不会有悬挂的录音会话
			await discardActiveVoiceCapture();
			// 调用主发送方法，完成文本/附件正式发送
			sendMessage(content, index, isEdit, attachments);
		},
		[discardActiveVoiceCapture, sendMessage],
	);

	useEffect(() => {
		return () => {
			tauriLiveEpochRef.current += 1;
			clearCloseInputModeMenuTimer();
			stopMediaTracks();
			if (mediaRecorderRef.current?.state === 'recording') {
				mediaRecorderRef.current.stop();
			}
		};
	}, [clearCloseInputModeMenuTimer, stopMediaTracks]);

	useEffect(() => {
		if (!isTauriRuntime()) setInputMode('text');
	}, []);

	/** 无正文（disableTextInput）时收起模式菜单；空闲语音态切回文本，避免麦钮被禁用后无法悬停打开菜单 */
	useEffect(() => {
		if (!disableTextInput) return;
		setInputModeMenuOpen(false);
		clearCloseInputModeMenuTimer();
		if (
			isTauriRuntime() &&
			inputMode === 'voice' &&
			!voiceRecording &&
			!voiceTranscribing
		) {
			setInputMode('text');
		}
	}, [
		clearCloseInputModeMenuTimer,
		disableTextInput,
		inputMode,
		voiceRecording,
		voiceTranscribing,
	]);

	/** Tauri：输入从非空变为空时停止当前录音/转写（保持语音输入模式） */
	const prevInputTrimRef = useRef('');
	useEffect(() => {
		if (!isTauriRuntime()) {
			prevInputTrimRef.current = input.trim();
			return;
		}
		const prev = prevInputTrimRef.current;
		const cur = input.trim();
		const hasActiveVoiceSession =
			voiceRecordingRef.current ||
			voiceRecording ||
			voiceTranscribing ||
			mediaRecorderRef.current?.state === 'recording';
		if (prev.length > 0 && cur.length === 0 && hasActiveVoiceSession) {
			void discardActiveVoiceCapture();
		}
		prevInputTrimRef.current = cur;
	}, [input, discardActiveVoiceCapture, voiceRecording, voiceTranscribing]);

	/**
	 * 主发送按钮/语音按钮的操作逻辑，细致覆盖文本与语音模式下各种情形。
	 */
	const handleSendOrVoicePrimary = useCallback(async () => {
		// 若非 Tauri 环境（如网页）、或当前为文本输入模式
		if (!isTauriRuntime() || inputMode === 'text') {
			// 如果文本输入被禁用则直接返回，不做任何操作
			if (disableTextInput) return;
			// 发送消息，并重置语音相关状态
			await sendMessageWithVoiceReset();
			// 重新聚焦到输入框
			chatInputRef?.current?.focus();
			return;
		}
		// Tauri + 语音输入模式
		// 若当前正在语音转写（识别中），按钮不可点击，直接返回（防止重复触发）
		if (voiceTranscribing) return;
		// 若正在录音，按钮视为“停止录制并转写”
		if (voiceRecording) {
			await finalizeVoiceAndTranscribe();
			return;
		}
		// 此处已是语音模式空闲状态
		// 禁用文本输入时，此按钮应不可响应
		if (disableTextInput) return;
		// 若输入框当前已有内容（由语音识别或手动输入），主按钮视为“发送”
		if (input.trim()) {
			// 如果输入框中已有内容（可能来源于语音识别或手动输入），点击主按钮则发送消息，并重置语音相关状态
			await sendMessageWithVoiceReset();
			// 发送后重新聚焦输入框，方便用户继续输入
			chatInputRef?.current?.focus();
			return;
		}
		// 以上条件都未命中，发起新的语音捕获
		await startVoiceCapture();
	}, [
		chatInputRef,
		disableTextInput,
		finalizeVoiceAndTranscribe,
		input,
		inputMode,
		sendMessageWithVoiceReset,
		startVoiceCapture,
		voiceRecording,
		voiceTranscribing,
	]);

	const voiceUiActive = isTauriRuntime() && inputMode === 'voice';
	/** 语音模式空闲但输入框有内容时，主按钮展示为发送 */
	const voicePrimaryShowsSend =
		voiceUiActive &&
		!voiceRecording &&
		!voiceTranscribing &&
		input.trim() !== '';

	// 主发送钮禁用条件（分支顺序与原先嵌套三元一致，勿调换）
	const sendDisabled = useMemo(() => {
		const busy = loading ?? false;
		const locked = disableTextInput ?? false;
		const empty = !input.trim();

		// 非语音 UI：等同纯文本发送区
		if (!voiceUiActive) {
			return busy || empty || locked;
		}
		// 录音或识别中：允许停录故不因无字禁用；识别中时防重复触发
		if (voiceRecording || voiceTranscribing) {
			return busy || voiceTranscribing;
		}
		// 语音模式空闲且输入框已有字：主钮为「发送」
		if (voicePrimaryShowsSend) {
			return busy || empty || locked;
		}
		// 语音模式空闲且无字：主钮为开麦，仅受锁与 loading 影响
		return locked || busy;
	}, [
		disableTextInput,
		input,
		loading,
		voiceRecording,
		voicePrimaryShowsSend,
		voiceTranscribing,
		voiceUiActive,
	]);

	const defaultPlaceholder =
		placeholderProp ?? t?.('chat.entry.placeholder') ?? '请输入您的问题';

	const liveListeningPlaceholder =
		t?.('chat.entry.voice.liveListening') ??
		'聆听中，识别文字将填入此处（约每秒更新）…';

	const chatTextAreaPlaceholder =
		voiceUiActive && voiceRecording
			? liveListeningPlaceholder
			: defaultPlaceholder;

	return (
		<div className={cn('relative p-5.5 pt-0 backdrop-blur-sm', className)}>
			<div className="max-w-3xl mx-auto flex">
				<div className="flex-1 relative">
					{children}
					<div className="max-w-3xl flex flex-col overflow-y-auto rounded-md bg-theme/2 border border-theme/10">
						{uploadedFiles && uploadedFiles?.length > 0 ? (
							<div className="flex flex-1 flex-col rounded-md">
								<div className="flex justify-between items-center mt-2.5 mb-0.5 px-3 text-sm text-textcolor/70">
									{t?.('chat.entry.attachments.textOnlyHint') ??
										'只识别附件中的文字'}
									<div className="flex gap-3">
										<Button
											disabled={isAtStart}
											onClick={() => onJumpTo('left')}
											className={cn(
												'items-center w-6 h-6 rounded-md bg-theme/5 hover:bg-theme/20 p-2 shadow-md',
											)}
										>
											<ChevronFirst className="text-textcolor" />
										</Button>
										{/* 右侧箭头：点击后，将下一个元素滚动到最左侧 */}
										<Button
											disabled={isAtEnd}
											onClick={() => onJumpTo('right')}
											className={cn(
												'items-center w-6 h-6 rounded-md bg-theme/5 hover:bg-theme/20 p-2 shadow-md',
											)}
										>
											<ChevronLast className="text-textcolor" />
										</Button>
									</div>
								</div>
								<div className="w-full px-3 group">
									<ScrollArea
										ref={scrollContainer}
										className="relative max-w-3xl rounded-md"
										onScroll={handleScrollUpdate}
									>
										<div className="flex items-center rounded-md">
											{/* 左侧箭头：点击后，将上一个元素滚动到最左侧 */}

											<div className="flex mb-2 gap-3">
												{uploadedFiles.map((i, index) => (
													<div
														key={i.id || index}
														ref={(el) => {
															itemRefs.current[index] = el;
														}}
													>
														<ChatFileList
															data={i}
															showDelete
															setUploadedFiles={setUploadedFiles}
															className="mt-3 shrink-0"
														/>
													</div>
												))}
											</div>
										</div>
										<ScrollBar orientation="horizontal" />
									</ScrollArea>
								</div>
							</div>
						) : null}

						{/* 复用 ChatTextArea 组件 */}
						<ChatTextArea
							ref={chatInputRef}
							mode="chat"
							placeholder={chatTextAreaPlaceholder}
							input={input}
							setInput={setInput}
							editMessage={editMessage}
							setEditMessage={setEditMessage}
							loading={loading}
							handleEditChange={handleEditChange}
							sendMessage={sendMessageWithVoiceReset}
							textareaClassName={textareaClassName}
							disableTextInput={disableTextInput}
							t={t}
						/>

						<div className="flex items-center justify-between h-10 p-2.5 mb-1 mt-2.5">
							<div className="flex items-center gap-2">
								{entryChildren ? entryChildren : null}
								{clearChat && (
									<Button
										variant="ghost"
										className="lucide-stroke-draw-hover flex items-center text-sm bg-theme/5 mb-1 h-8 rounded-md [&_svg]:overflow-visible"
										onClick={clearChat}
									>
										<CirclePlus className="w-4 h-4" />
										{t?.('chat.entry.newChat') ?? '新对话'}
									</Button>
								)}
								{onUploadFile && (
									<Upload
										t={t}
										uploadType="button"
										className={cn(
											'w-auto h-auto lucide-stroke-draw-hover [&_svg]:overflow-visible',
										)}
										maxSize={20 * 1024 * 1024}
										multiple
										countValidText={
											t?.('chat.entry.upload.maxFiles') ??
											'最多只能支持 5 个文件'
										}
										uploadedCount={uploadedFiles?.length}
										disabled={
											(uploadedFiles && uploadedFiles?.length >= 5) ||
											uploadLoading
										}
										loading={uploadLoading}
										validTypes={CHAT_VALIDTYPES}
										showTooltip
										tooltipContent={
											<div className="flex flex-col gap-1.5">
												<div>
													{t?.('chat.entry.upload.tooltip.supportedTypes') ??
														'仅支持 PDF、DOCX、XLSX、PNG、JPG、JPEG、WEBP 格式！'}
												</div>
												<div>
													{t?.('chat.entry.upload.tooltip.maxFilesAndSize') ??
														'最多同时支持 5 个文件，每个文件最大 20 MB！'}
												</div>
											</div>
										}
										onUpload={onUploadFile}
									>
										<div className="flex items-center">
											<Link className="w-4 h-4 mr-2" />
											{t?.('chat.entry.upload.button') ?? '上传附件'}
										</div>
									</Upload>
								)}
								{onWebSearchEnabledChange ? (
									<Button
										type="button"
										variant="ghost"
										aria-pressed={webSearchEnabled}
										aria-label={t?.('chat.entry.webSearch') ?? '联网搜索'}
										disabled={loading}
										onClick={() => onWebSearchEnabledChange(!webSearchEnabled)}
										className={cn(
											'lucide-stroke-draw-hover mb-1 h-8 shrink-0 gap-1.5 rounded-md px-2.5 text-sm [&_svg]:overflow-visible',
											webSearchEnabled
												? 'border border-teal-600/50 bg-teal-600/20 text-teal-400 hover:bg-teal-600/30'
												: 'border border-transparent bg-theme/5 text-textcolor',
										)}
									>
										<Globe className="h-3.5 w-3.5 shrink-0" />
										{t?.('chat.entry.webSearch') ?? '联网搜索'}
									</Button>
								) : null}
							</div>
							{loading && stopGenerating ? (
								<span
									className={cn(
										'inline-flex mb-1 h-8 w-8 items-center justify-center rounded-full',
										'animate-chat-stop-breathe motion-reduce:animate-none',
									)}
								>
									<Button
										variant="ghost"
										onClick={() => stopGenerating?.()}
										className="lucide-stroke-draw-hover p-0 h-8.5 w-8.5 flex items-center justify-center rounded-full border border-red-500/30 bg-red-500/20 text-red-500 hover:bg-red-500/30 hover:text-red-500 shadow-none [&_svg]:overflow-visible"
									>
										<Target
											className={cn(
												'h-4 w-4 shrink-0 text-red-500/60',
												'animate-chat-stop-icon-breathe motion-reduce:animate-none',
											)}
										/>
									</Button>
								</span>
							) : (
								<div className="mb-1 flex items-center gap-1">
									{isTauriRuntime() ? (
										<DropdownMenu
											modal={false}
											open={disableTextInput ? false : inputModeMenuOpen}
											onOpenChange={handleInputModeMenuOpenChange}
										>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													type="button"
													className={cn(
														'inline-flex shrink-0 rounded-full lucide-stroke-draw-hover h-8.5 w-8.5 items-center justify-center bg-linear-to-r from-teal-500 to-cyan-600 [&_svg]:overflow-visible',
														voiceUiActive &&
															voiceRecording &&
															'animate-pulse ring-2 ring-teal-400/60',
														inputMode === 'voice' &&
															!voiceRecording &&
															!voiceTranscribing &&
															!input.trim() &&
															'ring-2 ring-teal-400/35',
													)}
													onPointerEnter={
														disableTextInput ? undefined : openInputModeMenu
													}
													onPointerLeave={
														disableTextInput
															? undefined
															: scheduleCloseInputModeMenu
													}
													onClick={(e) => {
														e.stopPropagation();
														setInputModeMenuOpen(false);
														void handleSendOrVoicePrimary();
													}}
													disabled={sendDisabled}
												>
													{voicePrimaryShowsSend ? (
														<Rocket className="-rotate-45" />
													) : voiceUiActive ? (
														voiceTranscribing ? (
															<Loader2 className="h-4 w-4 animate-spin" />
														) : voiceRecording ? (
															<Square className="h-3.5 w-3.5 fill-current" />
														) : (
															<Mic className="h-4 w-4" />
														)
													) : (
														<Rocket className="-rotate-45" />
													)}
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent
												side="top"
												align="end"
												sideOffset={6}
												className="min-w-26"
												onPointerEnter={clearCloseInputModeMenuTimer}
												onPointerLeave={scheduleCloseInputModeMenu}
												onCloseAutoFocus={(e) => e.preventDefault()}
											>
												<DropdownMenuLabel className="text-xs font-normal text-textcolor/60">
													{t?.('chat.entry.inputMode.label') ?? '输入模式'}
												</DropdownMenuLabel>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													className={cn(
														'gap-2',
														inputMode === 'text' &&
															'text-teal-500 focus:text-teal-500 data-highlighted:text-teal-500',
													)}
													onSelect={() => setInputMode('text')}
												>
													<Keyboard
														className={cn(
															'h-3.5 w-3.5 shrink-0 text-textcolor/95',
															inputMode === 'text' && 'text-teal-500',
														)}
													/>
													{t?.('chat.entry.inputMode.text') ?? '文本输入'}
												</DropdownMenuItem>
												<DropdownMenuItem
													className={cn(
														'gap-2',
														inputMode === 'voice' &&
															'text-teal-500 focus:text-teal-500 data-highlighted:text-teal-500',
													)}
													onSelect={() => setInputMode('voice')}
												>
													<Mic
														className={cn(
															'h-3.5 w-3.5 shrink-0 text-textcolor/95',
															inputMode === 'voice' && 'text-teal-500',
														)}
													/>
													{t?.('chat.entry.inputMode.voice') ?? '语音输入'}
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									) : (
										<Button
											variant="ghost"
											type="button"
											title={
												sendDisabled &&
												!voiceUiActive &&
												(!input.trim() || disableTextInput)
													? (t?.('chat.entry.sendDisabledHintWeb') ??
														t?.('chat.entry.sendDisabledHint') ??
														'请先输入内容')
													: undefined
											}
											aria-label={t?.('chat.entry.send') ?? '发送'}
											onClick={() => void handleSendOrVoicePrimary()}
											disabled={sendDisabled}
											className="lucide-stroke-draw-hover h-8.5 w-8.5 flex items-center justify-center rounded-full bg-linear-to-r from-teal-500 to-cyan-600 [&_svg]:overflow-visible"
										>
											<Rocket className="-rotate-45" />
										</Button>
									)}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ChatEntry;
