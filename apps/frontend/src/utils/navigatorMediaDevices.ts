/**
 * 部分 WebView（macOS WKWebView、旧版 Safari）只暴露前缀版 getUserMedia，
 * 未挂到 navigator.mediaDevices 上，会导致「没有麦克风接口」的假阴性。
 * 在读取能力或调用 getUserMedia 之前执行一次即可（幂等）。
 */
export function patchNavigatorMediaDevices(): void {
	if (typeof navigator === 'undefined') return;

	const nav = navigator as Navigator & {
		mediaDevices?: MediaDevices;
	};
	// lib.dom 中 MediaDevices 类型恒含 getUserMedia；运行时旧 WebView 可能仍缺省，用 unknown 判断
	const existingGum = (
		nav.mediaDevices as unknown as { getUserMedia?: unknown } | undefined
	)?.getUserMedia;
	if (typeof existingGum === 'function') return;

	type LegacyGum = (
		constraints: MediaStreamConstraints,
		onSuccess: (stream: MediaStream) => void,
		onError: (err: unknown) => void,
	) => void;

	const legacy = ((nav as unknown as { getUserMedia?: LegacyGum })
		.getUserMedia ??
		(nav as unknown as { webkitGetUserMedia?: LegacyGum }).webkitGetUserMedia ??
		(nav as unknown as { mozGetUserMedia?: LegacyGum }).mozGetUserMedia) as
		| LegacyGum
		| undefined;

	if (!legacy) return;

	if (!nav.mediaDevices) {
		(nav as Navigator & { mediaDevices: MediaDevices }).mediaDevices =
			{} as MediaDevices;
	}

	const md = nav.mediaDevices as MediaDevices & {
		getUserMedia?: (
			constraints: MediaStreamConstraints,
		) => Promise<MediaStream>;
	};

	md.getUserMedia = (constraints: MediaStreamConstraints) =>
		new Promise<MediaStream>((resolve, reject) => {
			try {
				legacy.call(navigator, constraints, resolve, reject);
			} catch (e) {
				reject(e);
			}
		});
}

/** 将 getUserMedia 常见异常转成可读说明（中文） */
export function formatGetUserMediaError(err: unknown): string {
	if (err instanceof DOMException) {
		switch (err.name) {
			case 'NotAllowedError':
			case 'PermissionDeniedError':
				return '系统或浏览器拒绝了麦克风权限，请在系统设置中允许本应用访问麦克风，并留意是否点了「不允许」。';
			case 'NotFoundError':
			case 'DevicesNotFoundError':
				return '未检测到可用的麦克风，请连接麦克风或在系统设置中选择正确的输入设备。';
			case 'NotReadableError':
			case 'TrackStartError':
				return '麦克风可能被其他应用占用，请关闭视频会议/录音类软件后重试。';
			case 'SecurityError':
				return `安全限制导致无法访问麦克风：${err.message}（请使用 HTTPS 或 localhost 打开页面）`;
			case 'NotSupportedError':
				return '当前环境不支持所请求的音频采集方式，请更新系统或换用 Chrome / Edge。';
			default:
				return `无法访问麦克风（${err.name}）：${err.message}`;
		}
	}
	if (err instanceof Error) {
		return `无法访问麦克风：${err.message}`;
	}
	return `无法访问麦克风：${String(err)}`;
}
