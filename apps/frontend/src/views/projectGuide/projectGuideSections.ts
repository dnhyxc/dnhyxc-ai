/**
 * 与 docs/project-guide.md 对齐的章节数据（产品指南独立页）。
 * 文档增删改时请同步维护本文件。
 * 英文正文映射见 projectGuideSectionsEnOverlay.ts。
 */

import type { Locale } from '@/i18n';
import {
	PROJECT_GUIDE_ITEMS_EN,
	PROJECT_GUIDE_SECTION_TITLES_EN,
} from './projectGuideSectionsEnOverlay';

export type ProjectGuideItem = {
	id: string;
	title: string;
	description: string;
};

export type ProjectGuideSection = {
	id: string;
	title: string;
	items: ProjectGuideItem[];
};

const PROJECT_GUIDE_SECTIONS_ZH: ProjectGuideSection[] = [
	{
		id: 'pg-s1',
		title: '1. 你可以用它做什么',
		items: [
			{
				id: 'pg-s1-1',
				title: '对话（Chat）',
				description: '进行日常问答、方案讨论、写作润色、代码与文档协作等。',
			},
			{
				id: 'pg-s1-2',
				title: '知识库（Knowledge）',
				description:
					'用 Markdown 记录与整理资料（可云端/本地两种模式），并在写作与检索中复用。',
			},
			{
				id: 'pg-s1-3',
				title: 'Markdown 增强',
				description:
					'支持数学公式、代码高亮、任务列表、Mermaid 图表等，适合写技术笔记与方案文档。',
			},
			{
				id: 'pg-s1-4',
				title: '桌面端体验',
				description:
					'在桌面客户端可使用更多系统能力（例如全局快捷键、选择目录、开机自启等）。',
			},
		],
	},
	{
		id: 'pg-s2',
		title: '2. 运行形态与差异（桌面端 vs 浏览器）',
		items: [
			{
				id: 'pg-s2-1',
				title: '2.1 桌面端（推荐）',
				description:
					'适合需要「更强本地能力」的用户：可使用全局快捷键（跨应用生效）、可选择本地目录作为文件存储位置、可使用部分系统级能力（如开机自启等）。适合重度写作/长期知识管理。',
			},
			{
				id: 'pg-s2-2',
				title: '2.2 浏览器端',
				description:
					'适合快速访问、临时使用；功能以网页可实现的能力为主，一些系统级能力会提示「仅桌面端可用」。',
			},
		],
	},
	{
		id: 'pg-s3',
		title: '3. 快速上手（5 分钟）',
		items: [
			{
				id: 'pg-s3-1',
				title: '3.1 第一次使用建议',
				description:
					'1）先进入对话：尝试问一个你正在做的任务（例如「帮我写一份周报」「帮我做一个方案对比」）。\n2）再进入知识库：创建一篇 Markdown 记录，把对话结论沉淀下来。\n3）如你经常写技术文档：试试任务列表、数学公式、Mermaid 图表。',
			},
			{
				id: 'pg-s3-2',
				title: '3.2 常见使用姿势',
				description:
					'边聊边记：先用对话梳理思路，再把结论写入知识库。\n资料整理：把外部资料（链接、摘要、要点）整理为 Markdown，形成可检索、可复用的笔记。\n方案沉淀：用 Markdown 写「背景—目标—方案—权衡—结论」，配 Mermaid 流程图/时序图。',
			},
		],
	},
	{
		id: 'pg-s4',
		title: '4. 对话（Chat）详细教程',
		items: [
			{
				id: 'pg-s4-1',
				title: '4.1 基础对话',
				description:
					'可直接输入问题或任务描述。推荐结构：背景（我在做什么？现状是什么？）、目标（希望得到什么输出？）、约束（字数、风格、受众、是否要步骤/对比）、输出格式（表格、编号步骤等）。示例：我在做产品需求评审，目标是一页 PRD 摘要，约束 300 字以内，格式用要点列表。',
			},
			{
				id: 'pg-s4-2',
				title: '4.2 流式输出与停止/续写',
				description:
					'回答会边生成边展示；可随时停止生成；可在当前回答基础上续写。',
			},
			{
				id: 'pg-s4-3',
				title: '4.3 联网检索与引用',
				description:
					'需要最新信息或来源佐证时，可要求「联网检索并给出引用」；也可要求只引用权威来源、给出可点击引用、先列引用再总结。',
			},
			{
				id: 'pg-s4-4',
				title: '4.4 附件与 OCR（图片/截图文字）',
				description:
					'上传附件后可要求提取文字并总结要点、识别表格并转为 Markdown 表格等。',
			},
			{
				id: 'pg-s4-5',
				title: '4.5 桌面端语音输入（Tauri，桌面壳）',
				description:
					'桌面客户端对话底部可在文本与语音间切换：悬停圆形主按钮展开「输入模式」菜单；语音模式下点击主按钮开始说话，识别文字持续写入输入框，再次点击结束录音；可随时编辑再发送。界面语言切换为英文后，菜单与提示随之切换。',
			},
		],
	},
	{
		id: 'pg-s5',
		title: '5. 知识库（Knowledge）详细教程',
		items: [
			{
				id: 'pg-s5-1',
				title: '5.1 两种模式：云端 vs 本地',
				description:
					'云端适合多设备同步；本地适合把知识库放在自己的文件夹（Markdown 可被任意编辑器打开）。未登录时默认本地模式，并隐藏不适用入口（如回收站）。',
			},
			{
				id: 'pg-s5-2',
				title: '5.2 创建与编辑',
				description:
					'新建文档（标题 + 正文）→ 用 Markdown 编写 → 保存（手动/自动）。建议结构：标题、背景、目标、结论（先写结论）、过程与论据、待办（任务列表）、参考链接。',
			},
			{
				id: 'pg-s5-3',
				title: '5.3 保存、覆盖保存与自动保存',
				description:
					'手动保存适合「确认一次再落盘」；覆盖保存适合持续维护同一文档；自动保存（防抖）在停止编辑一段时间后触发，减少遗漏。长文建议开自动保存；结构化整理可选手动保存。',
			},
			{
				id: 'pg-s5-4',
				title: '5.4 本地文件夹：扫描、打开、删除与外部编辑器',
				description:
					'列表递归扫描目录下 Markdown；可应用内编辑保存，或在外部编辑器打开。桌面端删除：本地列表中的文件删除仅影响磁盘；云端条目若关联本地同名文件，确认框可提供「删除本地文件 / 删除在线文件 / 同时删除」。',
			},
			{
				id: 'pg-s5-5',
				title: '5.5 回收站（如可用）',
				description: '使用云端管理时，删除内容可能进入回收站以便误删恢复。',
			},
			{
				id: 'pg-s5-6',
				title: '5.6 文档内 AI 助手（需登录）',
				description:
					'已登录时在编辑器底部可使用知识库文档助手，结合正文多轮对话。未登录不展示该区域。长对话可用输入框右上方滚动到底部/顶部；流式生成时可滚回底部继续跟随。桌面端已登录时助手输入区支持文本/语音切换，随界面语言显示；语音模式下识别文字实时填入输入框。',
			},
		],
	},
	{
		id: 'pg-s6',
		title: '6. Markdown 写作能力（让文档更强）',
		items: [
			{
				id: 'pg-s6-1',
				title: '6.1 任务列表（TODO）',
				description: '适合写计划、排期与验收点（未完成 / 已完成勾选）。',
			},
			{
				id: 'pg-s6-2',
				title: '6.2 数学公式（KaTeX）',
				description: '支持行内与块级公式，适合算法与推导说明。',
			},
			{
				id: 'pg-s6-3',
				title: '6.3 代码块与高亮',
				description: '适合技术文档、命令记录与代码片段，不同语言有不同高亮。',
			},
			{
				id: 'pg-s6-4',
				title: '6.4 Mermaid 图表',
				description:
					'流程图、时序图、状态图等；可先让对话生成草稿再粘入知识库微调。',
			},
		],
	},
	{
		id: 'pg-s7',
		title: '7. 快捷键（提高效率）',
		items: [
			{
				id: 'pg-s7-1',
				title: '7.1 全局快捷键（桌面端）',
				description:
					'可设置全局快捷键执行常用动作；与已有快捷键冲突时系统会阻止保存并提示冲突项。',
			},
			{
				id: 'pg-s7-2',
				title: '7.2 页面内快捷键（知识库）',
				description: '如保存、清空草稿等仅在知识库页生效，避免误触。',
			},
		],
	},
	{
		id: 'pg-s8',
		title: '8. 设置项建议（推荐配置）',
		items: [
			{
				id: 'pg-s8-1',
				title: '8.1 文件存储',
				description: '桌面端可选择默认存储目录（如同步盘、工作目录）。',
			},
			{
				id: 'pg-s8-2',
				title: '8.2 启动与关闭行为（桌面端）',
				description:
					'需要随时可用：可开启开机自启、关闭时最小化到托盘；更注重资源释放：关闭时直接退出。',
			},
		],
	},
	{
		id: 'pg-s9',
		title: '9. 常见问题（FAQ）',
		items: [
			{
				id: 'pg-s9-1',
				title: '9.1 为什么有些功能提示「仅桌面端可用」？',
				description:
					'浏览器受安全限制无法直接调用部分系统能力；桌面端具备这些能力，体验更完整。',
			},
			{
				id: 'pg-s9-2',
				title: '9.2 Markdown 显示与预期不一致？',
				description:
					'检查代码块围栏是否闭合；Mermaid/公式语法是否正确；可分段排查。若粘贴大段 ```tsx 且内含字面量 ```mermaid 等，格式化时围栏可能变化；建议先备份或分段粘贴。',
			},
			{
				id: 'pg-s9-3',
				title: '9.3 如何把对话结论沉淀成知识？',
				description:
					'让 AI 输出结论 + 关键要点 + 待办清单 → 复制到知识库 → 补充背景、约束与最终决策。',
			},
		],
	},
	{
		id: 'pg-s10',
		title: '10. 术语小字典',
		items: [
			{
				id: 'pg-s10-1',
				title: '术语条目',
				description:
					'Tauri（桌面壳）：把 Web 前端打包成桌面应用的方式。\nSSE（服务端事件）：服务器持续向客户端推送数据，常用于流式输出。\nOCR（光学字符识别）：从图片中提取文字。\nGFM（GitHub 风格 Markdown）：常用 Markdown 扩展规范。\nMermaid（图表语法）：用文本描述流程图/时序图等。\nDebounce（防抖）：停止操作一段时间后再执行，常用于减少频繁保存。\nRAG（检索增强生成）：先从资料检索相关片段再结合模型生成（知识库助手相关模式）。',
			},
		],
	},
	{
		id: 'pg-s11',
		title: '11. 分享、RAG 模式与界面语言',
		items: [
			{
				id: 'pg-s11-1',
				title: '11.1 分享会话（只读浏览）',
				description:
					'生成链接供他人在浏览器只读查看，无需安装客户端；消息顺序与对话一致（含分支/重生成）；排版与在线阅读体验一致。',
			},
			{
				id: 'pg-s11-2',
				title: '11.2 知识库助手：AI 模式与 RAG 模式',
				description:
					'已登录编辑时可切换 AI 模式（结合正文多轮）与 RAG 模式（检索增强，适合对着资料提问）。切换与流式输出风格与对话页一致，检索内容常以引用形式呈现。',
			},
			{
				id: 'pg-s11-3',
				title: '11.3 界面语言（中文 / 英文）',
				description:
					'设置中切换语言后，对话、知识库助手、菜单与常见提示随之切换；桌面语音依赖麦克风权限；个别新界面若未接入翻译键可反馈维护者。',
			},
		],
	},
	{
		id: 'pg-s12',
		title: '12. 编辑器里还能做什么（知识库 Markdown）',
		items: [
			{
				id: 'pg-s12-1',
				title: '预览侧目录与锚点跳转',
				description:
					'长文可在预览区通过目录或小标题快速定位，支持标题锚点与 hash 跳转。',
			},
			{
				id: 'pg-s12-2',
				title: '右键上下文菜单',
				description:
					'编辑区选中文本后可通过快捷菜单完成常用编辑，与底部操作栏互补。',
			},
			{
				id: 'pg-s12-3',
				title: 'Mermaid 图表缩放与预览',
				description: '复杂图表可放大、预览查看，减少误读。',
			},
			{
				id: 'pg-s12-4',
				title: '代码块格式化',
				description:
					'支持的语言可对代码块格式化；嵌套围栏的复杂片段建议先备份或分段处理。',
			},
		],
	},
	{
		id: 'pg-s13',
		title: '13. 想深入了解时从哪里查阅',
		items: [
			{
				id: 'pg-s13-1',
				title: '仓库内说明文档',
				description:
					'本页面向日常使用。若需自行部署后端、配置反向代理、排查编辑器边界或参与开发，请在本地克隆的仓库中打开随代码维护的说明文档目录（与源码同级、按专题拆分），按目录名或关键词检索即可。',
			},
		],
	},
	{
		id: 'pg-s14',
		title: '14. 关于窗口与法律文档（服务政策 / 用户协议）',
		items: [
			{
				id: 'pg-s14-1',
				title: '服务政策与用户协议打开方式',
				description:
					'关于窗口底部可打开「服务政策」「用户服务协议」：桌面端在系统默认浏览器打开，网页端在新标签打开站点内页面；不经主导航 Layout，整页滚动。路径：/service-policy、/user-agreement；未登录可访问；语言随设置中英文切换。',
			},
			{
				id: 'pg-s14-2',
				title: '更新说明（独立结构化页）',
				description:
					'关于窗口亦可打开「更新说明」，路径 /update-info；不经主导航 Layout，形态与分享页类似；内容由前端数据模块维护并与仓库《更新信息》文档同步。',
			},
		],
	},
];

function mapProjectGuideSectionsToLocale(
	zh: ProjectGuideSection[],
	locale: Locale,
): ProjectGuideSection[] {
	if (locale !== 'en-US') return zh;
	return zh.map((sec) => ({
		...sec,
		title: PROJECT_GUIDE_SECTION_TITLES_EN[sec.id] ?? sec.title,
		items: sec.items.map((it) => {
			const en = PROJECT_GUIDE_ITEMS_EN[it.id];
			return en ? { ...it, title: en.title, description: en.description } : it;
		}),
	}));
}

export function getProjectGuideSections(locale: Locale): ProjectGuideSection[] {
	return mapProjectGuideSectionsToLocale(PROJECT_GUIDE_SECTIONS_ZH, locale);
}
