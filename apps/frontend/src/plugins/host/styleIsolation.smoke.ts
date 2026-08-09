/**
 * 样式隔离转译自检：断言失败即 exit 1。
 * 运行：pnpm --filter @dnhyxc-ai/frontend exec tsx src/plugins/host/styleIsolation.smoke.ts
 */
import { styleRealmKey, __styleIsolationTest as T } from './styleIsolation';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const realm = styleRealmKey('http://localhost:9008/mf-manifest.json');
assert(realm === 'entry:http://localhost:9008/', `realm got ${realm}`);

const sel = T.scopeSelector(realm);
assert(
	sel === '[data-mf-style-realm="entry:http://localhost:9008/"]',
	`sel got ${sel}`,
);

const css = `
@import url("https://fonts.example/a.css");
@font-face { font-family: X; src: url(x.woff2); }
@namespace svg "http://www.w3.org/2000/svg";
@keyframes spin { to { transform: rotate(360deg) } }
.box { animation: spin 1s linear; color: red; }
`;

const out = T.transpileStyleText(css, sel, realm);
assert(out.includes('@import'), 'import hoisted');
assert(out.includes('@font-face'), 'font-face present');
assert(out.includes('/*mf-iso:3*/'), 'iso v3 mark');
// 双选择器：后代 + 自身（body 弹层根打标）
assert(
	out.includes(`${sel} .box,${sel}.box`),
	`dual prefix .box: ${out.slice(0, 280)}`,
);
assert(!out.includes('@scope'), 'no @scope wrapper');
// keyframes 名保持：antd 把 @keyframes 与 animation-name 分到两个 style，改名会对不上
assert(out.includes('@keyframes spin'), 'keyframes name kept');
assert(out.includes('animation: spin 1s linear'), 'animation ref kept');
assert(!out.includes('@keyframes __mf'), 'no realm keyframes rename');

const unwrapped = T.unwrapScope(
	`@scope (${sel}) { .a { color: 1 } .b { color: 2 } }`,
);
assert(unwrapped.includes('.b { color: 2 }'), 'brace-aware unwrap');

const rule = T.transpileStyleRule('.x{color:red}', sel, realm);
assert(rule.includes(`${sel} .x,${sel}.x`), `rule dual: ${rule}`);
assert(
	T.transpileStyleRule('@font-face{font-family:A}', sel, realm).startsWith(
		'@font-face',
	),
	'font-face rule global',
);

const ep = T.transpileStyleText(
	':root{--el-color-primary:#409eff}.el-button{color:var(--el-color-primary)}',
	sel,
	realm,
);
assert(ep.includes(`${sel}{--el-color-primary`), `:root → realm`);
assert(ep.includes(`${sel} .el-button,${sel}.el-button`), 'el-button dual');

// :root 里 Host 语义 token 须剥离，否则盖住主站 accent / theme-background
const theme = T.transpileStyleText(
	':root{--brand-accent:#409eff;--theme-background:oklch(1 0 0);--background:oklch(1 0 0);--color-teal-500:var(--brand-accent);--color-theme-background:var(--theme-background);--el-color-primary:#409eff}',
	sel,
	realm,
);
assert(
	!theme.includes('--brand-accent:'),
	`strip brand-accent: ${theme.slice(0, 320)}`,
);
assert(
	!theme.includes('--theme-background:'),
	`strip theme-background: ${theme.slice(0, 320)}`,
);
assert(
	!theme.includes('--background:'),
	`strip background: ${theme.slice(0, 320)}`,
);
assert(
	theme.includes('--color-teal-500:var(--brand-accent)'),
	`keep @theme alias teal: ${theme.slice(0, 320)}`,
);
assert(
	theme.includes('--color-theme-background:var(--theme-background)'),
	`keep @theme alias bg: ${theme.slice(0, 320)}`,
);
assert(
	theme.includes('--el-color-primary:#409eff'),
	`keep element-plus token: ${theme.slice(0, 320)}`,
);

