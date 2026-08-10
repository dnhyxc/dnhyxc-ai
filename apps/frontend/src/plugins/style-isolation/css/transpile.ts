/**
 * CSS 选择器前缀转译（对齐 qiankun experimentalStyleIsolation）。
 * wrapWithPrefix：历史名 wrapWithScope，现为选择器前缀隔离入口。
 */
import { alreadyScoped, MF_ISO_MARK, MF_ISO_MARK_RE } from '../protocol';
import {
	isDocRootOnlySelectors,
	mapDocRootToken,
	stripHostThemeDecls,
} from './themeStrip';

// 匹配整段 @font-face（含嵌套大括号），供 hoist 为全局
const FONT_FACE_RE = /@font-face\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g;
// 匹配 @namespace 声明，须 hoist 到文件顶
const NAMESPACE_RE = /@namespace\s+[^;]+;/g;
// @import 正则续行声明：整句提到文件最前
const IMPORT_RE =
	/@import\s+(?:url\(\s*["']?[^"')]+["']?\s*\)|["'][^"']+["'])[^;]*;/g;

/** 按大括号深度剥最外层 @scope (…) { … }，保留 hoist 段 */
// 见上行 JSDoc：按大括号深度剥最外层 @scope，保留 hoist 段
export function unwrapScope(cssText: string): string {
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
export function splitSelectorList(list: string): string[] {
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
export function prefixCssRules(css: string, sel: string): string {
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
export function transpileStyleText(
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
export function transpileStyleRule(
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
export function wrapWithPrefix(
	cssText: string,
	sel: string,
	realm: string,
): string {
	return transpileStyleText(cssText, sel, realm);
}
