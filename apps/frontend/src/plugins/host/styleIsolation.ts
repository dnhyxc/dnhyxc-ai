/**
 * Host 侧 CSS 隔离（对齐 qiankun experimentalStyleIsolation + 社区 body 弹层修法）：
 * 1) 选择器前缀：:root → realm（CSS 变量，浮层根也要）；html/body →
 *    `[realm][data-plugin-root]`（布局规则勿打到 Teleport Toast，否则 height:100% 拉成竖条）；
 *    其余：`[realm] .x` + `[realm].x`。
 *    `:root`/`:host` 上的 Host 语义主题 token（`--brand-accent` / `--theme-*` / shadcn 底色等）
 *    会剥离，避免盖住主站主题；保留 `--color-*`、`--el-*` 等别名与组件库变量。
 *    括号扫描须识别选择器 `\` 转义（Tailwind `content-[\"\"]`），否则 @layer 配对失败会整段泄漏。
 *    **不改 @keyframes 名**：antd 把 keyframes 与 animation-name 分到两个 style（updateCSS），
 *    按单标签改名会对不上，Message/Toast 离开动画永不触发。
 * 2) Portal：全屏 fixed + pointer-events:none 的 overlay 根；子节点恢复 pointer-events。
 * 3) body 挂载时给节点打 data-mf-style-realm（qiankun#2391 同类思路）。
 * @font-face/@import 全局；选择器前缀隔离；CSSOM / removeChild 镜像照旧。
 */

// React：isValidElement 与 ReactNode，供 Portal 子树改挂时判定
import { isValidElement, type ReactNode } from 'react';
// ReactDOM：拦截 createPortal，把弹层挂到插件 scope 容器
import ReactDOM from 'react-dom';

// 一次样式捕获窗口的上下文：插件 id、共享 realm、Remote origin
type CaptureCtx = {
	// 发起捕获的插件标识，用于 owner 兼容与 Portal 认领
	pluginId: string;
	/** realm / mfStyleOwner 键：同一 Remote 多插件共享 */
	realm: string;
	// Remote entry 的 origin，用于认领同域 link/style
	entryOrigin: string;
	// 结束 CaptureCtx 类型
};

/** 嵌套 begin/attach 用栈，避免并行加载时 active 互相覆盖 */
// 见上行 JSDoc：嵌套 begin/attach 用栈，并行加载时避免 active 互相覆盖
const captureStack: CaptureCtx[] = [];
// 取栈顶捕获上下文；栈空时返回 null，表示不在捕获窗口
function activeCtx(): CaptureCtx | null {
	// 返回栈顶 ctx，空栈则 null
	return captureStack[captureStack.length - 1] ?? null;
	// 结束 activeCtx
}

// head 原型 patch 引用计数：嵌套 begin 时只装一次、末次释放
let patchDepth = 0;
// 保存 document.head.appendChild 原实现，供 patch 内先挂再处理
let origAppend: <T extends Node>(node: T) => T;
// 保存 document.head.insertBefore 原实现
let origInsert: <T extends Node>(node: T, ref: Node | null) => T;

/** 指针/焦点跨越插件边界时更新；多数移动早退，避免 pointerover 热路径开销 */
// 见上行 JSDoc：最近交互过的 pluginId，供 Portal 无 override 时认领
let lastTouchedPluginId: string | null = null;
// pointer/focus 桥是否已装，避免重复 addEventListener
let touchBridgeInstalled = false;

// 匹配整段 @font-face（含嵌套大括号），供 hoist 为全局
const FONT_FACE_RE = /@font-face\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g;
/** 隔离协议版本标记；升版后强制重写 head 里旧前缀 CSS */
const MF_ISO_MARK = '/*mf-iso:3*/';
const MF_ISO_MARK_RE = /\/\*mf-iso(?::\d+)?\*\//g;
/** html/body 布局选择器后缀：只命中插件根，不命中打了 realm 的浮层 */
const PLUGIN_ROOT_ATTR = '[data-plugin-root]';
// 匹配 @namespace 声明，须 hoist 到文件顶
const NAMESPACE_RE = /@namespace\s+[^;]+;/g;
// @import 正则续行声明：整句提到文件最前
const IMPORT_RE =
	// 匹配 url(...) 或字符串形式的 @import 整句
	/@import\s+(?:url\(\s*["']?[^"')]+["']?\s*\)|["'][^"']+["'])[^;]*;/g;

// 把选择器里的特殊字符转义，避免 realm 含 : / 时属性选择器非法
function cssEscapeIdent(id: string): string {
	// 浏览器提供 CSS.escape 时优先用标准实现
	if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
		// 返回规范转义后的标识/字符串片段
		return CSS.escape(id);
		// 结束 CSS.escape 可用分支
	}
	// 无 CSS.escape 时手工转义非 [A-Za-z0-9_-] 字符
	return id.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
	// 结束 cssEscapeIdent
}

/**
 * 同一 MF Remote（同 entry 源）共用一个样式域。
 * 优先 entry origin+目录；显式 remoteName 且异于 id 时作补充键。
 */
// 见上行 JSDoc：由 entry URL 推导同 Remote 共享的样式域键
export function styleRealmKey(
	// Remote entry 地址（manifest 或 remoteEntry）
	entry: string,
	// 可选 Module Federation remote 名
	remoteName?: string,
	// 可选插件 id，URL 解析失败时的最终回退键
	pluginId?: string,
	// 返回 realm 字符串；try 内按 URL 规范化
): string {
	// 尝试按绝对 URL 规范化 entry
	try {
		// 解析 entry 为 URL；非法则进 catch 回退分支
		const u = new URL(entry);
		// 去掉 query，避免同入口不同缓存参数拆成多 realm
		u.search = '';
		// 去掉 hash，只保留定位路径
		u.hash = '';
		// 剥掉末尾 manifest/remoteEntry 文件名，得到 Remote 根路径
		let path = u.pathname.replace(
			// 匹配 mf-manifest.json 或 remoteEntry.js（可带尾斜杠）
			/\/(?:mf-manifest\.json|remoteEntry\.js)\/?$/i,
			// replace 第二参：删掉入口文件名，留下目录路径
			'',
			// 结束 pathname.replace 调用
		);
		// 保证路径以 / 结尾，统一目录形态的 realm 键
		if (!path.endsWith('/')) path += '/';
		// 返回 entry:origin+path 形式的共享 realm
		return `entry:${u.origin}${path}`;
		// URL 非法时按 remoteName / pluginId 回退
	} catch {
		// 去掉 remoteName 首尾空白
		const named = remoteName?.trim();
		// 显式 remote 名且不同于 pluginId 时用 remote: 键
		if (named && named !== pluginId) return `remote:${named}`;
		// 再无可用名则用 plugin: 键，unknown 兜底
		return `plugin:${pluginId || 'unknown'}`;
		// 结束 styleRealmKey 的 catch
	}
	// 结束 styleRealmKey
}

// 生成与 DOM data-mf-style-realm 匹配的属性选择器（引号内转义，勿用 CSS.escape）
function scopeSelector(realm: string): string {
	const v = realm.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	return `[data-mf-style-realm="${v}"]`;
}

/** 已带当前协议标记 + realm 前缀（transpile 可跳过） */
function alreadyScoped(text: string, sel: string): boolean {
	return (
		text.includes(MF_ISO_MARK) &&
		text.includes('data-mf-style-realm=') &&
		text.includes(sel)
	);
}

/**
 * HMR/回写是否还需要再 wrap。
 * 已有 realm 前缀且无旧 @scope → false（避免与 antd cssinjs 互殴卡死）。
 */
