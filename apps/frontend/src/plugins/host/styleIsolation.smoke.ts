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
assert(out.indexOf('@import') < out.indexOf('@scope'), 'import before scope');
assert(
	out.indexOf('@font-face') < out.indexOf('@scope'),
	'font-face before scope',
);
assert(out.includes(`@scope (${sel})`), 'scoped');
assert(!out.includes('@keyframes spin'), 'raw keyframes renamed');
assert(out.includes('@keyframes __mf'), 'keyframes prefixed');
assert(!/@scope[\s\S]*@font-face/.test(out), 'font-face not inside scope');

const unwrapped = T.unwrapScope(out);
assert(!unwrapped.includes('@scope'), 'unwrap removes scope');
assert(unwrapped.includes('@font-face'), 'unwrap keeps font-face');

const rule = T.transpileStyleRule('.x{color:red}', sel, realm);
assert(rule.startsWith(`@scope (${sel})`), `rule scoped: ${rule}`);
assert(
	T.transpileStyleRule('@font-face{font-family:A}', sel, realm).startsWith(
		'@font-face',
	),
	'font-face rule global',
);

const nested = `@scope (.old) { .a { color: 1 } .b { color: 2 } }`;
assert(T.unwrapScope(nested).includes('.b { color: 2 }'), 'brace-aware unwrap');

// antd getScrollBarSize：body.append 被重定向后，body.remove 须落到实际父节点
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

console.log('styleIsolation.smoke: ok');
