/**
 * 本仓微前端门面：基于 createFederation（主流 start + <Plugin />）。
 * 产品差异（Toast / COS / ebook / 偏好）集中在此文件。
 */
import {
	createFederation,
	DEFAULT_HOST_THEME_CUSTOM_PROP,
	type HostHttpClient,
	listHostSurfacePlugins,
	type PluginDescriptor,
} from '@dnhyxc-ai/federation-kit';
import { Toast } from '@ui/sonner';
import { type ComponentType, createElement } from 'react';
import { getActiveLocale, type Locale, translateSync } from '@/i18n';
import type { RouteConfig } from '@/router/routes';
import { downloadBlob, isTauriRuntime, onListen } from '@/utils';
import { http } from '@/utils/fetch';
import { playPreferred, stopAllPlayback } from '@/utils/speech';
import { pickEnglishLearningJsonFile } from '@/views/englishLearning/import/englishLearningImportFile';
import { TTS_CACHE_FOLDER } from '@/views/englishLearning/utils/ttsCacheFolder';
import { setAppFullscreen } from '../capabilities/appFullscreen';
import {
	readHostChromeTheme,
	readHostIframeAppearance,
} from '../capabilities/iframeAppearance';
import { pickLocalFilesForPlugins } from '../capabilities/pickLocalFiles';
import {
	arePluginEnabledPrefsReady,
	ensurePluginEnabledPrefsLoaded,
	getPluginEnabledPref,
	setPluginEnabledPref,
} from '../enabled/prefs';
import { createEbookModulesApi } from '../modules/ebook/hostApi';
import { createLearningNotesModulesApi } from '../modules/learningNotes/hostApi';
import {
	getListLibrary,
	getSnapshot,
	setVocabDetailListStats,
	setVocabDetailPending,
	showVocabDetail,
	subscribeListLibrary,
	subscribeVocabDetail,
} from '../modules/vocabDetail/session';
import {
	getTarget,
	subscribeVocabImport,
} from '../modules/vocabDetailImport/session';
import {
	fetchPluginRegistry,
	PLUGIN_REGISTRY_CACHE_KEY,
	persistPluginEnabled,
} from '../registry';

const DOCX_MIME =
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const hostHttp: HostHttpClient = {
	get: ((url: string) => http.get(url)) as HostHttpClient['get'],
	post: ((url: string, body?: unknown) =>
		http.post(url, body)) as HostHttpClient['post'],
	put: ((url: string, body?: unknown) =>
		http.put(url, body)) as HostHttpClient['put'],
	delete: ((url: string) => http.delete(url)) as HostHttpClient['delete'],
};

function readTheme(): 'light' | 'dark' {
	return readHostChromeTheme();
}

function readLocale(): 'zh-CN' | 'en-US' {
	return getActiveLocale() === 'en-US' ? 'en-US' : 'zh-CN';
}

let hostPage: ComponentType<{ pluginId: string; pageShell?: boolean }> | null =
	null;

export function registerPluginHostPage(
	page: ComponentType<{ pluginId: string; pageShell?: boolean }>,
) {
	hostPage = page;
}

function createPluginRoute(meta: PluginDescriptor): RouteConfig {
	const Page: ComponentType = () => {
		if (!hostPage) throw new Error('PluginHostPage not registered');
		return createElement(hostPage, { pluginId: meta.id, pageShell: true });
	};
	return {
		path: meta.routePath,
		Component: Page,
		meta: { titleI18n: meta.title, title: meta.id },
	};
}

/** 列表和导入抽屉点词都走这里。详解插件没开时返回 false，由插件自己提示。 */
function openVocabDetailWord(word: unknown): boolean {
	if (typeof word !== 'string' || !word.trim()) return false;
	const enabled = listHostSurfacePlugins('english.vocab.card').some(
		(plugin) =>
			plugin.id === 'vocabDetail' && plugin.host?.slot === 'card-action',
	);
	if (!enabled) return false;
	showVocabDetail('vocabDetail', { word });
	return true;
}