function styleNeedsRescope(text: string, sel: string): boolean {
	const t = text.trim();
	if (!t) return false;
	if (/@scope\s*\(/.test(t)) return true;
	// 任意版本 mf-iso 且已含本 realm 选择器 → 视为已前缀，勿再写 textContent
	if (text.includes(sel) && /\/\*mf-iso(?::\d+)?\*\//.test(text)) return false;
	if (text.includes(sel)) return false;
	return true;
}

/** 按大括号深度剥最外层 @scope (…) { … }，保留 hoist 段 */
// 见上行 JSDoc：按大括号深度剥最外层 @scope，保留 hoist 段
function unwrapScope(cssText: string): string {
	// 定位最外层 @scope (…) { 的起始
	const m = cssText.match(/@scope\s*\([^)]*\)\s*\{/);
	// 无匹配或无 index 则原样返回（未包 scope 或异常）
	if (!m || m.index == null) return cssText;
	// @scope 匹配起点下标
	const start = m.index;
	// 外层 { 的下标（match 末字符）
	const openAt = start + m[0].length - 1;
	// 大括号嵌套深度，用于找到配对的外层 }
	let depth = 0;
	// 从开括号起扫描到串尾找闭合
	for (let i = openAt; i < cssText.length; i++) {
		// 当前字符
		const ch = cssText[i];
		// 遇 { 加深一层
		if (ch === '{') depth++;
		// 遇 } 进入减深分支
		else if (ch === '}') {
			// 减一层深度
			depth--;
			// 回到 0 说明外层 @scope 块结束
			if (depth === 0) {
				// @scope 之前的 hoist/前缀文本
				const before = cssText.slice(0, start).trimEnd();
				// @scope 大括号内的样式正文
				const inner = cssText.slice(openAt + 1, i).trim();
				// 闭合 } 之后的剩余文本
				const after = cssText.slice(i + 1).trim();
				// 拼接非空三段，剥掉最外层 scope
				return [before, inner, after].filter(Boolean).join('\n');
				// 结束 depth===0 分支
			}
			// 结束 ch==='}' 分支
		}
		// 结束 for 扫描
	}
	// 未找到配对 } 则原样返回，避免截断损坏
	return cssText;
	// 结束 unwrapScope
}

// 用正则抽出 at-rule，返回抽出列表与剩余 CSS
function extractAtRules(
	// 待扫描的 CSS 文本
	cssText: string,
	// 匹配目标 at-rule 的全局正则
	regex: RegExp,
	// 返回类型：抽出片段与剩余串；函数体开始
): { extracted: string[]; remaining: string } {
	// 收集匹配到的 at-rule 原文
	const extracted: string[] = [];
	// replace 回调：记下 match 并从正文删除
	const remaining = cssText.replace(regex, (match) => {
		// 把整段 match 推进 extracted
		extracted.push(match);
		// 用空串删掉该 at-rule，留给后续 hoist
		return '';
		// 结束 replace 回调
	});
	// 返回抽出结果与剩余 CSS
	return { extracted, remaining };
	// 结束 extractAtRules
}

/** :root → realm；html/body → realm + [data-plugin-root] */
function mapDocRootToken(token: string, sel: string): string {
	if (/^:root$/i.test(token)) return sel;
	if (/^(?:html|body)$/i.test(token)) return `${sel}${PLUGIN_ROOT_ATTR}`;
	return token;
}

/**
 * Remote `:root` 写死的 Host 语义变量；remap 到 realm 后会挡住继承。
 * 不匹配 `--color-*`（@theme 别名）与 `--el-*` 等组件库变量。
 */
const HOST_THEME_CUSTOM_PROP =
	/^--(?:brand-accent(?:-soft|-light|-dark)?|theme-[a-z0-9-]+|background|foreground|card(?:-foreground)?|popover(?:-foreground)?|primary(?:-foreground)?|secondary(?:-foreground)?|muted(?:-foreground)?|accent(?:-foreground)?|destructive|border|input|ring|radius)$/i;

/** 选择器列表是否仅为 `:root` / `:host`（Tailwind @theme 常写成二者并列） */
function isDocRootOnlySelectors(selectors: string): boolean {
	const parts = selectors
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	return parts.length > 0 && parts.every((s) => /^(:root|:host)$/i.test(s));
}

/** 从 `{…}` 声明块去掉 Host 主题自定义属性 */
function stripHostThemeDecls(declBlock: string): string {
	if (declBlock.length < 2 || declBlock[0] !== '{') return declBlock;
	const inner = declBlock.slice(1, -1);
	const cleaned = inner.replace(
		/(^|;)\s*(--[\w-]+)\s*:\s*[^;]*/g,
		(full, lead: string, prop: string) =>
			HOST_THEME_CUSTOM_PROP.test(prop) ? lead : full,
	);
	const tidy = cleaned
		.replace(/;\s*;+/g, ';')
		.replace(/^\s*;\s*/, '')
		.replace(/;\s*$/, '')
		.trim();
	return `{${tidy}}`;
}

/**
 * 单个选择器加前缀（对齐 qiankun css.ts + body 弹层双选择器）：
 * - :root → realm（变量可打在浮层根）
 * - html/body → `[realm][data-plugin-root]`（避免 Toast 吃到 height:100%）
 * - 其余：`[realm] .x` + `[realm].x`
 */
function prefixOneSelector(selector: string, sel: string): string {
	// 去掉首尾空白，后续一律基于规范化后的选择器串处理
	const s = selector.trim();
	// 空串或已含 realm 选择器（避免重复加前缀）则原样返回
	if (!s || s.includes(sel)) return s;
	// 检测是否以 :root / html / body 开头（后跟空白、组合符、伪类/属性等或串尾）
	const lead = s.match(/^(?::root|html|body)(?=[\s.:#[\]>|+~*,]|$)/i);
	// 文档根令牌打头：只改写该令牌，后缀（如 .foo、> .bar）原样拼接
	if (lead) {
		// :root→realm；html/body→realm+[data-plugin-root]，再接剩余选择器
		return mapDocRootToken(lead[0], sel) + s.slice(lead[0].length);
	}
	// 非打头：组合符 / :is()/:where() 参数里的 :root/html/body 也要映射
	// （如「div > body .x」「:is(html, body) ol」——后者若不改会双前缀后永远匹配不到，或切分坏时泄漏）
	const rooted = s.replace(
		// 边界含 `(`, `,`，供 :is(html, body) 内替换
		/(^|[\s>+~,(])(?::root|html|body)(?=[\s.:#[\]>|+~*,)]|$)/gi,
		// full=边界+令牌，p=边界；令牌部分走 mapDocRootToken
		(full, p: string) => `${p}${mapDocRootToken(full.slice(p.length), sel)}`,
	);
	// 若发生过文档根映射，直接返回改写结果（不再套双选择器）
	if (rooted !== s) return rooted;
	// 普通选择器：对齐 qiankun——后代 `[realm] .x` + 同元素 `[realm].x`（覆盖弹层根自身）
	return `${sel} ${s},${sel}${s}`;
}

/**
 * 按顶层逗号拆选择器列表（括号 / 方括号 / 字符串内的逗号不拆）。
 * 避免 `:is(html, body) ol` 被切成残片后泄漏或错前缀。
 */
function splitSelectorList(list: string): string[] {
	const parts: string[] = [];
	let start = 0;
	let depth = 0;
	for (let i = 0; i < list.length; i++) {
		const ch = list[i];
		if (ch === '\\') {
			i++;
			continue;
		}
		if (ch === '"' || ch === "'") {
			const q = ch;
			i++;
			while (i < list.length) {
				if (list[i] === '\\') {
					i += 2;
					continue;
				}
				if (list[i] === q) break;
				i++;
			}
			continue;
		}
		if (ch === '(' || ch === '[') depth++;
		else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
		else if (ch === ',' && depth === 0) {
			parts.push(list.slice(start, i));
			start = i + 1;
		}
	}
	parts.push(list.slice(start));
	return parts;
}

/** 逗号分组选择器列表加前缀 */
function prefixSelectorList(list: string, sel: string): string {
	return splitSelectorList(list)
		.map((part) => prefixOneSelector(part, sel))
		.join(',');
}

/** 从 openIdx（指向 `{`）起找配对 `}`，返回闭合下标；失败返回 -1 */
function findMatchingBrace(css: string, openIdx: number): number {
	// 大括号嵌套深度：从 openIdx 的 `{` 起算，回到 0 即找到配对 `}`
	let depth = 0;
	// 自开括号位置线性扫描到串尾
	for (let i = openIdx; i < css.length; i++) {
		// 当前字符，用于分支识别注释 / 字符串 / 括号
		const ch = css[i];
		// 选择器里常见 `\"`（如 .after\:content-\[\"\"\]）：勿把转义引号当成字符串起点，
		// 否则 @layer utilities 配对失败会把后续 html/body/#root 整段泄漏到 Host
		if (ch === '\\') {
			i++;
			continue;
		}
		// 块注释 /* ... */：内部的 `{` `}` 不计深度，整段跳过
		if (ch === '/' && css[i + 1] === '*') {
			// 定位注释结束符；缺失则视为直到串尾
			const end = css.indexOf('*/', i + 2);
			// 将 i 落到 `*/` 末字符（或串尾），for 循环还会再 +1
			i = end < 0 ? css.length : end + 1;
			// 跳过本轮后续括号逻辑
			continue;
		}
		// 引号字符串：内部的 `{` `}` 不计深度，需正确处理转义
		if (ch === '"' || ch === "'") {
			// 记录开引号类型，用于匹配同型闭引号
			const q = ch;
			// 从开引号后一字符开始扫字符串体
			i++;
			// 扫到串尾或配对闭引号为止
			while (i < css.length) {
				// 反斜杠转义：跳过转义符与下一字符，避免把 `\"` 当结束
				if (css[i] === '\\') {
					i += 2;
					continue;
				}
				// 遇到同型闭引号则结束字符串扫描
				if (css[i] === q) break;
				// 普通字符继续前进
				i++;
			}
			// 字符串已消费完，本轮不再计括号
			continue;
		}
		// 遇 `{` 加深一层嵌套
		if (ch === '{') depth++;
		// 遇 `}` 进入减深分支
		else if (ch === '}') {
			// 减一层深度
			depth--;
			// 回到 0 说明 openIdx 处那层 `{` 已配对闭合
			if (depth === 0) return i;
		}
	}
	// 扫描结束仍未配对：CSS 残缺或括号不平衡
	return -1;
}

/**
 * 类 qiankun 选择器前缀：遍历规则，@media 等递归；@keyframes 原样（名已在外层加前缀）。
 * 手写轻量 CSS 扫描器：按注释 / 空白 / at-rule / 普通规则分段处理，
 * 把普通选择器改写成带 data-mf-style-realm 前缀的形式，实现 Remote 样式隔离。
 */
function prefixCssRules(css: string, sel: string): string {
	// 累积改写后的 CSS 文本
	let out = '';
	// 当前扫描下标
	let i = 0;
	// 源串长度，循环上界
	const n = css.length;
	// 线性扫描整段 CSS，直到耗尽
	while (i < n) {
		// 块注释 /* ... */：原样拷贝，避免把注释内容当选择器改写
		if (css.startsWith('/*', i)) {
			// 找注释结束符；缺失则视为直到串尾
			const end = css.indexOf('*/', i + 2);
			// 切片终点：含 */ 两字符，或直接到 n
			const j = end < 0 ? n : end + 2;
			// 注释整段追加到输出
			out += css.slice(i, j);
			// 跳过已消费的注释区间
			i = j;
			continue;
		}
		// 当前字符，用于分支判断
		const ch = css[i];
		// 空白（空格/换行/制表等）原样保留，维持可读格式
		if (/\s/.test(ch)) {
			out += ch;
			i++;
			continue;
		}

		// at-rule：以 @ 开头（@media / @keyframes / @import 等）
		if (ch === '@') {
			// 记录 at-rule 起始，便于整段切片
			const preludeStart = i;
			// 从 @ 后扫描 prelude，直到块起始 `{` 或语句结束 `;`
			let j = i + 1;
			while (j < n && css[j] !== '{' && css[j] !== ';') j++;
			// 提取 at-rule 名（小写），用于决定是否递归改写内部
			const name =
				css
					.slice(i, j)
					.match(/^@[\w-]+/i)?.[0]
					?.toLowerCase() ?? '';
			// 形如 `@import "...";` / `@charset "...";`：无块体，整句原样输出
			if (css[j] === ';') {
				out += css.slice(preludeStart, j + 1);
				i = j + 1;
				continue;
			}
			// 既无 `{` 也无 `;`：畸形片段，逐字吐出避免死循环
			if (css[j] !== '{') {
				out += css[i++];
				continue;
			}
			// 配对找到 at-rule 块的闭合 `}`
			const close = findMatchingBrace(css, j);
			// 括号不匹配：剩余原文直接拼上并结束，防止越界
			if (close < 0) {
				out += css.slice(i);
				break;
			}
			// 块内 CSS（不含两侧大括号），供可嵌套 at-rule 递归
			const inner = css.slice(j + 1, close);
			// `@xxx ...` 到 `{` 之前的 prelude（含条件表达式）
			const prelude = css.slice(preludeStart, j);
			// keyframes / font-face / property / page：内部是关键帧或描述符，不是选择器，整块原样
			if (
				name.startsWith('@keyframes') ||
				name === '@-webkit-keyframes' ||
				name === '@font-face' ||
				name === '@property' ||
				name === '@page'
			) {
				out += css.slice(preludeStart, close + 1);
			} else if (
				// 条件/分组类 at-rule：内部仍是普通规则，需递归加 realm 前缀
				name === '@media' ||
				name === '@supports' ||
				name === '@layer' ||
				name === '@container' ||
				name === '@document'
			) {
				// 保留 prelude 与外层大括号，只改写内部规则
				out += `${prelude}{${prefixCssRules(inner, sel)}}`;
			} else {
				// 未知 at-rule：保守原样，避免误伤第三方扩展语法
				out += css.slice(preludeStart, close + 1);
			}
			// 消费完整 at-rule（含闭合 `}`）
			i = close + 1;
			continue;
		}

		// 普通规则：selector { declarations }
		// 从当前位置找规则块的 `{`
		const open = css.indexOf('{', i);
		// 找不到开括号：剩余文本无法构成规则，原样输出后结束
		if (open < 0) {
			out += css.slice(i);
			break;
		}
		// 配对闭合 `}`，正确跳过字符串与注释内的括号
		const close = findMatchingBrace(css, open);
		// 闭合失败：剩余原文拼上并结束
		if (close < 0) {
			out += css.slice(i);
			break;
		}
		// `{` 前的选择器列表（可能含逗号分组）
		const selectors = css.slice(i, open);
		// 从 `{` 到 `}` 的声明块本体
		let body = css.slice(open, close + 1);
		// :root/:host 上的 Host 主题绝对值剥掉，嵌入后继承主站；--color-* / --el-* 保留
		if (isDocRootOnlySelectors(selectors)) {
			body = stripHostThemeDecls(body);
		}
		// 对选择器列表逐段加 realm 前缀
		out += `${prefixSelectorList(selectors, sel)}${body}`;
		// 跳到本规则之后，继续扫描下一条
		i = close + 1;
	}
	// 返回完成选择器前缀隔离后的 CSS
	return out;
}

/**
 * hoist 全局 at-rule + keyframes 前缀 + 选择器前缀隔离。
 * @import 顶置；旧 @scope 会先 unwrap 再按前缀重写。
 */
function transpileStyleText(
	cssText: string,
	sel: string,
	_realm: string,
): string {
	// 去掉首尾空白，便于空串判断与后续匹配
	const trimmed = cssText.trim();
	// 空样式直接原样返回，避免无意义改写
	if (!trimmed) return cssText;

	// 已是当前 realm 的 v2 前缀协议 → 幂等跳过，防止重复 wrap
	if (alreadyScoped(trimmed, sel)) return trimmed;

	// 旧 @scope 外壳先剥掉，再清掉历史 mf-iso 标记，得到可重写的裸 CSS
	const bare = unwrapScope(trimmed).replace(MF_ISO_MARK_RE, '').trim();
	// 抽出顶层 @import（须保持文档最前，不能进前缀作用域）
	const { extracted: imports, remaining: afterImport } = extractAtRules(
		bare,
		IMPORT_RE,
	);
	// 抽出 @font-face（全局字体描述，hoist 到前缀规则之外）
	const { extracted: fontFaces, remaining: afterFont } = extractAtRules(
		afterImport,
		FONT_FACE_RE,
	);
	// 抽出 @namespace（同样须全局生效，不能被 realm 选择器包裹）
	const { extracted: namespaces, remaining: afterNs } = extractAtRules(
		afterFont,
		NAMESPACE_RE,
	);

	// 选择器前缀隔离；@keyframes 名不改（antd effect style 与 animation-name 分标签注入）
	const prefixed = prefixCssRules(afterNs, sel).trim();
	// hoist 段顺序：@import → @namespace → @font-face（符合 CSS 顶置约定）
	const hoisted = [...imports, ...namespaces, ...fontFaces].join('\n');
	// 正文打上 MF_ISO_MARK，供 alreadyScoped / HMR 识别已转译
	const body = prefixed ? `${MF_ISO_MARK}\n${prefixed}` : MF_ISO_MARK;
	// 有 hoist 则拼在正文前；否则只返回带标记的隔离正文
	return hoisted ? `${hoisted}\n${body}` : body;
}

/**
 * 单条 CSSOM insertRule 文本转译。
 * 注意：antd cssinjs 会把 `@keyframes X` 与 `animation-name:X` 分成两次 insertRule；
 * 若只给 keyframes 加 realm 前缀、不同步改名引用，离开动画永不触发，Message 会挂住不消失。
 * 故 CSSOM 路径保留原 keyframes 名（cssinjs 已带 hash），只做选择器前缀。
 */
function transpileStyleRule(
	// 单条 CSSOM insertRule 的原始文本
	ruleText: string,
	// 当前 Remote 的选择器前缀（如 [data-mf-style-realm="…"]）
	sel: string,
	// realm 仅整段 transpileStyleText 改 keyframes 名时需要；CSSOM 分条路径刻意不用
	_realm: string,
): string {
	// 去掉首尾空白，便于空串与 at-rule 前缀匹配
	const trimmed = ruleText.trim();
	// 空规则原样返回，避免无意义改写
	if (!trimmed) return ruleText;
	// 已带隔离标记或已含本 realm 选择器 → 视为已转译，幂等跳过
	if (trimmed.includes(MF_ISO_MARK) || trimmed.includes(sel)) {
		// 防止 HMR / 重复 insertRule 时二次前缀
		return trimmed;
	}
	// @font-face / @namespace 必须全局生效，不能包进 realm 选择器
	if (/^@font-face\b/i.test(trimmed) || /^@namespace\b/i.test(trimmed)) {
		// 原样放行，与 transpileStyleText 的 hoist 语义一致
		return trimmed;
	}
	// @import 须保持文档顶置语义，单条路径也不改写
	if (/^@import\b/i.test(trimmed)) return trimmed;
	// @keyframes 保留原名：antd cssinjs 把 keyframes 与 animation-name 分两次 insertRule，
	// 若此处改名而引用侧未同步，离开动画失效（如 Message 挂住不消失）
	if (
		/^@keyframes\b/i.test(trimmed) ||
		/^@-webkit-keyframes\b/i.test(trimmed)
	) {
		// cssinjs 自身已带 hash，跨 Remote 撞名风险可接受
		return trimmed;
	}
	// 普通规则：只做选择器前缀；勿对单条跑 prefixKeyframes（会与分条的 animation-name 脱节）
	return prefixCssRules(trimmed, sel);
}

// wrapWithScope：历史名，现为选择器前缀隔离入口
function wrapWithScope(cssText: string, sel: string, realm: string): string {
	return transpileStyleText(cssText, sel, realm);
}

// 从 entry URL 取 origin，供 link 同域认领与 data-mf-style-origin
function entryOriginOf(entry: string): string {
	// 尝试解析绝对 URL
	try {
		// 返回 origin（协议+主机+端口）
		return new URL(entry).origin;
		// 相对路径或非法 URL
	} catch {
		// 解析失败返回空串，调用方按无 origin 处理
		return '';
		// 结束 entryOriginOf 的 catch
	}
	// 结束 entryOriginOf
}

/** Host 源码根（…/apps/frontend），由本模块 URL 推导，避免白名单 remote 目录名 */
// 见上行 JSDoc：缓存 Host 源码根（…/apps/frontend），由本模块 URL 推导
let hostViteRootCache: string | null = null;
// 解析并缓存 Host Vite 根路径
function hostViteRoot(): string {
	// 已缓存则直接返回
	if (hostViteRootCache != null) return hostViteRootCache;
	// 从 import.meta.url 推路径，失败则用默认相对根
	try {
		// 解码并统一为正斜杠的 pathname
		const path = decodeURIComponent(
			// 取本模块 URL 的 pathname，Windows 反斜杠也换成 /
			new URL(import.meta.url).pathname.replace(/\\/g, '/'),
			// 结束 decodeURIComponent 实参
		);
		// monorepo 内 Host 应用目录标记
		const marker = '/apps/frontend';
		// 从后往前找标记，兼容嵌套路径
		const idx = path.lastIndexOf(marker);
		// 找到则切片出 Host 根并缓存
		if (idx >= 0) {
			// 缓存「到 /apps/frontend 为止」的绝对路径
			hostViteRootCache = path.slice(0, idx + marker.length);
			// 返回刚写入的缓存
			return hostViteRootCache;
			// 结束 idx>=0 分支
		}
		// pathname 不可用时忽略，走默认根
	} catch {
		/* ignore */
		// 结束 try/catch
	}
	// 回退为逻辑根路径字符串，供 includes 匹配
	hostViteRootCache = '/apps/frontend';
	// 返回默认或已缓存的 Host 根
	return hostViteRootCache;
	// 结束 hostViteRoot
}

/**
 * 是否为 Host 自身 Vite 注入的 style（dev）。
 * 只排除 Host；其余 app（micro / remote-demo / 未来新目录）在 capture 窗口内一律可认领。
 */
// 见上行 JSDoc：根据 data-vite-dev-id 判断是否 Host 自身 Vite style
function isHostViteDevStyle(viteId: string): boolean {
	// 统一正斜杠再匹配路径
	const id = viteId.replace(/\\/g, '/');
	// 取 Host 根路径字符串
	const root = hostViteRoot();
	// id 包含 Host 根则视为 Host 样式
	if (root && id.includes(root)) return true;
	// 正则再兜底匹配 /apps/frontend 段
	if (/\/apps\/frontend(?:\/|$)/i.test(id)) return true;
	// Host Vite 相对 id（无 monorepo apps/ 段）；Remote 一般是 @fs 绝对路径含 apps/<name>
	// 无 /apps/ 且像 /src/ 或 /@id/ → Host Vite 相对 id
	if (!/\/apps\//i.test(id) && (/^\/src\//.test(id) || /^\/@id\//.test(id))) {
		// 判定为 Host，捕获窗口内不认领
		return true;
		// 结束 Host 相对 id 分支
	}
	// 其余 id（含其它 app）不当作 Host
	return false;
	// 结束 isHostViteDevStyle
}

// 检测 Host 关键全局 CSS（如 sonner），禁止被隔离改写
function isHostCriticalCss(text: string): boolean {
	// sonner 用 __insertCSS 注入全局样式；误隔离后 Toaster 失 fixed，会顶开布局
	return text.includes('[data-sonner-toaster]');
}

/** 纠正已被误隔离的 Host 关键全局样式（如 sonner） */
function repairHostCriticalStyles() {
	for (const node of document.head.querySelectorAll('style')) {
		if (!(node instanceof HTMLStyleElement)) continue;
		const text = node.textContent ?? '';
		if (!isHostCriticalCss(text)) continue;
		node.dataset.mfHostStyle = '1';
		// 旧 @scope：剥开；前缀隔离难以无损还原，仅清标记（认领阶段本就不会收 sonner）
		if (text.includes('@scope')) {
			node.textContent = unwrapScope(text);
		}
		delete node.dataset.mfScoped;
		delete node.dataset.mfStyleOwner;
		delete node.dataset.mfStyleOrigin;
	}
}

// 判断 style/link 是否应归当前捕获 ctx 的 Remote（live 或 reclaim）
function looksLikeRemoteStyle(
	// 待判定的 style 或 stylesheet link
	el: HTMLStyleElement | HTMLLinkElement,
	// 当前插件捕获上下文
	ctx: CaptureCtx,
	// live=捕获窗口认领；reclaim=挂载时收回，更保守
	mode: 'live' | 'reclaim' = 'live',
	// 返回是否视为该 Remote 的样式；函数体开始
): boolean {
	// 已标 Host 关键样式则永不认领
	if (el.dataset.mfHostStyle === '1') return false;

	// 读此前写入的 entry origin
	const origin = el.dataset.mfStyleOrigin;
	// 有 origin 标记时只认与 ctx.entryOrigin 相同的
	if (origin) return origin === ctx.entryOrigin;

	// 读 mfStyleOwner（可能是 realm 或旧版 pluginId）
	const owner = el.dataset.mfStyleOwner;
	// owner 已是本 realm 或本 pluginId 则认领
	if (owner === ctx.realm || owner === ctx.pluginId) return true;
	// owner 已是其它规范键则说明归属别的 Remote
	if (
		// entry: 前缀的其它 realm
		owner?.startsWith('entry:') ||
		// remote: 前缀的其它名
		owner?.startsWith('remote:') ||
		// plugin: 前缀的其它插件
		owner?.startsWith('plugin:')
		// 结束「已是规范 owner 键」条件
	) {
		// 归属其它 Remote，明确不认领
		return false;
		// 结束其它 owner 键分支
	}

	// link 元素：用 href 的 origin 与 entry 比对
	if (el instanceof HTMLLinkElement) {
		// 非 stylesheet 或无 href 则不是可认领样式表
		if (el.rel !== 'stylesheet' || !el.href) return false;
		// 解析 href 的 origin
		try {
			// 同域即视为该 Remote 的 link
			return new URL(el.href).origin === ctx.entryOrigin;
			// href 非法 URL
		} catch {
			// 解析失败则不认领
			return false;
			// 结束 link 分支 try/catch
		}
		// 结束 HTMLLinkElement 分支
	}

	// style 元素：读文本做 Host 关键与 vite id 判定
	const text = el.textContent ?? '';
	// 若是 sonner 等关键 CSS，打标并拒绝
	if (isHostCriticalCss(text)) {
		// 标记为 Host，防止以后再被 reclaim
		el.dataset.mfHostStyle = '1';
		// 拒绝认领 Host 关键样式
		return false;
		// 结束 Host 关键分支
	}

	// 读 Vite 开发态 style id
	const viteId = el.getAttribute('data-vite-dev-id') || '';
	// 有 vite id 时走 Host/Remote 路径启发式
	if (viteId) {
		// Host 自己的 vite style 不认领
		if (isHostViteDevStyle(viteId)) return false;
		// 尝试用 entry host 是否出现在 viteId 中
		try {
			// 从 entryOrigin 取 host
			const host = new URL(ctx.entryOrigin).host;
			// viteId 含 Remote host 则认领
			if (host && viteId.includes(host)) return true;
			// entryOrigin 非法时忽略 host 匹配
		} catch {
			/* ignore */
			// 结束 host 匹配 try
		}
		// 无 host 线索时：仅当仍在本 realm 捕获窗口内才认领
		return activeCtx()?.realm === ctx.realm;
		// 结束 viteId 分支
	}

	// 生产无 vite id：旧版 owner=pluginId 且仍包着该 plugin 的 @scope → 可升到 realm
	// 有 owner 但非规范键：检查是否旧版 plugin 选择器 scope
	if (owner) {
		// 仍在本 realm 捕获中，且文本含旧 data-mf-plugin owner 选择器
		if (
			// active 仍是本 realm
			activeCtx()?.realm === ctx.realm &&
			// 双引号形式的旧插件属性选择器
			(text.includes(`[data-mf-plugin="${owner}"]`) ||
				// 单引号形式
				text.includes(`[data-mf-plugin='${owner}']`))
			// 结束旧 plugin scope 条件
		) {
			// 可升到当前 realm，允许认领
			return true;
			// 结束可升级分支
		}
		// 有 owner 但无法关联本 realm 则拒绝
		return false;
		// 结束 owner 分支
	}

	// 无标记的 style：reclaim 绝不碰（避免收走 Host sonner 等）；仅 live 捕获窗口认领新注入
	// reclaim 模式绝不碰无标记 style，避免收走 Host 全局样式
	if (mode === 'reclaim') return false;
	// live 捕获窗口内：仅栈顶仍是本 realm 时认领新注入
	return activeCtx()?.realm === ctx.realm;
	// 结束 looksLikeRemoteStyle
}

// 空 style 等待 textContent 出现的 MutationObserver，弱键防泄漏
const pendingStyleObservers = new WeakMap<HTMLStyleElement, MutationObserver>();
// 已 scoped 的 style 监听 HMR 改文，弱键防泄漏
const hmrStyleObservers = new WeakMap<HTMLStyleElement, MutationObserver>();

/**
 * 仅对 Vite HMR style（data-vite-dev-id）监听换文重隔离。
 * antd cssinjs 等运行时靠 insertRule patch；对其 textContent 再 wrap 会互殴卡死整页。
 */
function watchScopedStyleHmr(
	// 已打过 mf 隔离标记的 style 元素
	el: HTMLStyleElement,
	// 当前归属的 style realm（与 data-mf-style-owner 对齐）
	realm: string,
	// Remote 入口 origin，重 scope 时原样传回
	entryOrigin: string | undefined,
	// 本 realm 的 [data-mf-style-realm="…"] 选择器，供 styleNeedsRescope 判断
	sel: string,
	// 函数体开始
) {
	// 同一元素已挂 HMR observer 则跳过，防止重复监听
	if (hmrStyleObservers.has(el)) return;
	// 非 Vite 开发态 style（无 data-vite-dev-id）不监听：antd cssinjs 等靠 insertRule，再 wrap text 会互殴卡死
	if (!el.getAttribute('data-vite-dev-id')) return;

	// 子树文本/节点变化时检查是否需要重新隔离
	const mo = new MutationObserver(() => {
		// owner 已不是本 realm：可能被别的插件认领，本观察者不再处理
		if (el.dataset.mfStyleOwner !== realm) return;
		// 读取当前 CSS 文本（null 当空串）
		const text = el.textContent ?? '';
		// 已带本 realm 前缀且无需剥旧 @scope → 不必重写，避免无意义写回
		if (!styleNeedsRescope(text, sel)) return;
		// 先断开，避免 set textContent 同步再进本回调形成死循环
		mo.disconnect();
		// 从弱表摘掉，允许后续再次 watch（scopeStyleElement 末尾会重挂）
		hmrStyleObservers.delete(el);
		// 清掉 scoped 标，让 scopeStyleElement 重新走完整 wrap 路径
		delete el.dataset.mfScoped;
		// 按原 realm/origin 重新隔离（内部会再调用本函数挂新 observer）
		scopeStyleElement(el, realm, entryOrigin);
		// 结束 MutationObserver 回调
	});
	// 登记弱引用，便于去重与元素回收时自动释放
	hmrStyleObservers.set(el, mo);
	// 监听子节点与字符数据（含文本节点替换），覆盖 Vite HMR 改 style 内容的常见路径
	mo.observe(el, { childList: true, characterData: true, subtree: true });
	// 结束 watchScopedStyleHmr
}

// 把单个 style 元素的 CSS 包进 @scope，并打 owner/origin 标记
function scopeStyleElement(
	// 待隔离的 style
	el: HTMLStyleElement,
	// 目标 realm
	realm: string,
	// 可选 Remote origin
	entryOrigin?: string,
	// 函数体开始
) {
	// 先读文本做 Host 关键检测
	const text0 = el.textContent ?? '';
	// sonner 等关键样式：只打 Host 标，不包 scope
	if (isHostCriticalCss(text0)) {
		// 标记 Host，后续认领跳过
		el.dataset.mfHostStyle = '1';
		// 直接返回，保持全局
		return;
		// 结束 Host 关键早退
	}
	// 生成本 realm 的 scope 选择器
	const sel = scopeSelector(realm);
	// 再读文本（与后续逻辑使用同一快照来源）
	const text = el.textContent ?? '';
	// 空 style：先打标并等内容出现再 scope
	if (!text.trim()) {
		// 立刻打 owner：CSS-in-JS 可能先 insertRule 再填 text
		// 先写入 owner=realm，CSSOM patch 才能知道归属
		el.dataset.mfStyleOwner = realm;
		// 标 scoped，避免被当成未处理节点反复进逻辑
		el.dataset.mfScoped = '1';
		// 有 origin 则一并写入
		if (entryOrigin) el.dataset.mfStyleOrigin = entryOrigin;
		// 已有 pending MO 则不再挂第二个
		if (pendingStyleObservers.has(el)) return;
		// 内容出现后断开 MO 并递归正式 scope
		const mo = new MutationObserver(() => {
			// textContent 已有非空白则开始真正隔离
			if ((el.textContent ?? '').trim()) {
				// 停止监听，避免重复回调
				mo.disconnect();
				// 从 pending 表移除
				pendingStyleObservers.delete(el);
				// 递归调用：此时文本非空，会走 wrap 路径
				scopeStyleElement(el, realm, entryOrigin);
				// 结束 trim 有内容分支
			}
			// 结束 pending MO 回调
		});
		// 登记 pending MO
		pendingStyleObservers.set(el, mo);
		// 观察空 style 的子树与字符，等待注入
		mo.observe(el, {
			// 子节点变化
			childList: true,
			// 字符数据变化
			characterData: true,
			// 含子元素文本
			subtree: true,
			// 结束 observe 选项
		});
		// 空内容路径到此结束，等 MO 回调
		return;
		// 结束空 text 分支
	}
	// 已隔离到本 realm：旧 @scope 迁移；协议升版（缺当前 mf-iso 标记）时重写一次
	if (
		el.dataset.mfScoped === '1' &&
		el.dataset.mfStyleOwner === realm &&
		!styleNeedsRescope(text, sel)
	) {
		if (!alreadyScoped(text, sel)) {
			// 已有前缀但标记过旧 → 升到当前协议（html/body→plugin-root 等）
			el.textContent = wrapWithScope(text, sel, realm);
		}
		if (entryOrigin) el.dataset.mfStyleOrigin = entryOrigin;
		watchScopedStyleHmr(el, realm, entryOrigin, sel);
		return;
	}
	// 正式把 CSS 前缀隔离写回 textContent
	el.textContent = wrapWithScope(text, sel, realm);
	// 标记已完成隔离
	el.dataset.mfScoped = '1';
	// owner 设为 realm，供 CSSOM / reclaim 识别
	el.dataset.mfStyleOwner = realm;
	// 写入 entry origin
	if (entryOrigin) el.dataset.mfStyleOrigin = entryOrigin;
	// 挂上 HMR 重隔离监听
	watchScopedStyleHmr(el, realm, entryOrigin, sel);
	// 结束 scopeStyleElement
}

// fetch 外链 CSS，换成带 @scope 的 style，并禁用原 link
async function scopeLinkElement(
	// stylesheet link
	el: HTMLLinkElement,
	// 目标 realm
	realm: string,
	// Remote origin，写入 dataset
	entryOrigin: string,
	// async 函数体开始
) {
	// 读绝对 href
	const href = el.href;
	// 无 href 无法拉取，直接返回
	if (!href) return;
	// 本 realm 的 scope 选择器
	const sel = scopeSelector(realm);
	// 查找是否已有从同 href 注入的 style（避免重复 fetch）
	const existing = Array.from(
		// head 里带 data-mf-from-link 的 style
		document.head.querySelectorAll('style[data-mf-from-link]'),
		// dataset.mfFromLink 等于当前 href 则复用
	).find((s) => (s as HTMLElement).dataset.mfFromLink === href) as
		// 断言为 HTMLStyleElement 或 undefined（联合类型上行）
			| HTMLStyleElement
			// 联合类型下行：undefined
			| undefined;
	// 已有注入 style：对其重新 scope，并禁用本 link
	if (existing) {
		// 确保复用节点归属当前 realm
		scopeStyleElement(existing, realm, entryOrigin);
		// 标记 link 已处理
		el.dataset.mfScoped = '1';
		// owner 与 style 对齐
		el.dataset.mfStyleOwner = realm;
		// origin 对齐
		el.dataset.mfStyleOrigin = entryOrigin;
		// 禁用 link，避免双份样式（裸 CSS + scoped）
		el.disabled = true;
		// 复用路径结束
		return;
		// 结束 existing 分支
	}
	// link 已按本 realm scoped 过则跳过
	if (el.dataset.mfScoped === '1' && el.dataset.mfStyleOwner === realm) return;
	// CORS 拉取 CSS 文本
	try {
		// omit 凭证、cors 模式，避免无关 cookie；跨域失败进 catch
		const res = await fetch(href, { credentials: 'omit', mode: 'cors' });
		// 非 2xx 则放弃隔离，保留原 link
		if (!res.ok) return;
		// 读响应体为 CSS 字符串
		const css = await res.text();
		// 新建 style 承载隔离后的 CSS
		const style = document.createElement('style');
		// 先禁用 link，避免 fetch 窗口内未隔离样式闪烁污染 Host
		// 立刻禁用原 link，缩短未隔离窗口
		el.disabled = true;
		// 写入 wrap 后的 CSS
		style.textContent = wrapWithScope(css, sel, realm);
		// 标记新 style 已隔离
		style.dataset.mfScoped = '1';
		// owner=realm
		style.dataset.mfStyleOwner = realm;
		// origin=entryOrigin
		style.dataset.mfStyleOrigin = entryOrigin;
		// 记录来源 href，供下次复用查找
		style.dataset.mfFromLink = href;
		// 插到 link 后面，保持级联大致顺序
		el.insertAdjacentElement('afterend', style);
		// 原 link 打上已处理标记
		el.dataset.mfScoped = '1';
		// owner 同步
		el.dataset.mfStyleOwner = realm;
		// origin 同步
		el.dataset.mfStyleOrigin = entryOrigin;
		// fetch/CORS 失败（降级见块内注释）
	} catch {
		/* CORS / 离线：保持原 link，不阻断功能（隔离降级） */
		// 结束 scopeLinkElement try/catch
	}
	// 结束 scopeLinkElement
}

// 对单次插入 head 的节点：若是 Remote style/link 则隔离
function processNode(node: Node, ctx: CaptureCtx) {
	// 非 HTMLElement 忽略（文本节点等）
	if (!(node instanceof HTMLElement)) return;
	// style 标签路径
	if (node instanceof HTMLStyleElement) {
		// 不像本 Remote 的样式则跳过
		if (!looksLikeRemoteStyle(node, ctx)) return;
		// 包 @scope 并打标
		scopeStyleElement(node, ctx.realm, ctx.entryOrigin);
		// style 处理完毕，避免再落入 link 分支
		return;
		// 结束 HTMLStyleElement 分支
	}
	// stylesheet link 路径
	if (node instanceof HTMLLinkElement && node.rel === 'stylesheet') {
		// 不像本 Remote 则跳过
		if (!looksLikeRemoteStyle(node, ctx)) return;
		// 异步 fetch+替换；void 表示不阻塞插入路径
		void scopeLinkElement(node, ctx.realm, ctx.entryOrigin);
		// 结束 HTMLLinkElement 分支
	}
	// 结束 processNode
}

/** 挂载时把 head 里已注入、同 entry 的样式收回当前 realm（修复切换插件后无样式） */
// 见上行 JSDoc：挂载时收回 head 里同 entry 的样式到当前 realm
function reclaimEntryStyles(ctx: CaptureCtx) {
	// 先修 Host 关键样式，避免误 reclaim
	repairHostCriticalStyles();
	// 收集 head 内所有 style 与 stylesheet link
	const nodes = document.head.querySelectorAll('style, link[rel="stylesheet"]');
	// 逐个尝试收回
	for (const node of nodes) {
		// 只处理 style 或 stylesheet link
		if (
			// 类型守卫：必须是 style 或 link
			!(node instanceof HTMLStyleElement || node instanceof HTMLLinkElement)
			// 结束类型守卫条件
		) {
			// continue 下一 node
			continue;
			// 结束非 style/link 分支
		}
		// reclaim 模式：无标记的不碰，只收有归属线索的
		if (!looksLikeRemoteStyle(node, ctx, 'reclaim')) continue;
		// style → 同步 scopeStyleElement
		if (node instanceof HTMLStyleElement) {
			// 隔离 style 文本并打 realm 标
			scopeStyleElement(node, ctx.realm, ctx.entryOrigin);
			// link → 异步 scopeLinkElement
		} else {
			// fire-and-forget 拉取并替换为 scoped style
			void scopeLinkElement(node, ctx.realm, ctx.entryOrigin);
			// 结束 style vs link 分支
		}
		// 结束 for nodes
	}
	// 结束 reclaimEntryStyles
}

/* -------------------- CSSOM insertRule（CSS-in-JS） -------------------- */

// CSSOM insertRule patch 引用计数
let cssomPatchDepth = 0;
// 保存 CSSStyleSheet.prototype.insertRule 原函数
let origInsertRule: typeof CSSStyleSheet.prototype.insertRule | null = null;

// 从 stylesheet 的 ownerNode 读 mfStyleOwner 作为 realm
function sheetOwnerRealm(sheet: CSSStyleSheet): string | null {
	// CSSOM sheet 对应的 DOM 节点
	const owner = sheet.ownerNode;
	// 非 style 标签拥有的 sheet 不走此 patch 语义
	if (!(owner instanceof HTMLStyleElement)) return null;
	// Host 关键 style 上的规则不改写
	if (owner.dataset.mfHostStyle === '1') return null;
	// 返回 dataset 上的 owner realm，无则 null
	return owner.dataset.mfStyleOwner || null;
	// 结束 sheetOwnerRealm
}

// 确保 CSSStyleSheet.insertRule 被包一层 @scope 转译
function ensureCssomPatch() {
	// 已 patch：只增加深度，避免重复替换 prototype
	if (cssomPatchDepth > 0) {
		// 嵌套引用 +1
		cssomPatchDepth += 1;
		// 已装过则返回
		return;
		// 结束已 patch 分支
	}
	// 保存原生 insertRule
	origInsertRule = CSSStyleSheet.prototype.insertRule;
	// 替换为会按 owner realm 转译的实现
	CSSStyleSheet.prototype.insertRule = function mfInsertRule(
		// 待插入的 CSS 规则文本
		rule: string,
		// 可选插入下标
		index?: number,
		// 返回新规则索引；包装函数体开始
	): number {
		// 看本 sheet 是否属于某插件 realm
		const realm = sheetOwnerRealm(this);
		// 有 owner 则转译后再插入
		if (realm) {
			// 生成本 realm 的 scope 选择器
			const sel = scopeSelector(realm);
			// 单条规则 transpile 后写回局部 rule
			rule = transpileStyleRule(rule, sel, realm);
			// 结束有 realm 分支
		}
		// 调用原生 insertRule，保持 CSSOM 索引语义
		return origInsertRule!.call(this, rule, index);
		// 结束 mfInsertRule
	};
	// 深度置 1，标记 patch 已装
	cssomPatchDepth = 1;
	// 结束 ensureCssomPatch
}

// 减少 CSSOM patch 引用；到 0 时恢复原生 insertRule
function releaseCssomPatch() {
	// 未装过则无操作
	if (cssomPatchDepth <= 0) return;
	// 引用计数 -1
	cssomPatchDepth -= 1;
	// 仍有其它捕获窗口持有 patch 则不卸载
	if (cssomPatchDepth > 0) return;
	// 仅当当前仍是我们的包装函数时才还原，避免误伤他人 patch
	if (origInsertRule && CSSStyleSheet.prototype.insertRule !== origInsertRule) {
		// 恢复原型上的原生 insertRule
		CSSStyleSheet.prototype.insertRule = origInsertRule;
		// 结束仍是我们包装的分支
	}
	// 清空保存的原函数引用
	origInsertRule = null;
	// 结束 releaseCssomPatch
}

// 劫持 head.appendChild/insertBefore，插入后对节点做样式隔离
function ensureHeadPatch() {
	// 已 patch：嵌套 begin 只加深度
	if (patchDepth > 0) {
		// 引用计数 +1
		patchDepth += 1;
		// 已装过则返回
		return;
		// 结束已 patch 分支
	}
	// 取 document.head
	const head = document.head;
	// 绑定保存原生 appendChild
	origAppend = head.appendChild.bind(head) as typeof origAppend;
	// 绑定保存原生 insertBefore
	origInsert = head.insertBefore.bind(head) as typeof origInsert;

	// 包装 appendChild：先原生挂载，再按 activeCtx 处理
	head.appendChild = function appendScoped<T extends Node>(node: T): T {
		// 先真正插入 DOM，保证后续读 sheet/文本可用
		const ret = origAppend(node);
		// 取当前捕获栈顶
		const ctx = activeCtx();
		// 在捕获窗口内则尝试隔离该节点
		if (ctx) processNode(node, ctx);
		// 返回插入的节点，保持与原生相同契约
		return ret;
		// 结束 appendScoped
	};

	// 包装 insertBefore：同样先插入再 processNode
	head.insertBefore = function insertScoped<T extends Node>(
		// 待插入节点
		node: T,
		// 参考节点，null 表示插到末尾
		ref: Node | null,
		// 返回插入节点；函数体开始
	): T {
		// 原生 insertBefore
		const ret = origInsert(node, ref);
		// 当前捕获上下文
		const ctx = activeCtx();
		// 有 ctx 则隔离
		if (ctx) processNode(node, ctx);
		// 返回 ret
		return ret;
		// 结束 insertScoped
	};

	// 深度置 1
	patchDepth = 1;
	// 同时装上 CSSOM insertRule patch
	ensureCssomPatch();
	// 结束 ensureHeadPatch
}

// 减少 head patch 引用；到 0 时恢复 append/insert 并释放 CSSOM
function releaseHeadPatch() {
	// 未装过则无操作
	if (patchDepth <= 0) return;
	// 引用计数 -1
	patchDepth -= 1;
	// 仍有嵌套持有者则保持 patch
	if (patchDepth > 0) return;
	// 恢复 head.appendChild
	document.head.appendChild = origAppend as typeof document.head.appendChild;
	// 恢复 head.insertBefore
	document.head.insertBefore = origInsert as typeof document.head.insertBefore;
	// 成对释放 CSSOM patch
	releaseCssomPatch();
	// 结束 releaseHeadPatch
}

/**
 * 在 loadRemote 前后包一层：捕获本次注入的 CSS 并 @scope 到 realm。
 */
// 见上行 JSDoc：loadRemote 前后包一层，捕获注入 CSS 并 @scope 到 realm
export function beginPluginStyleCapture(
	// 插件 id
	pluginId: string,
	// Remote entry URL
	entry: string,
	// 可选 MF remote 名
	remoteName?: string,
	// 返回 dispose：断开监听、出栈、释放 patch；函数体开始
): () => void {
	// 由 entry 推导共享 realm 键
	const realm = styleRealmKey(entry, remoteName, pluginId);
	// 构造本次捕获上下文
	const ctx: CaptureCtx = {
		// 记录 pluginId
		pluginId,
		// 记录共享 realm
		realm,
		// 记录 entry origin
		entryOrigin: entryOriginOf(entry),
		// 结束 ctx 字面量
	};
	// 压栈，使 activeCtx 指向本次加载
	captureStack.push(ctx);
	// 确保 head/CSSOM 劫持已安装
	ensureHeadPatch();
	// 先修复被误 scope 的 Host 关键样式
	repairHostCriticalStyles();
	// 收回 head 里已属于该 entry 的样式到本 realm
	reclaimEntryStyles(ctx);

	// ponytail: 只听 head 直系 childList；空 style / HMR 由节点级 MO 负责
	// 见上行 ponytail：监听 head 直系子节点新增并 processNode
	const obs = new MutationObserver((mutations) => {
		// 若栈顶已不是本 realm（嵌套其它 Remote）则忽略
		if (activeCtx()?.realm !== realm) return;
		// 遍历每条 mutation
		for (const m of mutations) {
			// 对每个 addedNode 尝试 style/link 隔离
			for (const n of m.addedNodes) processNode(n, ctx);
			// 结束 addedNodes / mutations 内层循环
		}
		// 结束 MutationObserver 回调
	});
	// 只观察 childList，不做 subtree（空 style/HMR 由节点级 MO 负责）
	obs.observe(document.head, { childList: true });

	// 返回结束捕获的 dispose
	return () => {
		// 停止 head 级观察
		obs.disconnect();
		// 从栈尾侧查找本 ctx，支持嵌套乱序结束
		const idx = captureStack.lastIndexOf(ctx);
		// 找到则删除该帧，避免残留 active
		if (idx >= 0) captureStack.splice(idx, 1);
		// 配对释放 head/CSSOM patch
		releaseHeadPatch();
		// 结束 dispose 回调
	};
	// 结束 beginPluginStyleCapture
}

// Portal/Teleport 段：把挂到 document.body 的节点重定向进带 @scope 的插件 scope 容器
/* -------------------- Portal / Teleport → @scope -------------------- */

// 已 attach Portal 桥的 pluginId 集合；空且无视认领时可释放 body 原型 patch
const portalPlugins = new Set<string>();
/** pluginId → realm，Portal 容器需带 style-realm 才能吃到 CSS */
// 见上行 JSDoc：realm 写入 scope 容器的 data-mf-style-realm，使 @scope CSS 命中弹层
const portalRealmByPlugin = new Map<string, string>();

// 原生 append 到 body 时跳过重定向的标签（资源/元数据/宿主专用标记）
const PORTAL_SKIP_TAGS = new Set([
	// 脚本须挂真实 body，重定向会破坏加载与执行顺序
	'SCRIPT',
	// 样式表由 head 捕获路径处理，不走 Portal 收编
	'STYLE',
	// 外链资源保持在 document 级，避免进 scope 失效
	'LINK',
	// 文档元信息必须留在 head/body 顶层
	'META',
	// 无脚本降级内容不应进插件 scope
	'NOSCRIPT',
	// 模板节点非可见 UI，勿当弹层收编
	'TEMPLATE',
	// <base> 影响整页 URL 解析，禁止挪动
	'BASE',
	// 结束 PORTAL_SKIP_TAGS 集合字面量
]);

// 从 DOM 节点向上查找所属插件 id（portal scope 或插件根，且须在 portalPlugins 内）
function claimIdFromElement(el: Element | null): string | null {
	// 无节点则无法认领插件
	if (!el) return null;
	// 优先：节点已在某插件的 portal scope 容器内
	const scope = el.closest('[data-mf-portal-scope]');
	// 命中 portal scope 祖先则在其内解析 pluginId
	if (scope) {
		// 读 scope 容器上的 data-mf-portal-scope 作为 pluginId
		const id = scope.getAttribute('data-mf-portal-scope');
		// id 有效且该插件仍开着 Portal 桥才认领
		if (id && portalPlugins.has(id)) return id;
		// 结束 scope 分支
	}
	// 否则找插件业务根：带 data-mf-plugin 且非 stamp/scope 自身
	const root = el.closest(
		// 排除 portal 占位与 scope 容器，避免把 stamp 节点当业务根
		'[data-mf-plugin]:not([data-mf-portal-stamp]):not([data-mf-portal-scope])',
		// 结束 closest 调用
	);
	// 从插件根读 data-mf-plugin
	const id = root?.getAttribute('data-mf-plugin');
	// 仅当 id 在 portalPlugins 内才返回，否则 null
	return id && portalPlugins.has(id) ? id : null;
	// 结束 claimIdFromElement
}

// 安装 pointer/focus 桥：在用户交互时更新 lastTouchedPluginId 供 Portal 认领
function ensureTouchBridge() {
	// SSR 或已装过则跳过，避免重复注册捕获监听
	if (touchBridgeInstalled || typeof document === 'undefined') return;
	// 标记已安装，后续 attach/claim 不再重复 bind 监听
	touchBridgeInstalled = true;

	// 捕获阶段监听 pointerover，跟踪指针进入的插件域
	document.addEventListener(
		// 事件名 pointerover
		'pointerover',
		// pointerover 回调：对比移入/移出侧的 pluginId
		(e) => {
			// 新悬停目标所属插件
			const to = claimIdFromElement(
				// target 非 Element 时传 null
				e.target instanceof Element ? e.target : null,
				// 结束 claimIdFromElement(to) 实参
			);
			// 指针离开侧所属插件
			const from = claimIdFromElement(
				// relatedTarget 非 Element 时传 null
				e.relatedTarget instanceof Element ? e.relatedTarget : null,
				// 结束 claimIdFromElement(from) 实参
			);
			// 仍在同一插件域内移动时不更新 lastTouched
			if (to === from) return;
			// 跨插件或进出 Host 时刷新「最近交互插件」
			lastTouchedPluginId = to;
			// 结束 pointerover 回调
		},
		// 捕获阶段：先于目标节点收到事件
		true,
		// 结束 pointerover 注册
	);
	// 捕获 focusin：键盘 Tab 进入插件控件时也能认领
	document.addEventListener(
		// 事件名 focusin
		'focusin',
		// focusin 回调：以 focus 目标认领插件
		(e) => {
			// 用 focus 目标更新 lastTouchedPluginId
			lastTouchedPluginId = claimIdFromElement(
				// target 非 Element 时传 null
				e.target instanceof Element ? e.target : null,
				// 结束 claimIdFromElement 实参
			);
			// 结束 focusin 回调
		},
		// 捕获阶段
		true,
		// 结束 focusin 注册
	);
	// 结束 ensureTouchBridge
}

/** 打开 Host Portal 外壳前的同步认领（不等 attach）；关闭时 clear */
// 见上行 JSDoc：Host 打开 Drawer 等外壳前的同步认领，优先于 lastTouched
let portalClaimOverride: string | null = null;

// 决定 body Portal 应收编到哪个 pluginId：override → touch → focus → sticky hover
function resolveClaimPluginId(): string | null {
	// 若有 Host 外壳预认领且插件仍活跃
	if (
		// portalClaimOverride 非空
		portalClaimOverride &&
		// portalPlugins 仍包含 override id
		(portalPlugins.has(portalClaimOverride) ||
			// 或 portalRealmByPlugin 仍映射该 id
			portalRealmByPlugin.has(portalClaimOverride))
		// 结束 override 条件
	) {
		// 返回 portalClaimOverride
		return portalClaimOverride;
		// 结束 override 分支
	}
	// 次选：最近一次 pointer/focus 交互的插件
	if (lastTouchedPluginId && portalPlugins.has(lastTouchedPluginId)) {
		// 返回 lastTouchedPluginId
		return lastTouchedPluginId;
		// 结束 lastTouched 分支
	}
	// 再次：当前 document.activeElement 所在插件
	const ae = document.activeElement;
	// activeElement 是 Element 才向上 claim
	if (ae instanceof Element) {
		// 从焦点元素认领 pluginId
		const id = claimIdFromElement(ae);
		// 焦点在插件内则返回该 id
		if (id) return id;
		// 结束 activeElement 分支
	}
	// sticky：仅当 scope 仍 :hover（含弹层）时沿用，避免误收 Host Toaster；比「有子节点就占」更安全
	// 末选 sticky：scope 仍有子节点且仍 :hover 时沿用（弹层未关）
	for (const id of portalPlugins) {
		// 查该插件在 body 上的 portal scope 容器
		const host = document.querySelector(
			// 用 cssEscapeIdent 安全嵌入属性选择器
			`[data-mf-portal-scope="${cssEscapeIdent(id)}"]`,
			// 结束 querySelector 实参
		);
		// 容器存在、非空且自身或子孙仍 hover 才 sticky
		if (
			// host 必须是 HTMLElement
			host instanceof HTMLElement &&
			// 有 Portal 子树才值得 sticky
			host.childElementCount > 0 &&
			// matches/querySelector :hover 覆盖弹层悬停
			(host.matches(':hover') || host.querySelector(':hover'))
			// 结束 hover 判断
		) {
			// 返回仍悬停的插件 id
			return id;
			// 结束 if (host ...)
		}
		// 结束 for (portalPlugins)
	}
	// 无法认领任何插件，返回 null
	return null;
	// 结束 resolveClaimPluginId
}

/**
 * 在 Host 打开会 Portal 的外壳（如 Drawer）之前同步认领，
 * 让首帧 createPortal 就进 scope，避免「先 body 再搬进 scope」整树重挂闪烁。
 */
// 见上行 JSDoc：Host 打开会 Portal 的外壳前同步认领，首帧 createPortal 即进 scope
export function claimPluginPortalTarget(pluginId: string, realm: string): void {
	// 确保 pointer/focus 桥与 createPortal、body patch 已就绪
	ensureTouchBridge();
	// 安装 ReactDOM.createPortal 重定向
	ensureCreatePortalPatch();
	// 安装 Node/Element body 挂载原型 patch
	ensureBodyPortalPatch();
	// 记录 pluginId → realm 供 scope 容器写 data-mf-style-realm
	portalRealmByPlugin.set(pluginId, realm);
	// 同步 override：resolveClaimPluginId 首帧即返回该插件
	portalClaimOverride = pluginId;
	// 同时刷新 lastTouched，与 override 一致
	lastTouchedPluginId = pluginId;
	// 创建或更新 body 上该插件的 portal scope 容器
	ensureBodyPortalScope(pluginId);
	// 结束 claimPluginPortalTarget
}

// Drawer 等关闭时清除预认领；可选按 pluginId 精确清除
export function clearPluginPortalClaim(pluginId?: string | null): void {
	// 指定 id 且 override 不是它则不动（避免误清其他插件 claim）
	if (pluginId && portalClaimOverride !== pluginId) return;
	// 清除 Host 预认领
	portalClaimOverride = null;
	// 若无活跃插件且无 override，尝试还原 body 原型
	maybeReleaseBodyPortalPatch();
	// 结束 clearPluginPortalClaim
}

/**
 * Portal overlay 根：全屏 fixed + pointer-events:none（点击穿透到主界面），
 * 子树由 ensurePortalPointerCss 恢复事件。避免 0×0 / height:0 压缩 absolute 浮层。
 */
const PORTAL_SCOPE_STYLE =
	'position:fixed;inset:0;width:100%;height:100%;margin:0;padding:0;overflow:visible;pointer-events:none;z-index:2147503646;';

let portalPointerCssInstalled = false;

/** 一次注入：portal 子节点可点（父级 pointer-events:none） */
function ensurePortalPointerCss() {
	if (portalPointerCssInstalled || typeof document === 'undefined') return;
	portalPointerCssInstalled = true;
	const style = document.createElement('style');
	style.dataset.mfHostStyle = '1';
	// 父级 inline pointer-events:none；仅恢复直接子树可点（子代默认跟着可点）
	style.textContent = '[data-mf-portal-scope]>*{pointer-events:auto;}';
	document.head.appendChild(style);
}

/** body 弹层节点打上 realm，使 `[realm].el-popper` 自身选择器生效 */
function stampRealmOnPortalNode(node: Node) {
	if (node instanceof DocumentFragment) {
		for (const child of node.childNodes) stampRealmOnPortalNode(child);
		return;
	}
	if (!(node instanceof HTMLElement)) return;
	const id = resolveClaimPluginId();
	const realm = id ? portalRealmByPlugin.get(id) : undefined;
	if (!realm) return;
	node.setAttribute('data-mf-style-realm', realm);
	if (id) node.setAttribute('data-mf-plugin', id);
}

// 获取或创建 body 上某插件的 portal scope 容器（弹层实际挂载点）
function ensureBodyPortalScope(pluginId: string): HTMLElement {
	// 确保已注入「portal 子节点可点」的全局 CSS
	ensurePortalPointerCss();
	// 按插件 id 构造 portal scope 选择器（cssEscapeIdent 防特殊字符）
	const sel = `[data-mf-portal-scope="${cssEscapeIdent(pluginId)}"]`;
	// 复用已存在的 scope 容器，避免重复挂载
	let el = document.querySelector(sel) as HTMLElement | null;
	// 取该插件当前绑定的样式 realm（可能晚于首次创建才写入 map）
	const realm = portalRealmByPlugin.get(pluginId);
	// 已有容器：同步 realm / 样式后直接返回
	if (el) {
		// realm 已就绪且与 DOM 不一致时补打，保证 `[realm]` 选择器命中
		if (realm && el.getAttribute('data-mf-style-realm') !== realm) {
			// 写回最新 realm
			el.setAttribute('data-mf-style-realm', realm);
			// 结束 realm 同步
		}
		// 每次取用都重刷 overlay 样式，防止被外部改坏
		el.style.cssText = PORTAL_SCOPE_STYLE;
		// 复用现有节点
		return el;
		// 结束已存在分支
	}
	// 新建全屏 fixed 的 portal 根容器
	el = document.createElement('div');
	// 标记所属插件，便于排查与清理
	el.setAttribute('data-mf-plugin', pluginId);
	// 有 realm 则立刻打上，使 scoped CSS 对弹层生效
	if (realm) el.setAttribute('data-mf-style-realm', realm);
	// 核心标记：append 重定向与卸载清理都靠它定位
	el.setAttribute('data-mf-portal-scope', pluginId);
	// stamp 标记：shouldSkipPortalNode 据此跳过，避免 scope 再被重定向
	el.dataset.mfPortalStamp = '1';
	// 全屏穿透容器样式（子树由 ensurePortalPointerCss 恢复可点）
	el.style.cssText = PORTAL_SCOPE_STYLE;
	// 挂 body 前抬忙标，避免自身 append 被 body patch 再次拦截
	bodyPatchBusy = true;
	// try/finally 保证忙标一定落下
	try {
		// 挂到 document.body 作为该插件弹层根
		document.body.appendChild(el);
		// 结束 try
	} finally {
		// 无论成败都清除忙标
		bodyPatchBusy = false;
		// 结束 finally
	}
	// 返回新建的 scope 容器
	return el;
	// 结束 ensureBodyPortalScope
}

// 插件卸载时移除 body 上对应 portal scope 容器
function removeBodyPortalScope(pluginId: string) {
	// 按 data-mf-portal-scope 查找并 remove
	document
		// 选择器含 cssEscapeIdent 防 id 注入
		.querySelector(`[data-mf-portal-scope="${cssEscapeIdent(pluginId)}"]`)
		// 可选链 remove
		?.remove();
	// 结束 removeBodyPortalScope
}

// 判断 createPortal/append 目标是否为 document.body 或 documentElement
function isBodyPortalTarget(
	// container 参数类型
	container: Element | DocumentFragment | null | undefined,
	// 结束参数列表
): boolean {
	// body 或 html 根即视为需重定向的 Portal 目标
	return container === document.body || container === document.documentElement;
	// 结束 isBodyPortalTarget
}

// 判断原生 append 的节点是否应跳过重定向（资源/宿主/scope 自身）
function shouldSkipPortalNode(node: Node): boolean {
	// DocumentFragment 需继续处理（React 18 可能 portal 到 fragment）
	if (node instanceof DocumentFragment) return false;
	// 非 Element 节点（文本等）跳过
	if (!(node instanceof Element)) return true;
	// head 资源类标签不应收编进插件 scope
	if (PORTAL_SKIP_TAGS.has(node.tagName)) return true;
	// portal scope 容器自身不再重定向
	if (node.hasAttribute('data-mf-portal-scope')) return true;
	// stamp 占位节点跳过
	if (node.hasAttribute('data-mf-portal-stamp')) return true;
	// Host Sonner toaster 永不收编
	if (node.hasAttribute('data-sonner-toaster')) return true;
	// Host 专用 portal 标记节点跳过
	if (node.hasAttribute('data-mf-host-portal')) return true;
	// 其余 Element 可参与重定向
	return false;
	// 结束 shouldSkipPortalNode
}

// 若目标是 body/html，按认领结果替换为插件 scope 容器
function retargetPortalContainer(
	// container 参数
	container: Element | DocumentFragment,
	// 结束参数列表
): Element | DocumentFragment {
	// 非 body 级目标原样返回
	if (!isBodyPortalTarget(container)) return container;
	// Host 自有 portal 外壳内的挂载不重定向
	if (
		// container 是 Element
		container instanceof Element &&
		// 在 data-mf-host-portal 子树内则保持原 container
		container.closest('[data-mf-host-portal]')
		// 结束 host-portal 条件
	) {
		// host-portal 子树内返回原 container
		return container;
		// 结束 host-portal 分支
	}
	// 解析当前应收编的 pluginId
	const id = resolveClaimPluginId();
	// 无法认领则保持挂到 body（Host 全局 UI）
	if (!id) return container;
	// 有认领则 ensureBodyPortalScope，把 body 目标换成插件 scope 容器
	return ensureBodyPortalScope(id);
	// 结束 retargetPortalContainer
}

// createPortal patch 是否已安装（单次 patch，portalPlugins 驱动释放）
let createPortalPatched = false;
// 保存 ReactDOM.createPortal 原始实现
let origCreatePortal: typeof ReactDOM.createPortal | null = null;

/** Host Toaster 等：children 可识别时永不收编，避免 lastTouched 误伤 */
// 见上行 JSDoc：识别 Host Toaster 等受保护 children，避免被 lastTouched 误收编
function isHostProtectedPortalChildren(children: ReactNode): boolean {
	// 非单一 React 元素则无法从 props 识别，不保护
	if (!isValidElement(children)) return false;
	// 收窄 props 类型以读 data-* 与 className
	const p = children.props as {
		// className 字段
		className?: string;
		// Sonner toaster 标记
		'data-sonner-toaster'?: unknown;
		// Host portal 标记
		'data-mf-host-portal'?: unknown;
		// 结束 props 类型
	};
	// 显式 Host portal/toaster 标记则保护
	if (p['data-sonner-toaster'] != null || p['data-mf-host-portal'] != null) {
		// 命中 data 属性则走原生 createPortal 到 body
		return true;
		// 结束 data 属性保护 if 块
	}
	// 读 className
	const cn = p.className;
	// class 含 toaster 词也视为 Host 全局 toast 容器
	return typeof cn === 'string' && /\btoaster\b/.test(cn);
	// 结束 isHostProtectedPortalChildren
}

// 一次性 patch ReactDOM.createPortal：body 目标重定向到插件 scope
function ensureCreatePortalPatch() {
	// 已 patch 则直接返回
	if (createPortalPatched) return;
	// 标记已 patch
	createPortalPatched = true;
	// 绑定原始 createPortal 供 wrapper 委托
	origCreatePortal = ReactDOM.createPortal.bind(ReactDOM);
	// 替换为包装函数，在调用前改写 container
	ReactDOM.createPortal = ((children, container, key) => {
		// Host 受保护 children 永不改 container
		if (isHostProtectedPortalChildren(children)) {
			// 委托原生 createPortal
			return origCreatePortal!(children, container as Element, key);
			// 结束 protected 分支
		}
		// 有活跃 Portal 插件或 Host 预认领时才尝试 retarget
		const next =
			// portalPlugins 非空或 portalClaimOverride 存在
			portalPlugins.size > 0 || portalClaimOverride
				? // body 目标经 retargetPortalContainer 换成 scope 容器
					retargetPortalContainer(container as Element | DocumentFragment)
				: // 否则保持原 container
					container;
		// 用（可能已重定向的）container 调用原生 createPortal
		return origCreatePortal!(children, next as Element, key);
		// 结束 createPortal wrapper 并断言类型
	}) as typeof ReactDOM.createPortal;
	// 结束 ensureCreatePortalPatch
}

/** Vue Teleport / 原生 append 到 body：与 createPortal 同一套认领，框架无关 */
// 见上行 JSDoc：Vue Teleport / 原生 append 与 createPortal 共用认领逻辑
let bodyPortalPatched = false;
// body 原型 patch 是否已安装
let bodyPatchBusy = false;
// patch 内部 append scope 容器时置 true，防止递归重定向
let origBodyAppend: typeof Node.prototype.appendChild | null = null;
// 保存 Node.prototype.appendChild
let origBodyInsert: typeof Node.prototype.insertBefore | null = null;
// 保存 Node.prototype.insertBefore
let origBodyAppendFn: typeof Element.prototype.append | null = null;
// 保存 Element.prototype.append
let origBodyPrepend: typeof Element.prototype.prepend | null = null;
// 保存 Element.prototype.prepend
let origBodyRemove: typeof Node.prototype.removeChild | null = null;
// 保存 Node.prototype.removeChild（镜像 retarget 卸载）
let origBodyReplace: typeof Node.prototype.replaceChild | null = null;

/**
 * append 被重定向到 portal scope 后，调用方仍可能对 body 做 remove/replace。
 * 若 child 实际父节点已变，改从实际父节点操作，避免 NotFoundError。
 */
function resolveRetargetedChildParent(assumedParent: Node, child: Node): Node {
	// 读 child 当前真实父节点
	const actual = child.parentNode;
	// 已挂到别的父节点（典型：portal scope）则改用实际父
	return actual && actual !== assumedParent ? actual : assumedParent;
	// 结束 resolveRetargetedChildParent
}

// 保存 Element.prototype.prepend
function retargetBodyMount(parent: Node, node: Node): Node {
	// 原生 append 到 body 时：按认领把 parent 换成插件 scope 容器
	if (bodyPatchBusy) return parent;
	// patch 自身正在 append scope 节点时不改写 parent
	if (parent !== document.body && parent !== document.documentElement) {
		// 仅 body/documentElement 作为 parent 才参与重定向
		return parent;
		// parent 非 body 则原样返回
	}
	// 结束 parent 非 body 分支
	if (portalPlugins.size === 0 && !portalClaimOverride) return parent;
	// 无活跃 Portal 且无预认领则不改 parent
	if (shouldSkipPortalNode(node)) return parent;
	// 应跳过的节点类型保持挂到 body
	return retargetPortalContainer(parent as Element);
	// 否则按 retargetPortalContainer 解析 scope 容器作为 parent
}

// 结束 retargetBodyMount
function ensureBodyPortalPatch() {
	// patch Node/Element 原型：拦截所有框架的 body 级 DOM 挂载
	if (bodyPortalPatched) return;
	// 已 patch 则返回
	bodyPortalPatched = true;
	// 标记 body patch 已安装
	origBodyAppend = Node.prototype.appendChild;
	// 缓存 appendChild
	origBodyInsert = Node.prototype.insertBefore;
	// 缓存 insertBefore
	origBodyAppendFn = Element.prototype.append;
	// 缓存 Element.append
	origBodyPrepend = Element.prototype.prepend;
	// 缓存 Element.prepend
	origBodyRemove = Node.prototype.removeChild;
	// 缓存 removeChild
	origBodyReplace = Node.prototype.replaceChild;
	// 缓存 replaceChild

	Node.prototype.appendChild = function mfAppendChild<T extends Node>(
		// 包装 Node.prototype.appendChild
		node: T,
		// appendChild 的 node 参数
	): T {
		// appendChild 包装函数体开始
		if (
			// 早退条件：busy / 非 body / 无 Portal
			bodyPatchBusy ||
			// bodyPatchBusy
			(this !== document.body && this !== document.documentElement) ||
			// this 非 body/documentElement
			(portalPlugins.size === 0 && !portalClaimOverride)
			// 无 portalPlugins 且无 override
		) {
			// 结束早退条件
			return origBodyAppend!.call(this, node) as T;
			// 走原生 appendChild
		}
		const parent = retargetBodyMount(this, node);
		const ret = origBodyAppend!.call(parent, node) as T;
		if (parent !== this) stampRealmOnPortalNode(node);
		return ret;
	};

	// 结束 appendChild 包装
	Node.prototype.insertBefore = function mfInsertBefore<T extends Node>(
		// 包装 Node.prototype.insertBefore
		node: T,
		// insertBefore 的 node 参数
		ref: Node | null,
		// ref 参数
	): T {
		// insertBefore 包装函数体开始
		if (
			// 早退条件同 appendChild
			bodyPatchBusy ||
			// bodyPatchBusy
			(this !== document.body && this !== document.documentElement) ||
			// 非 body parent
			(portalPlugins.size === 0 && !portalClaimOverride)
			// 无 Portal 活跃
		) {
			// 结束早退条件
			return origBodyInsert!.call(this, node, ref) as T;
			// 原生 insertBefore
		}
		// 结束早退 if 块：需要把挂到 body/html 的节点重定向到插件 Portal
		// 按当前 node 解析实际应挂载的父节点（可能是某插件的 portal 容器）
		const parent = retargetBodyMount(this, node);
		// 父节点已被改写：说明该节点应进 Portal，而非真实 body/html
		if (parent !== this) {
			// Portal 内通常没有原 ref 对应节点，改用 append 挂到重定向父上
			const ret = origBodyAppend!.call(parent, node) as T;
			// 给 Portal 节点打上 realm 标记，供样式隔离 / 归属识别
			stampRealmOnPortalNode(node);
			// 返回已挂载节点，保持与原生 insertBefore 相同的返回约定
			return ret;
		}
		// 未重定向：父仍是 this，按原语义在 body/html 上 insertBefore
		return origBodyInsert!.call(this, node, ref) as T;
	};

	// 结束 insertBefore 包装
	// 镜像 remove：body.removeChild 时若节点已被 append 重定向，从实际父节点卸下
	Node.prototype.removeChild = function mfRemoveChild<T extends Node>(
		// 待移除子节点
		child: T,
		// 返回被移除节点
	): T {
		// busy 或非 body/html：原生路径
		if (
			bodyPatchBusy ||
			(this !== document.body && this !== document.documentElement)
		) {
			return origBodyRemove!.call(this, child) as T;
		}
		// 解析可能被 retarget 后的实际父节点
		const parent = resolveRetargetedChildParent(this, child);
		return origBodyRemove!.call(parent, child) as T;
	};

	// 镜像 replace：与 removeChild 同理，避免 body.replaceChild 找不到节点
	Node.prototype.replaceChild = function mfReplaceChild<T extends Node>(
		// 新节点
		node: Node,
		// 旧节点
		child: T,
		// 返回被替换的旧节点
	): T {
		if (
			bodyPatchBusy ||
			(this !== document.body && this !== document.documentElement)
		) {
			return origBodyReplace!.call(this, node, child) as T;
		}
		const parent = resolveRetargetedChildParent(this, child);
		// 旧节点在 scope 内：在实际父上 replace；新节点若仍走 body append 路径由其它 patch 处理
		return origBodyReplace!.call(parent, node, child) as T;
	};

	Element.prototype.append = function mfAppend(
		// 包装 Element.prototype.append
		...nodes: (Node | string)[]
		// 可变 nodes 参数
	): void {
		// append 包装函数体开始
		if (
			// 早退条件
			bodyPatchBusy ||
			// bodyPatchBusy
			(this !== document.body && this !== document.documentElement) ||
			// 非 body
			(portalPlugins.size === 0 && !portalClaimOverride)
			// 无 Portal
		) {
			// 结束早退条件
			origBodyAppendFn!.apply(this, nodes);
			// 原生 append 全部入参
			return;
			// return 结束早退
		}
		// 结束早退 if 块
		for (const n of nodes) {
			// for 逐节点 retarget
			if (typeof n === 'string') {
				// 字符串节点直接 append
				origBodyAppendFn!.call(this, n);
				// 原生 append 字符串
				continue;
				// continue 下一节点
			}
			// 结束字符串 if 块
			const parent = retargetBodyMount(this, n);
			if (parent !== this) {
				origBodyAppend!.call(parent, n);
				stampRealmOnPortalNode(n);
			} else {
				origBodyAppendFn!.call(this, n);
			}
		}
		// 结束 for 循环
	};

	// 结束 append 包装赋值
	Element.prototype.prepend = function mfPrepend(
		// 包装 Element.prepend，逻辑与 append 对称
		...nodes: (Node | string)[]
		// 可变 nodes 参数
	): void {
		// prepend 包装函数体开始
		if (
			// 早退条件
			bodyPatchBusy ||
			// bodyPatchBusy
			(this !== document.body && this !== document.documentElement) ||
			// 非 body
			(portalPlugins.size === 0 && !portalClaimOverride)
			// 无 Portal
		) {
			// 结束早退条件
			origBodyPrepend!.apply(this, nodes);
			// 原生 prepend 全部入参
			return;
			// return 结束早退
		}
		// 结束早退 if 块
		for (const n of nodes) {
			// for 逐节点处理
			if (typeof n === 'string') {
				// 字符串节点直接 prepend
				origBodyPrepend!.call(this, n);
				// 原生 prepend 字符串节点
				continue;
				// continue
			}
			// 结束字符串 if 块
			const parent = retargetBodyMount(this, n);
			if (parent !== this) {
				origBodyAppend!.call(parent, n);
				stampRealmOnPortalNode(n);
			} else {
				origBodyPrepend!.call(this, n);
			}
		}
		// 结束 for 循环
	};
	// 结束 prepend 包装赋值
}

// 结束 ensureBodyPortalPatch
function maybeReleaseBodyPortalPatch() {
	// 无活跃 Portal 且无预认领时还原 body 原型，避免污染全局 DOM API
	if (!bodyPortalPatched) return;
	// 未 patch 则无需释放
	if (portalPlugins.size > 0 || portalClaimOverride) return;
	// 仍有插件或 override 时保持 patch
	if (origBodyAppend) Node.prototype.appendChild = origBodyAppend;
	// 还原 appendChild
	if (origBodyInsert) Node.prototype.insertBefore = origBodyInsert;
	// 还原 insertBefore
	if (origBodyAppendFn) Element.prototype.append = origBodyAppendFn;
	// 还原 Element.append
	if (origBodyPrepend) Element.prototype.prepend = origBodyPrepend;
	// 还原 Element.prepend
	if (origBodyRemove) Node.prototype.removeChild = origBodyRemove;
	// 还原 removeChild
	if (origBodyReplace) Node.prototype.replaceChild = origBodyReplace;
	// 还原 replaceChild
	origBodyAppend = null;
	// 清空保存的 appendChild 引用
	origBodyInsert = null;
	// 清空 insertBefore
	origBodyAppendFn = null;
	// 清空 append
	origBodyPrepend = null;
	// 清空 prepend
	origBodyRemove = null;
	// 清空 removeChild
	origBodyReplace = null;
	// 清空 replaceChild
	bodyPortalPatched = false;
	// 允许下次 attach 重新 patch
}

/**
 * Element Plus 等会先在 body 建 `#*-popper-container-*`，再 Teleport 进该容器。
 * 若建容器时 Portal 桥尚未装上，节点会落在真实 body（无 style-realm），样式全失效。
 * attach 时把已游离的容器收进当前插件的 portal scope。
 */
function reclaimOrphanPopperContainers(pluginId: string) {
	// 取（或创建）当前插件在 body 上的 portal scope 容器，作为收编目标
	const scope = ensureBodyPortalScope(pluginId);
	// 快照 body 直接子节点：遍历中可能 append 改动 children，避免 live 集合跳项
	for (const node of Array.from(document.body.children)) {
		// 非元素节点（文本/注释等）无 id，跳过
		if (!(node instanceof HTMLElement)) continue;
		// 只认 Element Plus 一类 `#*-popper-container-*` 游离容器
		if (!/-popper-container-/i.test(node.id || '')) continue;
		// 已在任一 portal scope 内则不必再搬（含本插件与其它插件）
		if (node.closest('[data-mf-portal-scope]')) continue;
		// 挂入本插件 scope，使后续 Teleport/弹层继承 data-mf-style-realm
		scope.appendChild(node);
	}
}

// 结束 maybeReleaseBodyPortalPatch
function attachPortalScopeBridge(pluginId: string, realm: string): () => void {
	// 插件 attach 期间注册 Portal 桥：touch/createPortal/body patch + scope 容器
	ensureTouchBridge();
	// 安装交互认领桥
	ensureCreatePortalPatch();
	// patch React createPortal
	ensureBodyPortalPatch();
	// patch body 原型挂载
	portalPlugins.add(pluginId);
	// 标记该 pluginId 启用 Portal 收编
	portalRealmByPlugin.set(pluginId, realm);
	// 记录 realm 供 scope 容器写 style-realm
	lastTouchedPluginId = pluginId;
	// 默认最近交互为该插件
	ensureBodyPortalScope(pluginId);
	// 确保 body 上存在 portal scope 容器
	// 收回竞态下已挂到真实 body 的 EP popper 容器
	reclaimOrphanPopperContainers(pluginId);
	return () => {
		// 返回 teardown：卸载时撤销 Portal 桥与 DOM
		portalPlugins.delete(pluginId);
		// 从活跃集合移除
		portalRealmByPlugin.delete(pluginId);
		// 清除 realm 映射
		removeBodyPortalScope(pluginId);
		// 移除 body scope 容器
		if (lastTouchedPluginId === pluginId) lastTouchedPluginId = null;
		// 若 lastTouched 指向本插件则清空
		maybeReleaseBodyPortalPatch();
		// 若无其他活跃插件则尝试释放 body patch
	};
	// 结束 attachPortalScopeBridge
}

/**
 * 插件页挂载期间继续隔离（HMR / 延迟 CSS）+ Portal/Teleport 静默纳入 realm。
 */
// 见上行 JSDoc：插件挂载期 CSS 捕获 + Portal 收编的统一入口
export function attachPluginStyleIsolation(
	// pluginId 标识插件实例
	pluginId: string,
	// remote entry URL
	entry: string,
	// 可选 remote 名称，参与 realm 键
	remoteName?: string,
	// 结束参数列表
): () => void {
	// 计算 @scope 用的 realm 键（同 remote 多插件可共享）
	const realm = styleRealmKey(entry, remoteName, pluginId);
	// 开启 head CSS 捕获与 @scope 改写
	const endCss = beginPluginStyleCapture(pluginId, entry, remoteName);
	// 开启 Portal scope 桥
	const endPortal = attachPortalScopeBridge(pluginId, realm);
	// 返回合并 teardown：卸载时先关 Portal 再关 CSS 捕获
	return () => {
		// 撤销 Portal 桥与 scope DOM
		endPortal();
		// 撤销 head patch 与 capture 栈项
		endCss();
		// 结束 teardown 回调
	};
	// 结束 attachPluginStyleIsolation
}

/** @internal smoke / 自检用 */
// 见上行 JSDoc：导出内部 transpile/scope 工具供 smoke 自检
export const __styleIsolationTest = {
	transpileStyleText,
	transpileStyleRule,
	unwrapScope,
	scopeSelector,
	resolveRetargetedChildParent,
	alreadyScoped,
	styleNeedsRescope,
};
