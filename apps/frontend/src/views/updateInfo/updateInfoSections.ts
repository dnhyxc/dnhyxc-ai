/**
 * 与对外《更新信息》说明正文对齐的章节数据（产品级说明，供独立页渲染）。
 * 说明正文增删改时请同步维护本文件。
 * 英文正文映射见 updateInfoSectionsEnOverlay.ts。
 */

import type { Locale } from '@/i18n';
import {
	UPDATE_INFO_BULLETS_EN,
	UPDATE_INFO_INTRO_EN,
	UPDATE_INFO_SECTION_TITLES_EN,
} from './updateInfoSectionsEnOverlay';

export type UpdateInfoBullet = {
	id: string;
	title: string;
	/** 展示用更新日期标签，如 2026-04-14 */
	dateLabel: string;
	description: string;
};

export type UpdateInfoSection = {
	id: string;
	title: string;
	items: UpdateInfoBullet[];
};

const UPDATE_INFO_SECTIONS_ZH: UpdateInfoSection[] = [
	{
		id: 's1',
		title: '1. 发布与更新',
		items: [
			{
				id: 's1-1',
				title: '发布后自动更新公开更新页',
				dateLabel: '2026-04-14',
				description:
					'完成打包发布后，更新信息页会自动刷新到最新内容，减少手动维护与遗漏；本地仅验证时可通过开关跳过同步步骤。（待提交）',
			},
			{
				id: 's1-2',
				title: 'GitHub Release 上传 dmg 脚本',
				dateLabel: '2026-05-03',
				description:
					'工程内提供 upload-dmg-to-release 脚本（根目录 pnpm upload-dmg），将 Tauri 桌面端构建生成的 .dmg 安装包上传至与 upload-to-release 相同的 GitHub Release（如 latest 标签）；使用 GITHUB_TOKEN、OWNER、APP_REPO 等与既有上传脚本一致的环境变量。默认选取 dmg 构建输出目录中修改时间最新的 .dmg，也可通过命令行参数或环境变量 DMG_PATH 指定文件路径。',
			},
		],
	},
	{
		id: 's2',
		title: '2. 账号与访问控制',
		items: [
			{
				id: 's2-1',
				title: '路由级登录守卫',
				dateLabel: '2026-04-05',
				description:
					'未登录时，访问受保护页面会被引导到登录页；公开页面不受影响。',
			},
			{
				id: 's2-2',
				title: '鉴权失效收敛',
				dateLabel: '2026-04-05',
				description:
					'接口返回 401（未授权）时统一清理会话并触发重新登录，避免「看似已登录但实际已过期」的状态漂移。',
			},
			{
				id: 's2-3',
				title: '公开访问路径策略',
				dateLabel: '2026-05-14',
				description:
					'未登录仍可访问首页、登录、关于、分享链接、知识库（默认仅本地模式，见「§6」）、系统设置及其子路径、桌面端下载说明页、产品指南、用户服务政策、用户服务协议、结构化更新说明等；智能对话等需登录的主流程仍由守卫拦截；独立公开页与「§21、§22」所列路由一致。',
			},
		],
	},
	{
		id: 's3',
		title: '3. 桌面端与浏览器双端体验',
		items: [
			{
				id: 's3-1',
				title: '同一套前端双端运行',
				dateLabel: '2026-04-13',
				description:
					'桌面端（Tauri，桌面壳）与独立浏览器均可运行同一套前端应用。',
			},
			{
				id: 's3-2',
				title: '能力降级与提示',
				dateLabel: '2026-04-13',
				description:
					'在浏览器环境中，目录选择、开机自启、全局快捷键等仅桌面端能力会自动降级为提示，不会导致页面崩溃或白屏。',
			},
			{
				id: 's3-3',
				title: '外链打开策略统一',
				dateLabel: '2026-04-13',
				description:
					'外链打开行为在不同运行环境下保持一致与安全（避免不必要的权限与上下文泄露）。',
			},
			{
				id: 's3-4',
				title: 'macOS 生产包允许特定 HTTP 域名访问',
				dateLabel: '2026-04-23',
				description:
					'通过 Info.plist 的 ATS（App Transport Security，应用传输安全）配置放行指定 http 域名，保证生产环境可正常访问该域名资源。',
			},
			{
				id: 's3-5',
				title: 'Tauri / 浏览器双端一致性',
				dateLabel: '2026-05-02',
				description:
					'注意入口初始化顺序、能力降级与外链策略，避免在纯浏览器环境因桌面专用 API 误用导致白屏或异常。',
			},
		],
	},
	{
		id: 's4',
		title: '4. 对话（Chatbot）',
		items: [
			{
				id: 's4-1',
				title: '流式对话（SSE，服务端事件）',
				dateLabel: '2026-04-02',
				description: '支持流式生成、停止生成与续写，提升交互连续性。',
			},
			{
				id: 's4-2',
				title: '会话与历史管理',
				dateLabel: '2026-04-02',
				description: '支持会话创建、列表与历史查询、会话更新与删除等。',
			},
			{
				id: 's4-3',
				title: '分支对话与重生成',
				dateLabel: '2026-05-14',
				description:
					'会话内支持消息树形态下的分支与重生成等结构；分享只读页与在线阅读在复杂分支场景下仍保持消息顺序与排版一致（与「§14」分享与公开阅读及既有顺序修复条目互补）。',
			},
			{
				id: 's4-4',
				title: '分享会话顺序修复',
				dateLabel: '2026-04-22',
				description: '修复分享页中消息顺序错乱的问题，提升阅读一致性。',
			},
			{
				id: 's4-5',
				title: '联网检索与引用',
				dateLabel: '2026-04-02',
				description: '支持联网检索并在输出中携带引用信息，便于溯源与复核。',
			},
			{
				id: 's4-6',
				title: '附件与 OCR',
				dateLabel: '2026-04-02',
				description:
					'支持附件处理与 OCR（光学字符识别）增强，提升多模态输入的可用性。',
			},
			{
				id: 's4-7',
				title: '异步落库与可靠性',
				dateLabel: '2026-04-02',
				description:
					'通过队列（BullMQ）等机制提高消息持久化的可靠性与可扩展性。',
			},
			{
				id: 's4-8',
				title: '桌面端对话输入区：语音与停录策略',
				dateLabel: '2026-05-02',
				description:
					'桌面客户端（Tauri）对话页底部输入区支持文本/语音模式切换、实时听写与停录收尾；停录后不再发起整段二次转写，详见独立页「§11」对应说明。',
			},
			{
				id: 's4-9',
				title: '对话模型接入统一',
				dateLabel: '2026-05-21',
				description:
					'主站智能对话的后端生成链路统一为硅基流动 OpenAI 兼容接口，默认使用 GLM-4.7 系列模型；流式输出、停止生成、续写与分支等交互方式不变。',
			},
			{
				id: 's4-10',
				title: '聊天附件图片预览修复',
				dateLabel: '2026-05-25',
				description:
					'修复 Web 与桌面端上传图片后预览失败（含中文文件名、跨端口拦截、线上网关配置不当等）。Web 生产环境附件通过当前站点下的接口地址加载，不再依赖单独配置图片静态路径；发消息时附件路径与服务器磁盘文件名一致，便于识别图片内容。请同时部署前端与后端并重启服务；若仍直接访问旧式图片链接，需按运维文档调整网关。',
			},
		],
	},
	{
		id: 's5',
		title: '5. Markdown 工具包与渲染能力',
		items: [
			{
				id: 's5-1',
				title: 'Markdown 渲染',
				dateLabel: '2026-04-06',
				description: '支持常见 Markdown 语法与富文本输出，兼顾容错与稳定性。',
			},
			{
				id: 's5-2',
				title: '数学公式',
				dateLabel: '2026-04-06',
				description:
					'支持 KaTeX（数学公式渲染），并在错误情况下尽量不影响整页显示。',
			},
			{
				id: 's5-3',
				title: '代码高亮与主题',
				dateLabel: '2026-04-06',
				description:
					'支持 highlight.js（代码高亮）与主题切换，满足不同阅读偏好。',
			},
			{
				id: 's5-4',
				title: '任务列表',
				dateLabel: '2026-04-06',
				description:
					'支持 GFM（GitHub Flavored Markdown，GitHub 风格 Markdown）任务列表展示。',
			},
			{
				id: 's5-5',
				title: 'Mermaid 图表',
				dateLabel: '2026-04-14',
				description:
					'支持 Mermaid（图表语法）渲染与运行时处理，提升文档表达能力。',
			},
			{
				id: 's5-6',
				title: 'Markdown 渲染安全加固',
				dateLabel: '2026-04-16',
				description:
					'工具包默认禁用 raw HTML（例如 <script> 会被转义为文本），降低 innerHTML/dangerouslySetInnerHTML 挂载时的 XSS（跨站脚本攻击）风险；如业务确需渲染少量 HTML，可显式开启并配合清洗策略。',
			},
		],
	},
	{
		id: 's6',
		title: '6. 知识库（编辑、列表与本地模式）',
		items: [
			{
				id: 's6-1',
				title: '云端与本地双模式',
				dateLabel: '2026-04-05',
				description: '支持云端知识条目管理，也支持本地文件夹作为知识库来源。',
			},
			{
				id: 's6-2',
				title: '未登录仅本地',
				dateLabel: '2026-04-11',
				description:
					'未登录时默认使用本地模式，不会触发云端接口；并隐藏不适用的入口（如回收站）。',
			},
			{
				id: 's6-3',
				title: '本地文件夹管理',
				dateLabel: '2026-04-05',
				description:
					'支持递归扫描 Markdown 文件、读取/保存/删除，并支持在外部编辑器中打开进行编辑。',
			},
			{
				id: 's6-4',
				title: '删除分流：本地 / 在线 / 同时删除',
				dateLabel: '2026-04-23',
				description:
					'知识库列表删除确认框在「云端条目 + 桌面端已定位到同名本地文件」的场景下提供「删除本地文件 / 删除在线文件 / 同时删除」三按钮；同时保留原「同时删除」的既有行为，避免影响历史使用习惯。',
			},
			{
				id: 's6-5',
				title: '自动保存（防抖）',
				dateLabel: '2026-04-08',
				description:
					'提供自动保存能力（Debounce，防抖），避免频繁写入；并与「覆盖保存」语义联动，减少误覆盖与打断编辑。',
			},
			{
				id: 's6-6',
				title: '页面内快捷键（Chord，和弦快捷键）',
				dateLabel: '2026-04-14',
				description:
					'支持在知识库页面内使用组合快捷键完成保存、清空、打开列表、切换操作栏等，提高编辑效率。',
			},
			{
				id: 's6-7',
				title: '回收站打开与清空后的编辑器状态',
				dateLabel: '2026-04-16',
				description:
					'从回收站打开条目时，持久化快照与正文一致，Diff 基线正确；执行「新建/清空草稿」时会刷新编辑器会话标识，与从列表打开再清空的行为对齐，避免仍停留在分屏对照等视图状态。',
			},
			{
				id: 's6-8',
				title: '知识库文档助手：置底/置顶与未登录隐藏',
				dateLabel: '2026-04-21',
				description:
					'已登录时在知识库编辑器底部可使用文档助手；对话区支持一键滚动到底部或回到顶部（与 Markdown 预览区角标逻辑一致），便于长对话与流式输出时上滑阅读后再跟随最新内容；未登录时不展示该助手入口，避免无效占位。',
			},
			{
				id: 's6-9',
				title: '助手流式跨文档稳定性',
				dateLabel: '2026-04-22',
				description:
					'修复流式输出时切换文档/路由后再切回丢失流式状态的问题；并优化「首次保存文档时若仍在流式输出」的边界处理，避免误终止输出或绑定不完整会话。',
			},
			{
				id: 's6-10',
				title: '助手输入区菜单随界面语言切换',
				dateLabel: '2026-05-02',
				description:
					'知识库文档助手内底部输入与「§12」界面语言一致，「输入模式」等文案随中英切换；与「§11」桌面端语音能力配套使用。',
			},
			{
				id: 's6-11',
				title: '本地目录与编辑器同步',
				dateLabel: '2026-05-02',
				description:
					'本地文件夹扫描、写盘与编辑器缓冲及列表状态对齐；未登录时保持仅本地、不请求云端的策略与「§6」前述条目一致。',
			},
			{
				id: 's6-12',
				title: '选区发送至文档助手',
				dateLabel: '2026-05-14',
				description:
					'在知识库 Markdown 编辑器中可将选中文本发送至底部文档助手，结合 AI 模式或 RAG 模式提问；对重复或重叠选区的发送做收敛，降低助手侧重复上下文噪音。',
			},
			{
				id: 's6-13',
				title: '「生成目录」写入文首带二级标题',
				dateLabel: '2026-05-21',
				description:
					'知识库 AI 模式下点击助手「生成目录」快捷卡，流式结束后自动插入的目录块最上方统一为「## 目录」；若文首仅有锚点列表或用了其它级别目录标题，会只补「## 目录」而不重复列表；文首已是「## 目录」则提示跳过。',
			},
			{
				id: 's6-14',
				title: '知识库助手流式体验',
				dateLabel: '2026-05-21',
				description:
					'AI 模式助手流式回复不再展示「思考过程」折叠区；「正在生成中…」旁的加载图标可正常旋转，与主站对话体验一致。',
			},
			{
				id: 's6-15',
				title: '知识库保存前自动格式化',
				dateLabel: '2026-05-21',
				description:
					'手动保存与防抖自动保存在落盘前会先按编辑器「格式化文档」规则整理 Markdown（含代码围栏安全处理），再写入云端或本地文件。',
			},
		],
	},
	{
		id: 's7',
		title: '7. Monaco 编辑器体验优化',
		items: [
			{
				id: 's7-1',
				title: '中文输入法（IME，输入法编辑器）兼容',
				dateLabel: '2026-04-14',
				description:
					'针对中文输入法可能出现的重影/叠字等问题提供缓解策略与实践经验。',
			},
			{
				id: 's7-2',
				title: '分屏预览跟随滚动',
				dateLabel: '2026-04-14',
				description:
					'支持编辑区与预览区滚动同步，并兼容图表分段渲染等复杂场景。',
			},
			{
				id: 's7-3',
				title: '桌面端布局稳定性',
				dateLabel: '2026-04-07',
				description:
					'在桌面端 WebView 环境下优化布局测量与重排策略，减少抖动与错位。',
			},
			{
				id: 's7-4',
				title: '剪贴板与快捷键策略',
				dateLabel: '2026-04-07',
				description:
					'避免编辑器快捷键与普通输入框冲突，保证复制/剪切/粘贴一致可用。',
			},
			{
				id: 's7-5',
				title: 'Markdown 分屏修改对照（Diff）',
				dateLabel: '2026-04-15～2026-04-16',
				description:
					'知识库 Markdown 底部操作栏支持「左编右只读 Diff」与「左编右预览」互斥切换；支持与「打开编辑器时的正文快照」对照，区分「无意义空对空」与「相对打开内容全部删除」等场景；修复对照会话切换、模型释放时序导致的异常或再进入内容残留问题。',
			},
			{
				id: 's7-6',
				title: 'Diff 对照准入规则工具化',
				dateLabel: '2026-04-16',
				description:
					'将「当前是否允许进入对照」抽取为独立工具函数，与底部栏按钮禁用、点击开启逻辑共用同一套规则，减少前后端心智不一致，并便于其它页面按需复用判定。',
			},
			{
				id: 's7-7',
				title: 'Diff 与粘性滚动（sticky scroll）协同',
				dateLabel: '2026-04-16',
				description:
					'Diff 与主编辑器共用粘性滚动开关；粘性条背景通过全局样式与主题变量对齐，减轻玻璃主题下色偏或装饰层干扰。',
			},
		],
	},
	{
		id: 's8',
		title: '8. 图表与代码块交互体验',
		items: [
			{
				id: 's8-1',
				title: 'Mermaid 交互',
				dateLabel: '2026-04-14',
				description: '支持图表缩放、预览等能力，提升复杂内容的可读性。',
			},
			{
				id: 's8-2',
				title: '代码块工具条',
				dateLabel: '2026-04-02',
				description:
					'在聊天等场景中为代码块提供更友好的操作（如复制、下载等），并优化滚动容器内的工具条布局体验。',
			},
		],
	},
	{
		id: 's9',
		title: '9. 系统设置与可用性',
		items: [
			{
				id: 's9-1',
				title: '快捷键冲突保护',
				dateLabel: '2026-04-14',
				description:
					'在系统设置中录制快捷键时，如果与现有快捷键冲突，将禁止保存并提示冲突项；冲突判定按「实际按键组合」识别，不受不同写法影响（例如 Command/Meta）。',
			},
			{
				id: 's9-2',
				title: '系统提示统一',
				dateLabel: '2026-04-14',
				description: '提示样式与交互统一，错误与信息提示更清晰一致。',
			},
			{
				id: 's9-3',
				title: '设置内可配置大模型',
				dateLabel: '2026-05-25',
				description:
					'登录后在设置中新增「大模型」页，可填写 API Key、接口地址（Base URL）与模型名称并保存到服务端；开启后对智能对话、知识库助手、知识库问答与英语学习等统一使用该配置；关闭或「恢复环境变量」后仍使用部署时的默认配置。',
			},
		],
	},
	{
		id: 's10',
		title: '10. UI 组件与体验',
		items: [
			{
				id: 's10-1',
				title: 'Image 组件优化',
				dateLabel: '2026-04-23',
				description:
					'优化图片组件在桌面端配置与资源更新场景下的表现，降低异常与重复加载风险。',
			},
			{
				id: 's10-2',
				title: '桌面端输入区：下拉触发器与主按钮同节点',
				dateLabel: '2026-05-02',
				description:
					'对话与知识库共用的底部输入组件（ChatEntry）在 Tauri（桌面壳）下，将「输入模式」下拉的触发器与主操作合并为同一可聚焦按钮，由 Radix（无障碍组件库）维护展开状态等属性，减少焦点与语义分离；悬停展开菜单、点击执行发送或语音逻辑的交互保持不变。',
			},
			{
				id: 's10-3',
				title: 'sendDisabled 可维护性',
				dateLabel: '2026-05-02',
				description:
					'发送/开麦主按钮禁用态改为 useMemo 与显式分支，并用 ?? false 归一化可选布尔，避免深层嵌套三元与歧义类型；行为与原先一致。',
			},
		],
	},
	{
		id: 's11',
		title: '11. 桌面端语音输入与转写（Tauri）',
		items: [
			{
				id: 's11-1',
				title: '停录不再发起整段二次转写',
				dateLabel: '2026-05-02',
				description:
					'语音录制过程中仍通过服务端对增量音频做实时转写并回填输入框；用户点击停止录音后，仅结束录音与释放麦克风，不再额外上传整段录音做一次覆盖式识别，以缩短停录等待并减少请求次数；最终文案以实时听写阶段已写入内容为准。',
			},
			{
				id: 's11-2',
				title: '输入模式菜单',
				dateLabel: '2026-05-02',
				description:
					'输入模式以下拉菜单项切换，选中态样式与图标色随当前模式高亮，与主发送/语音按钮同触发器区域，减少焦点分散。',
			},
		],
	},
	{
		id: 's12',
		title: '12. 国际化（界面语言）',
		items: [
			{
				id: 's12-1',
				title: '中英界面',
				dateLabel: '2026-05-02',
				description:
					'设置中可切换界面语言（中文 / English），主要页面与通用组件（含对话底部输入、知识库文档助手等）文案随之切换；知识库助手内输入模式等菜单与全局语言一致。',
			},
		],
	},
	{
		id: 's13',
		title: '13. 知识库 RAG 与助手多会话',
		items: [
			{
				id: 's13-1',
				title: '文档助手与 RAG',
				dateLabel: '2026-05-02',
				description:
					'知识库编辑器底部助手支持常规问答与 RAG（检索增强生成）模式；可展示检索引用与多轮上下文；交互与「§6」所列助手能力衔接。',
			},
			{
				id: 's13-2',
				title: '多会话与持久化',
				dateLabel: '2026-05-02',
				description:
					'同一文档下可维护多路助手会话并切换历史；区分临时会话与已落库会话的展示与恢复边界，避免切换文档或保存时机导致的会话错绑或流式中断（与「§6」「流式跨文档」条目互补）。',
			},
			{
				id: 's13-3',
				title: '助手与 RAG 问答模型接入统一',
				dateLabel: '2026-05-21',
				description:
					'知识库文档助手（AI 模式）与 RAG 检索问答的后端生成同样走硅基流动兼容接口；多轮历史、停止生成、检索引用展示与未保存草稿（ephemeral）等行为保持不变。',
			},
		],
	},
	{
		id: 's14',
		title: '14. 分享、公开阅读与聊天架构',
		items: [
			{
				id: 's14-1',
				title: '分享与公开阅读',
				dateLabel: '2026-05-02',
				description:
					'分享页支持会话只读浏览；消息顺序、用户侧代码块排版、知识正文预览与工具栏等与在线对话体验对齐。',
			},
			{
				id: 's14-2',
				title: 'Chatbot 能力域',
				dateLabel: '2026-05-02',
				description:
					'会话生命周期、SSE 流式、联网检索、附件与 OCR、异步落库等由前后端分工协作；历史变更以提交与发行说明为准。',
			},
		],
	},
	{
		id: 's15',
		title: '15. Monaco 与 Markdown 进阶能力（产品摘要）',
		items: [
			{
				id: 's15-1',
				title: '预览与导航',
				dateLabel: '2026-05-02',
				description:
					'Markdown 预览支持目录（TOC）与标题锚点/hash 跳转，长文浏览更省力。',
			},
			{
				id: 's15-2',
				title: '编辑区交互',
				dateLabel: '2026-05-02',
				description:
					'编辑器右键菜单与底部操作栏与知识库工作流集成；分屏 Diff 的准入、快照与粘性滚动等与「§7」一致。',
			},
			{
				id: 's15-3',
				title: '代码块与围栏',
				dateLabel: '2026-05-02',
				description:
					'支持对围栏代码块执行格式化（含 Prettier）、TSX 等高亮路径；无选区时剪切可对应整行等行为与桌面快捷键策略一致。',
			},
			{
				id: 's15-4',
				title: '分屏滚动与输入法',
				dateLabel: '2026-05-02',
				description:
					'编辑区与预览区跟滚策略持续迭代；中文输入法下的重影等问题有专项缓解。',
			},
			{
				id: 's15-5',
				title: 'Mermaid 与聊天内代码块',
				dateLabel: '2026-05-02',
				description:
					'Mermaid 围栏支持吸顶工具条（缩放等）；聊天消息内代码块支持浮动工具条，并与 React 并发外部存储等模式对齐以保证一致性。',
			},
		],
	},
	{
		id: 's16',
		title: '16. 桌面端剪贴板与布局专项',
		items: [
			{
				id: 's16-1',
				title: '全局快捷键与选区',
				dateLabel: '2026-05-02',
				description:
					'全局快捷键处理与 Monaco 选区逻辑解耦，减少「全选/复制」与编辑器焦点冲突。',
			},
			{
				id: 's16-2',
				title: 'Tauri 下编辑器布局',
				dateLabel: '2026-05-02',
				description:
					'桌面 WebView 内对编辑器容器采用显式布局策略，减轻测量抖动。',
			},
			{
				id: 's16-3',
				title: '系统级快捷键冲突与 Toast',
				dateLabel: '2026-05-02',
				description:
					'与操作系统或浏览器占用的快捷键冲突时，通过 Toast 等方式提示，录制流程可感知失败原因。',
			},
		],
	},
	{
		id: 's17',
		title: '17. 部署、网关与运维',
		items: [
			{
				id: 's17-1',
				title: '服务部署',
				dateLabel: '2026-05-02',
				description:
					'后端支持常见部署形态与环境变量配置；提供网关（Nginx）反向代理与 TLS 等示例思路，具体命令与文件以仓库运维说明为准。',
			},
		],
	},
	{
		id: 's18',
		title: '18. @dnhyxc-ai/markdown-kit 与围栏解析',
		items: [
			{
				id: 's18-1',
				title: '工具包',
				dateLabel: '2026-05-02',
				description:
					'共享工具包提供 Markdown 相关解析、构建脚本等能力，供前端与文档流水线复用。',
			},
			{
				id: 's18-2',
				title: '围栏按行解析',
				dateLabel: '2026-05-02',
				description: '围栏块支持按行解析策略，便于代码块与高亮管线扩展。',
			},
		],
	},
	{
		id: 's19',
		title: '19. 元数据与文档维护约定',
		items: [
			{
				id: 's19-1',
				title: '发布后对外同步',
				dateLabel: '2026-05-02',
				description:
					'发布流水线可附带 Wiki 或公开更新页的同步步骤，与「§1」的「公开更新页」互补，并支持本地验证时跳过。',
			},
			{
				id: 's19-2',
				title: '功能索引表',
				dateLabel: '2026-05-02',
				description:
					'仓库内维护与源码对照的功能域说明与文档登记表；新增或搬迁专题说明时，请同步更新该索引，避免读者迷路。',
			},
		],
	},
	{
		id: 's20',
		title: '20. 关于窗口与法律独立页',
		items: [
			{
				id: 's20-1',
				title: '关于内链改为外开浏览器',
				dateLabel: '2026-05-02',
				description:
					'关于窗口中的「服务政策」「用户服务协议」不再在子窗口内嵌跳转，改为使用当前站点根地址拼接固定路径，在系统浏览器或新标签中打开，便于阅读长文与复制链接。',
			},
			{
				id: 's20-2',
				title: '独立全屏路由',
				dateLabel: '2026-05-02',
				description:
					'用户服务政策与用户服务协议分别对应根路径 /service-policy 与 /user-agreement；页面不经主导航 Layout，形态与公开分享页一致，整屏可滚动。',
			},
			{
				id: 's20-3',
				title: '公开访问与文案',
				dateLabel: '2026-05-02',
				description:
					'上述路径纳入未登录可访问白名单；正文提供中英版本，随前端界面语言切换；实现代码集中在独立视图目录中，便于后续替换为正式法务文本。',
			},
			{
				id: 's20-4',
				title: '法律页顶栏语言切换',
				dateLabel: '2026-05-03',
				description:
					'/service-policy 与 /user-agreement 顶栏右侧提供与 /project-guide 一致的语言切换：通过路由跳转并附带 ?lang= 查询参数切换中 / 英，与独立页 URL 语言同步逻辑联动，无需先改全局设置再手动刷新。',
			},
		],
	},
	{
		id: 's21',
		title: '21. 更新信息独立页（结构化 UI）',
		items: [
			{
				id: 's21-1',
				title: '/update-info 独立页',
				dateLabel: '2026-05-02',
				description:
					'与分享页同型的全屏公开路由；顶栏含标题区等，主区为常规分区与条目分隔排版（非 Markdown 预览）。',
			},
			{
				id: 's21-2',
				title: '与本文档的关系',
				dateLabel: '2026-05-02',
				description:
					'线上展示不直接渲染本说明的原始稿，而是由前端 updateInfoSections 等结构化数据驱动；增删改本说明时请同步改代码中的数据，以免用户看到的内容与说明脱节。',
			},
			{
				id: 's21-3',
				title: '关于入口',
				dateLabel: '2026-05-02',
				description:
					'关于窗口中「更新说明」以绝对地址外开浏览器，打开即上述页面。',
			},
		],
	},
	{
		id: 's22',
		title: '22. 产品指南独立页与首页入口',
		items: [
			{
				id: 's22-1',
				title: '/project-guide 全屏公开路由',
				dateLabel: '2026-05-03',
				description:
					'产品功能说明独立页，不经主导航 Layout；顶栏含标题与语言切换（?lang=）；内容与产品功能详解说明（与本更新说明姊妹维护的那份正文）对齐，由前端 projectGuideSections（及英文 projectGuideSectionsEnOverlay）驱动。',
			},
			{
				id: 's22-2',
				title: '首页「了解更多」外开浏览器',
				dateLabel: '2026-05-03',
				description:
					'首页英雄区「了解更多」在桌面端通过系统默认浏览器、在网页端通过新标签打开产品指南页，并附带当前界面语言的 lang 查询参数。',
			},
			{
				id: 's22-3',
				title: '维护约定',
				dateLabel: '2026-05-03',
				description:
					'修订产品功能详解说明正文后，须同步更新前端内产品指南视图配套的结构化数据及路由路径常量，再发布前端包。',
			},
		],
	},
	{
		id: 's23',
		title: '23. 首页「快速开始」与注册入口',
		items: [
			{
				id: 's23-1',
				title: '步骤卡片与顶栏职责分离',
				dateLabel: '2026-05-14',
				description:
					'首页「快速开始」步骤列表中，指定步骤（如「注册账号」）整卡可点进入注册流程；顶栏主「快速开始」类入口仍进入智能对话（/chat），避免同一按钮承担多种易混语义。另有步骤（如「开始使用」）与顶栏一致进入对话主界面。',
			},
			{
				id: 's23-2',
				title: '登录页注册态与 URL 同步',
				dateLabel: '2026-05-14',
				description:
					'登录页支持通过查询参数 mode=register 直接呈现注册表单；在登录与注册视图之间切换时同步更新地址栏，并使用 replace 写入历史，减少重复 /login 堆栈，便于刷新、复制链接后仍落在正确视图。',
			},
		],
	},
	{
		id: 's24',
		title: '24. 英语学习（单词包、经典句与收藏）',
		items: [
			{
				id: 's24-1',
				title: '主题驱动的生成与流式输出',
				dateLabel: '2026-05-14',
				description:
					'登录用户可在英语学习专区内按主题生成单词包与经典句等学习内容；生成过程以 SSE（服务端事件）流式呈现，并配套会话侧取消、多轮 Agent 对话与错误提示等体验。',
			},
			{
				id: 's24-2',
				title: '快捷意图（芯片）',
				dateLabel: '2026-05-14',
				description:
					'工具栏提供快捷意图条目，为发送内容附加前缀；支持再次点击取消选中，文案随「§12」界面语言切换。',
			},
			{
				id: 's24-3',
				title: '左栏表单跨路由持久化',
				dateLabel: '2026-05-14',
				description:
					'离开英语学习路由再返回时，左栏主题、数量等输入与意图镜像可恢复，减少重复填写；与包生成流式状态的单例 Store 协同。',
			},
			{
				id: 's24-4',
				title: '收藏与抽屉',
				dateLabel: '2026-05-14',
				description:
					'单词与经典句支持收藏，在抽屉中分页浏览与管理；列表与侧栏交互经专项优化（如折叠记忆等，以实现为准）。',
			},
			{
				id: 's24-5',
				title: '收藏导出 Word（DOCX）',
				dateLabel: '2026-05-14',
				description:
					'支持将单词收藏或经典句收藏一键导出为 DOCX；由服务端按用户汇总至多约 3000 条（按收藏时间倒序，与前端列表分页解耦），在浏览器与 Tauri（桌面壳）下统一走二进制下载与本地保存流程。',
			},
			{
				id: 's24-6',
				title: '主检索与按需联网、RAG',
				dateLabel: '2026-05-14',
				description:
					'包生成主阶段由 Agent 汇总要点；联网检索由模型结合提示词按需触发，并对主题中的日期、时效类语义做统一解析与检索参数映射，减少无意义的例行联网；可与知识库 RAG（检索增强生成）等工具协同，引用与阅读体验与对话域能力对齐。',
			},
			{
				id: 's24-7',
				title: 'JSON 导入与资源库持久化',
				dateLabel: '2026-05-19',
				description:
					'独立导入页 /english-learning/import（kind=vocab|classic）；拖拽选文件、JSON 预览与校验、标题保存；单词库/语句库主表+词条子表分页存储；大包 multipart 上传；左栏集中导入与库入口；导入成功后跳转资源库并选中新建库。',
			},
			{
				id: 's24-8',
				title: '资源库列表分页、删除与会话缓存',
				dateLabel: '2026-05-19',
				description:
					'资源库右侧词条分页加载；删除单词库二次确认并级联删词条；同一会话内切换库再返回可恢复已加载分页与滚动位置（刷新后清空）。',
			},
			{
				id: 's24-9',
				title: '拉取历史删除与结果页体验',
				dateLabel: '2026-05-19',
				description:
					'历史抽屉可删除已结束记录并级联清理明细；打开历史仅进结果页、不回填左栏表单；进行中会话有标识且通常不可删；结果页主题与联网摘要上移；Agent 保存后可跳转知识库。',
			},
			{
				id: 's24-10',
				title: '英语学习 Agent 多会话与历史抽屉',
				dateLabel: '2026-05-19',
				description:
					'按会话隔离消息与 SSE；历史抽屉分页、切换与 URL 对齐；新对话不预建空会话；快捷意图 intentPrefix 不入库；占位消息 ID 由 SSE 回填真实 ID。',
			},
			{
				id: 's24-11',
				title: '收藏抽屉批量移除与快捷意图折叠',
				dateLabel: '2026-05-19',
				description:
					'收藏抽屉多选、批量/单条取消收藏（二次确认）；左栏快捷意图默认展示前 2 条、可展开全部。',
			},
			{
				id: 's24-12',
				title: '单词词性（pos）全链路',
				dateLabel: '2026-05-19',
				description:
					'流式拉取、列表、收藏与 DOCX 导出携带英文缩写词性；旧数据无词性按空处理。',
			},
			{
				id: 's24-13',
				title: '列表网络重试与错误提示优化',
				dateLabel: '2026-05-19',
				description:
					'Tauri 下 GET 默认额外重试；资源库/收藏/包列表分批查收藏状态并重试；列表失败 Toast 用 i18n 可读文案；收藏状态防抖与渐进点亮星标。',
			},
			{
				id: 's24-14',
				title: '流式停止与静默取消请求',
				dateLabel: '2026-05-19',
				description:
					'停止 SSE 时本地 abort 并可通知服务端释放；取消请求静默，用户主动停止不再弹错误 Toast。',
			},
			{
				id: 's24-15',
				title: '单词 / 经典句列表折叠',
				dateLabel: '2026-05-19',
				description:
					'已拉取条目网格可收起/展开；新拉取自动展开；无障碍标签与界面语言一致。',
			},
		],
	},
];