// html/body 布局只打插件根，避免 Message 浮层 height:100% 拉成竖条
const doc = T.transpileStyleText(
	'html,body{height:100%;width:100%}body .x{color:red}',
	sel,
	realm,
);
assert(
	doc.includes(`${sel}[data-plugin-root]{height:100%;width:100%}`) ||
		(doc.includes(`${sel}[data-plugin-root]`) && doc.includes('height:100%')),
	`html/body → plugin-root: ${doc.slice(0, 240)}`,
);
assert(
	!doc.match(
		new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{height:100%`),
	),
	'bare realm must not get html/body height',
);
assert(
	doc.includes(`${sel}[data-plugin-root] .x`) ||
		doc.includes(`${sel}[data-plugin-root].x`),
	`body .x scoped to plugin-root: ${doc.slice(0, 280)}`,
);

// 旧 @scope / 旧 mf-iso 须升到 v3
const stale = `/*mf-iso:2*/\n@scope (${sel}) {\n:root{--x:1}.el-input{color:red}\n}\n`;
const fixed = T.transpileStyleText(stale, sel, realm);
assert(fixed.includes('/*mf-iso:3*/'), 'upgraded mark');
assert(fixed.includes(`${sel} .el-input,${sel}.el-input`), 'upgraded dual');
assert(!fixed.includes('@scope'), 'scope removed');

const media = T.transpileStyleText(
	'@media (min-width:1px){.el-input{color:red}}',
	sel,
	realm,
);
assert(media.includes(`${sel} .el-input,${sel}.el-input`), 'media dual');

const assumed = { id: 'body' } as unknown as Node;
const scope = { id: 'scope' } as unknown as Node;
const orphan = { parentNode: null } as unknown as Node;
const retargeted = { parentNode: scope } as unknown as Node;
assert(
	T.resolveRetargetedChildParent(assumed, orphan) === assumed,
	'orphan stays on assumed parent',
);
assert(
	T.resolveRetargetedChildParent(assumed, retargeted) === scope,
	'retargeted child uses actual parent',
);

// HMR：已前缀的旧标记勿再 wrap（否则与 cssinjs 互殴卡死）
const v2prefixed = `/*mf-iso:2*/\n${sel} .x,${sel}.x{color:red}`;
assert(T.styleNeedsRescope(v2prefixed, sel) === false, 'v2+sel no rescope');
assert(T.alreadyScoped(v2prefixed, sel) === false, 'v2 is not current mark');
assert(
	T.styleNeedsRescope(`${sel} .y{color:1}`, sel) === false,
	'sel-only no rescope',
);
assert(
	T.styleNeedsRescope('.bare{color:1}', sel) === true,
	'bare needs rescope',
);
assert(
	T.styleNeedsRescope(`@scope (${sel}) { .a{color:1} }`, sel) === true,
	'@scope needs rescope',
);

// Tailwind 选择器转义引号不得弄断 @layer 配对，否则 utilities 后整段泄漏到 Host（知识库被 padding 顶开等）
const twEsc = String.raw`@layer utilities{.after\:content-\[\"\"\]:after{--tw-content:"";content:var(--tw-content)}.foo{color:red}}html,body{margin:0;padding:8px}#root{height:100%}[data-radix-scroll-area-viewport]>div{min-width:0!important}`;
const noLeak = T.transpileStyleText(twEsc, sel, realm);
assert(
	noLeak.includes(`${sel} .foo,${sel}.foo`) || noLeak.includes(`${sel}.foo`),
	`utilities class prefixed: ${noLeak.slice(0, 280)}`,
);
assert(
	noLeak.includes(`${sel}[data-plugin-root]`),
	`html/body after utilities still mapped: ${noLeak.slice(-200)}`,
);
assert(
	!/(?:^|})\s*html\s*,\s*body\s*\{/.test(noLeak),
	`bare html,body must not leak: ${noLeak.slice(-180)}`,
);
assert(
	noLeak.includes(`${sel} #root,${sel}#root`) || noLeak.includes(`${sel}#root`),
	`#root prefixed: ${noLeak.slice(-200)}`,
);
assert(
	noLeak.includes(`${sel} [data-radix-scroll-area-viewport]`) ||
		noLeak.includes(`${sel}[data-radix-scroll-area-viewport]`),
	`radix viewport prefixed: ${noLeak.slice(-220)}`,
);

// :is(html, body) 须映射到 plugin-root，且逗号不拆坏
const isHtml = T.transpileStyleText(
	':is(html, body) ol{list-style:revert}',
	sel,
	realm,
);
assert(
	isHtml.includes(':is(') &&
		isHtml.includes(`${sel}[data-plugin-root]`) &&
		isHtml.includes('ol{list-style:revert}'),
	`:is(html,body) mapped: ${isHtml}`,
);
assert(!isHtml.includes(':is(html'), `no bare html in :is: ${isHtml}`);

// 文本路径：effect style（仅 keyframes）与主样式（animation-name）分标签，名须都能保持
const effectTag = T.transpileStyleText(
	'@keyframes css-dev-MessageMoveOut{from{opacity:1}to{opacity:0}}',
	sel,
	realm,
);
const mainTag = T.transpileStyleText(
	'.ant-message-move-up-leave{animation-name:css-dev-MessageMoveOut;animation-duration:.3s}',
	sel,
	realm,
);
assert(
	effectTag.includes('@keyframes css-dev-MessageMoveOut'),
	`effect keyframes kept: ${effectTag}`,
);
assert(
	mainTag.includes('animation-name:css-dev-MessageMoveOut'),
	`main animation-name kept: ${mainTag}`,
);
assert(
	mainTag.includes(`${sel} .ant-message-move-up-leave`) ||
		mainTag.includes(`${sel}.ant-message-move-up-leave`),
	`leave selector prefixed: ${mainTag}`,
);

// CSSOM 路径同样不改名
const kfRule = T.transpileStyleRule(
	'@keyframes css-dev-MessageMoveOut{from{opacity:1}to{opacity:0}}',
	sel,
	realm,
);
assert(
	kfRule.includes('@keyframes css-dev-MessageMoveOut'),
	`CSSOM keyframes keep name: ${kfRule}`,
);
const leaveRule = T.transpileStyleRule(
	'.ant-message-move-up-leave{animation-name:css-dev-MessageMoveOut}',
	sel,
	realm,
);
assert(
	leaveRule.includes('animation-name:css-dev-MessageMoveOut'),
	`CSSOM animation-name intact: ${leaveRule}`,
);

console.log('styleIsolation.smoke: ok');