/** 全局 MF Host（asDefault，供 <Plugin /> / FederationPlugin 使用） */
// 把清单拉取、路由注入、插件 api 裁剪和 iframe 代调收成一个宿主实例
export const mf = createFederation<RouteConfig>({
	// 插件 hostApiRange 必须覆盖此版本；未配置环境变量时用 1.0.0，破缓存只改插件 version
	hostApiVersion: import.meta.env.VITE_HOST_API_VERSION?.trim() || '1.0.0',
	// 生产构建才启用远程包的完整性校验路径
	prod: import.meta.env.PROD,
	// 仅当环境变量精确为字符串 false 才校验签名；默认跳过，本地未签名包能加载
	skipIntegrity: import.meta.env.VITE_PLUGIN_SKIP_INTEGRITY !== 'false',
	// 插件偏好等本地键前缀，避免和主站其它 localStorage 撞名
	storagePrefix: 'dnhyxc.plugin',
	// 与 registry 模块共用的清单缓存键，拉取失败时回退这份
	registryCacheKey: PLUGIN_REGISTRY_CACHE_KEY,
	// 不可信 iframe 与主站 postMessage 的频道名，两边必须一致
	iframeChannel: 'dnhyxc-mf-iframe',
	// 启动时拉 plugins-registry.json，失败则用本地缓存
	fetchRegistry: fetchPluginRegistry,
	// 管理端改上架状态后写回清单文件
	persistEnabled: persistPluginEnabled,
	// 账号级上架覆盖：叠在清单 enabled 之上，按当前用户决定插件是否真正可用
	enabledStore: {
		// 读该用户对某个插件的启用偏好
		get: getPluginEnabledPref,
		// 上架或下架时写入偏好并通知已加载插件
		set: setPluginEnabledPref,
		// 进主站先把偏好拉进内存，未完成前不能拿清单默认 enabled 当结论
		load: ensurePluginEnabledPrefsLoaded,
		// 偏好还没就绪时调用方应等待，而不是当成全部禁用
		isReady: arePluginEnabledPrefsReady,
		// 结束账号级上架偏好
	},
	// 把主站主题变量圈进插件作用域，避免插件 Tailwind 漏到主站
	styleIsolation: {
		// 匹配要复制进插件 scope 的主站 CSS 变量名
		themePropPattern: DEFAULT_HOST_THEME_CUSTOM_PROP,
		// 样式地址含这段路径的视为主站 CSS，隔离时排除，避免主站规则被再包一层
		hostViteRootMarker: '/apps/frontend',
		// 结束样式隔离配置
	},
	// federation-kit 自身文案走主站 i18n，插值按字符串表传入
	translate: (key, params) =>
		// 同步查主站文案表，避免插件加载路径上再等一次异步翻译
		translateSync(key, params as Record<string, string>),
	// 带 routePath 的插件注册成主站路由，页面用已登记的 PluginHostPage
	createRoute: createPluginRoute,
	// 注入插件 api 的主站能力；真正下发时再按该插件的 permissions 裁剪
	capabilities: {
		// 插件读取当前浅色或深色，这里只给快照不订阅
		getTheme: readTheme,
		// 插件读取 zh-CN 或 en-US；其它语言归到 zh-CN
		getLocale: readLocale,
		// 整页打开该 URL，不走 React Router，避免插件跳转和主站历史栈缠在一起
		navigate: (to) => window.location.assign(to),
		// 插件 ui.showToast：缺省 type 用 info，正文放进主站 Toast 的 title
		toast: (options) => {
			// 映射成主站 Toast 的入参
			Toast({
				// 插件没传 type 时用 info，避免弹出无类型样式
				type: options.type ?? 'info',
				// 插件协议只有 message，对应主站 Toast 的标题位
				title: options.message,
				// 结束 Toast 入参
			});
			// 结束 toast 能力
		},
		// 带登录态的主站 http；插件需声明 http:plugin-api 才会拿到
		http: hostHttp,
		// 插件请求进入或退出应用全屏
		setAppFullscreen,
		// 选本地文件：Web 得到 blob URL，Tauri 走系统对话框得到 asset URL
		pickLocalFiles: pickLocalFilesForPlugins,
		// 插件把内存中的文件字节交给主站下载（笔记导出 docx 等）
		downloadBlob: async (options) => {
			// 未传 MIME 时按 docx，与笔记导出的默认格式一致
			const mime = options.mimeType?.trim() || DOCX_MIME;
			// 插件传来的原始字节，可能是 ArrayBuffer 或 Uint8Array
			const raw = options.data;
			// Blob 需要 Uint8Array；ArrayBuffer 包一层视图，已是视图则再拷一层避免共享偏移
			const bytes =
				// ArrayBuffer 新建视图；已是 Uint8Array 再包一层，避免和插件共享同一段偏移
				raw instanceof ArrayBuffer ? new Uint8Array(raw) : new Uint8Array(raw);
			// 用上面的 MIME 包成浏览器可下载的 Blob
			const blob = new Blob([bytes], { type: mime });
			// Tauri 弹系统保存框，Web 触发浏览器下载
			const result = await downloadBlob(
				// 主站下载任务的文件名、任务 id 和覆盖策略
				{
					// 插件没给文件名时落成 download
					file_name: options.fileName || 'download',
					// 任务 id 带插件 id 和时间，避免并发下载互相覆盖
					id: `plugin-${options.pluginId}-${Date.now()}`,
					// 同名文件直接覆盖，不再二次确认
					overwrite: true,
					// 结束下载任务参数
				},
				// 上面包好的文件内容
				blob,
				// 结束主站下载调用
			);
			// Tauri 下载层自己会提示结果，调用方不要再 toast 一次
			const hostToasted = isTauriRuntime();
			// 失败把主站文案带回插件；成功不带 message
			if (result.success !== 'success') {
				// 失败结果交回插件，由插件决定要不要再提示
				return {
					// 标记这次下载没有成功
					ok: false as const,
					// 告诉插件主站是否已经弹过失败提示
					hostToasted,
					// 主站没给原因时用固定兜底文案
					message: result.message || '下载失败',
					// 结束失败结果
				};
				// 结束失败分支
			}
			// 成功只回 ok 和是否已由主站提示
			return { ok: true as const, hostToasted };
			// 结束 downloadBlob
		},
		// 按该插件 permissions 组装 api.modules，没声明的模块不挂
		buildModules: (allow) => {
			// 先攒允许暴露的模块，最后空对象就不下发
			const modules: Record<string, unknown> = {};
			// 学习笔记插件才拿得到笔记上下文读写
			if (allow.has('modules:learningNotes')) {
				// 挂上笔记上下文的读写
				modules.learningNotes = createLearningNotesModulesApi();
				// 结束学习笔记权限分支
			}
			// 聊天插件只开放「打开某个会话」，不暴露整个聊天模块
			if (allow.has('modules:chat')) {
				// 只挂打开会话这一个方法
				modules.openThread = (id: unknown) => {
					// 非字符串会话 id 直接拒绝，避免拼出非法地址
					if (typeof id !== 'string') throw new Error('INVALID_THREAD_ID');
					// 整页进入该会话，与 navigate 一样不走前端路由
					window.location.assign(`/chat/c/${id}`);
					// 结束 openThread
				};
				// 结束聊天权限分支
			}
			// 阅读页插件：书 id、跳转 CFI、开关想法列表
			if (allow.has('modules:ebook')) {
				// 挂上阅读页模块，供同页插件和下面的 iframe 代调使用
				modules.ebook = createEbookModulesApi();
				// 结束阅读页权限分支
			}
			// 导入单词解析面板：当前词库、点词开解析、选 JSON 文件
			if (allow.has('modules:vocabDetailImport')) {
				// 导入面板用的四个方法
				modules.vocabDetailImport = {
					// 当前打开的词库 id 和标题；抽屉没开时为 null
					getTarget,
					// 词库切换或抽屉开关时通知导入面板刷新
					subscribe: subscribeVocabImport,
					// 点已导入词打开单词解析；解析插件未启用时返回 false
					open: openVocabDetailWord,
					// 选一个 JSON 文件交给导入面板；取消返回 null，非 json 抛 accept
					pickJsonFile: () => pickEnglishLearningJsonFile(),
					// 结束导入面板模块
				};
				// 结束导入权限分支
			}
			// 单词解析面板和解析列表：快照、播放、把列表条数写回顶栏
			if (allow.has('modules:vocabDetail')) {
				// 解析面板和解析列表共用这一组方法
				modules.vocabDetail = {
					// 面板初次渲染用这份快照对齐主站已经打开的词
					getSnapshot,
					// 换词或开关抽屉时让解析面板重渲染
					subscribeVocabDetail,
					// 面板把生成中或停止中写回主站，卡片状态和抽屉一致
					setPending: setVocabDetailPending,
					// 与导入面板共用；解析插件没开就返回 false，由插件自己提示
					open: openVocabDetailWord,
					// 解析列表当前词库，列表插件用来拉这一库的词
					getListLibrary,
					// 从卡片切到列表、或列表词库变化时通知列表插件
					subscribeListLibrary,
					// 列表把「共 n 条 / 已加载 m 条」写回主站顶栏
					setListStats: (stats: unknown) => {
						// 空值或非对象当成没有统计，清掉顶栏数字
						if (!stats || typeof stats !== 'object') {
							// 顶栏不再显示条数
							setVocabDetailListStats(null);
							// 清掉后不再往下解析字段
							return;
							// 结束非法统计分支
						}
						// 插件传入的 total、loaded 类型不受约束，先按未知字段取出
						const row = stats as { total?: unknown; loaded?: unknown };
						// 转成数字，缺字段会得到 NaN，留给下一行丢掉
						const total = Number(row.total);
						// 已加载条数同样先转数字，和 total 一起校验
						const loaded = Number(row.loaded);
						// 缺字段或 NaN 时保留上次统计，避免顶栏闪成 0
						if (!Number.isFinite(total) || !Number.isFinite(loaded)) return;
						// 非负整数写回顶栏；小数向下取整
						setVocabDetailListStats({
							// 总数不能为负，小数向下取整
							total: Math.max(0, Math.floor(total)),
							// 已加载条数同样取非负整数
							loaded: Math.max(0, Math.floor(loaded)),
							// 结束写回顶栏的统计
						});
						// 结束 setListStats
					},
					// 解析面板点播放；空文本不打 TTS
					play: (text: unknown) => {
						// 非字符串或只有空白时直接结束，避免空朗读请求
						if (typeof text !== 'string' || !text.trim())
							// 空文本视为已播完，调用方不用处理拒绝
							return Promise.resolve();
						// 优先本机音色，并落到单词解析缓存目录，同一词下次不重新合成
						return playPreferred(text, {
							// 合成结果写入磁盘缓存
							persistDisk: true,
							// 与其它业务的语音缓存分开目录
							cacheFolder: TTS_CACHE_FOLDER.vocabDetail,
							// 结束朗读参数
						});
						// 结束 play
					},
					// 停掉正在播的解析朗读，关抽屉时面板也会调
					stop: () => stopAllPlayback(),
				};
			}
			// 一个权限都没挂上就不要给 api.modules，避免空对象被插件当成模块已就绪
			return Object.keys(modules).length > 0 ? modules : undefined;
		},
		// 插件订阅主站语言；返回的函数在插件卸载时调用
		onLocaleChange: (handler) => {
			// onListen 是异步的，卸载若发生在订阅完成前，靠这个标记立刻解绑
			let cancelled = false;
			// 订阅成功后的解绑函数；完成前卸载则为空
			let unlisten: (() => void) | undefined;
			// 只把主站支持的两种语言传进插件，其它值忽略
			void onListen<Locale>('locale', (next) => {
				// 只转发主站实际支持的两种语言
				if (next === 'zh-CN' || next === 'en-US') handler(next);
				// 订阅完成后拿到解绑函数
			}).then((fn) => {
				// 订阅还没返回插件就已经卸载，立刻解绑，避免泄漏
				if (cancelled) {
					// 立刻拆掉刚加上的监听
					fn();
					// 解绑后不再把这个函数留到卸载时
					return;
					// 结束过早卸载分支
				}
				// 留给上面的卸载函数稍后调用
				unlisten = fn;
			});
			// 插件卸载：标记取消，并解绑已经加上的 locale 监听
			return () => {
				// 让尚未完成的 then 走立刻解绑
				cancelled = true;
				// 订阅已完成时拆掉 locale 监听
				unlisten?.();
			};
		},
		// iframe 插件要的外观快照：主题、dark class、当前 CSS 变量
		getAppearance: () => readHostIframeAppearance(readTheme()),
		// 主题或强调色变化时把新外观推给 iframe；返回卸载函数
		onAppearanceChange: (handler) => {
			// theme 切换后 applyThemeVariables 有 ~10ms 延迟；再多等一会避开与路由卸载叠在同一帧
			// 卸载后迟到的定时器和监听都不再推外观
			let cancelled = false;
			// 80ms 防抖句柄，连续切主题只推最后一次
			let timer: number | undefined;
			// 上次已推送的外观指纹，相同则不再通知 iframe
			let lastFp = '';
			// 清掉未执行的推送，等变量写完再采样
			const push = () => {
				// 连续的 theme、accent 事件只保留最后一次采样
				window.clearTimeout(timer);
				// 80ms 后再读外观，躲开主题变量尚未写上的那一帧
				timer = window.setTimeout(() => {
					// 卸载后丢弃这次采样
					if (cancelled) return;
					// 按当前主题重读要发给 iframe 的外观
					const next = readHostIframeAppearance(readTheme());
					// 主题、dark class、变量序列化后比较，避免重复 postMessage
					const fp = `${next.theme}|${next.darkClass ?? ''}|${JSON.stringify(next.cssVars)}`;
					// 和上次相同就不通知，iframe 不用重绘
					if (fp === lastFp) return;
					// 记下这次已推送的外观，供下一次去重
					lastFp = fp;
					// 把新外观交给 iframe 桥
					handler(next);
					// 结束 80ms 延时
				}, 80);
			};
			// 两个监听的解绑函数，订阅完成前可能还是空的
			const unsubs: Array<() => void> = [];
			// theme 与 accent 任一变化都走同一个 push
			void Promise.all([
				// 浅色深色切换
				onListen('theme', push),
				// 强调色切换，同样要刷新 iframe 里的 CSS 变量
				onListen('accent', push),
				// 两个监听都订上之后再决定留着还是立刻拆掉
			]).then((fns) => {
				// 两个监听都订上之前插件已卸载，立刻拆掉
				if (cancelled) {
					// 把刚返回的解绑函数逐个调用
					for (const fn of fns) fn();
					// 已经拆掉，不用再放进 unsubs
					return;
				}
				// 留给卸载函数稍后一起拆
				unsubs.push(...fns);
			});
			// 插件卸载：停掉未触发的定时器，并解绑主题和强调色
			return () => {
				// 让尚未完成的 then 和定时器都停下来
				cancelled = true;
				// 取消还没触发的那次外观推送
				window.clearTimeout(timer);
				// 拆掉已经订上的 theme 和 accent 监听
				for (const u of unsubs) u();
			};
		},
	},
	// 不可信 iframe 拿不到页面内的 modules，改由主站按方法名代为调用阅读页 API
	iframeRpcHandlers: {
		// iframe 问当前书 id；阅读模块没挂上时回 null
		'ebook.getBookId': (bridge) => {
			// modules 是未知表，收窄到 getBookId 再调用
			const ebook = bridge.api.modules?.ebook as
				// 只保留取书 id 这一个方法
					| { getBookId: () => string | null }
					// 阅读模块没挂上时是 undefined
					| undefined;
			// 没有模块或没有书时回 null，iframe 据此显示空态
			return ebook?.getBookId() ?? null;
		},
		// iframe 问当前书名；没有阅读模块时回 null
		'ebook.getBookTitle': (bridge) => {
			// 收窄到取书名
			const ebook = bridge.api.modules?.ebook as
				// 只保留取书名
					| { getBookTitle: () => string | null }
					// 阅读模块没挂上时是 undefined
					| undefined;
			// 没有模块或没有书名时回 null
			return ebook?.getBookTitle() ?? null;
		},
		// iframe 要求跳到某个 CFI；参数缺失时传空串，由阅读页自己忽略
		'ebook.navigateToCfi': async (bridge, args) => {
			// 收窄到按 CFI 跳转，跳转本身可能是异步的
			const ebook = bridge.api.modules?.ebook as
				// 跳转可能返回 Promise，调用处会 await
					| { navigateToCfi: (cfi: string) => void | Promise<void> }
					// 阅读模块没挂上时跳过跳转
					| undefined;
			// 等跳转结束再回应 iframe，避免列表先关、阅读位置还没到
			await ebook?.navigateToCfi(String(args[0] ?? ''));
			// 这个 RPC 没有返回值，固定回 null 让 iframe 侧的 Promise 结束
			return null;
			// 结束 navigateToCfi 代调
		},
		// iframe 打开某条想法；整条记录原样交给阅读页
		'ebook.openThought': (bridge, args) => {
			// 收窄到打开想法；记录结构由阅读页自己校验
			const ebook = bridge.api.modules?.ebook as
				// 想法记录保持 unknown，由阅读页自己认结构
					| { openThought: (t: unknown) => void }
					// 阅读模块没挂上时不打开
					| undefined;
			// 第一个参数就是想法记录
			ebook?.openThought(args[0]);
			// 无返回值
			return null;
			// 结束 openThought 代调
		},
		// iframe 关掉想法列表；方法可选，旧宿主没有也不报错
		'ebook.closeIdeasList': (bridge) => {
			// closeIdeasList 是后加的，类型上可选
			const ebook = bridge.api.modules?.ebook as
				// 方法可选：旧的阅读模块没有这个函数
					| { closeIdeasList?: () => void }
					// 阅读模块没挂上时不调用
					| undefined;
			// 模块或方法不存在就跳过
			ebook?.closeIdeasList?.();
			// 无返回值
			return null;
			// 结束 closeIdeasList 代调
		},
		// 结束 iframe 代调表
	},
	// 结束 createFederation 配置
});

export const pluginManager = mf.manager;
export const routeInjector = mf.routeInjector;
export const sidebarInjector = mf.sidebarInjector;
export const HOST_API_VERSION = mf.runtime.hostApiVersion;
export const appRuntime = mf.runtime;

export const getAppIframeBridgeOptions = () => mf.getIframeBridgeOptions();

/** @deprecated 用 mf.start() */
export const startFederation = () => mf.start();