/** 页首说明（与对外更新信息说明首段一致） */
const UPDATE_INFO_INTRO_ZH =
	'这里汇总了本项目目前已具备的核心能力与近期更新点，方便你快速了解「新增/优化了什么」。以下内容为产品级说明，强调可感知的功能与体验提升；正文不列出工程内部的文件或目录路径，实现与专题细节请在本地克隆的仓库中按专题自行检索配套说明。';

function mapUpdateInfoSectionsToLocale(
	zh: UpdateInfoSection[],
	locale: Locale,
): UpdateInfoSection[] {
	if (locale !== 'en-US') return zh;
	return zh.map((sec) => ({
		...sec,
		title: UPDATE_INFO_SECTION_TITLES_EN[sec.id] ?? sec.title,
		items: sec.items.map((it) => {
			const en = UPDATE_INFO_BULLETS_EN[it.id];
			return en ? { ...it, title: en.title, description: en.description } : it;
		}),
	}));
}

/** 按界面语言返回章节列表（与 legal 页 getSections(locale) 用法一致） */
export function getUpdateInfoSections(locale: Locale): UpdateInfoSection[] {
	return mapUpdateInfoSectionsToLocale(UPDATE_INFO_SECTIONS_ZH, locale);
}

/** 按界面语言返回页首说明 */
export function getUpdateInfoIntro(locale: Locale): string {
	return locale === 'en-US' ? UPDATE_INFO_INTRO_EN : UPDATE_INFO_INTRO_ZH;
}
