/**
 * Markdown 围栏代码块（fence）**带工具栏** 的 DOM 契约（centralization，集中管理）。
 *
 * 说明：HTML 中的 `class` / `data-*` **字面量** 仍含 `chat-md-*`、`data-chat-code-*` 等历史前缀，
 * 与现有样式、已发布页面兼容；本文件提供的是 **TypeScript 侧公共标识符**，供解析器、事件绑定、
 * 浮动布局等统一引用，避免「名字像仅聊天场景」导致误读。
 *
 * 背景：
 * - `MarkdownParser.patchChatCodeFenceRenderer` 输出固定结构
 * - `markdown/code-fence-actions.ts`、宿主（聊天/预览等）需与之同源查询
 */

/** 围栏代码块外层包裹 class（与 `patchChatCodeFenceRenderer` 输出一致） */
export const MARKDOWN_CODE_FENCE_BLOCK_WRAPPER_CLASS = 'chat-md-code-block';

/**
 * 围栏代码块根节点标记属性（boolean attribute，HTML 中写作无值 `data-chat-code-block`）。
 */
export const MARKDOWN_CODE_FENCE_BLOCK_ROOT_ATTR = 'data-chat-code-block';

/** 工具栏占位槽 class（吸顶浮动条替换时写 `minHeight` 防抖布局跳动） */
export const MARKDOWN_CODE_FENCE_TOOLBAR_SLOT_CLASS =
	'chat-md-code-toolbar-slot';

/** 行内工具栏容器 class */
export const MARKDOWN_CODE_FENCE_TOOLBAR_CLASS = 'chat-md-code-toolbar';

/**
 * 浮动吸顶条替代原位工具栏时，加在原工具栏上的 class（原位让位 / 样式隐藏）。
 */
export const MARKDOWN_CODE_FENCE_TOOLBAR_FLOAT_REPLACED_CLASS =
	'chat-md-code-toolbar--replaced-by-float';

/** 语言展示标签 class */
export const MARKDOWN_CODE_FENCE_TOOLBAR_LANG_CLASS = 'chat-md-code-lang';

/** 复制 / 下载 按钮组外层 class */
export const MARKDOWN_CODE_FENCE_TOOLBAR_ACTIONS_CLASS = 'chat-md-code-actions';

/** 单个操作按钮 class */
export const MARKDOWN_CODE_FENCE_TOOLBAR_BTN_CLASS = 'chat-md-code-btn';

/** 按钮动作属性名：`copy` | `download` */
export const MARKDOWN_CODE_FENCE_DATA_ACTION_ATTR = 'data-chat-code-action';

/** 下载按钮上携带的语言标记属性名（与展示语言一致） */
export const MARKDOWN_CODE_FENCE_DATA_BUTTON_LANG_ATTR = 'data-chat-code-lang';

/** 复制成功后的临时状态属性名 */
export const MARKDOWN_CODE_FENCE_DATA_COPY_STATE_ATTR = 'data-chat-code-copied';

// ---------- 派生选择器 ----------

/** 围栏块根：`[data-chat-code-block]` */
export const MARKDOWN_CODE_FENCE_BLOCK_ROOT_SELECTOR = `[${MARKDOWN_CODE_FENCE_BLOCK_ROOT_ATTR}]`;

/** 行内工具栏：`.chat-md-code-toolbar` */
export const MARKDOWN_CODE_FENCE_TOOLBAR_SELECTOR = `.${MARKDOWN_CODE_FENCE_TOOLBAR_CLASS}`;

/** 工具栏占位槽：`.chat-md-code-toolbar-slot` */
export const MARKDOWN_CODE_FENCE_TOOLBAR_SLOT_SELECTOR = `.${MARKDOWN_CODE_FENCE_TOOLBAR_SLOT_CLASS}`;

/** 语言标签：`.chat-md-code-lang` */
export const MARKDOWN_CODE_FENCE_TOOLBAR_LANG_SELECTOR = `.${MARKDOWN_CODE_FENCE_TOOLBAR_LANG_CLASS}`;

/**
 * 围栏内源码节点：`pre code`（与 `patchChatCodeFenceRenderer` 的 `<pre><code>` 一致）。
 */
export const MARKDOWN_CODE_FENCE_SOURCE_CODE_SELECTOR = 'pre code';

/** 带 `data-chat-code-action` 的按钮（事件委托定位用） */
export const MARKDOWN_CODE_FENCE_ACTION_BUTTON_SELECTOR = `[${MARKDOWN_CODE_FENCE_DATA_ACTION_ATTR}]`;

/**
 * 在 `root` 子树内收集所有「围栏代码块根」节点。
 */
export function queryMarkdownCodeFenceBlockRoots(
	root: ParentNode,
): NodeListOf<HTMLElement> {
	return root.querySelectorAll<HTMLElement>(
		MARKDOWN_CODE_FENCE_BLOCK_ROOT_SELECTOR,
	);
}
