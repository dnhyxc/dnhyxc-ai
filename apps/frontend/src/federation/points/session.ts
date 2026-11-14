/**
 * 扩展点的唯一内存状态：槽位会话、页面上下文、回写信号。
 * 冷启动时插件还没下载，打开载荷必须先落在这里。
 */
import { listHostSurfacePlugins } from '@dnhyxc-ai/federation-kit';
import { getHostPoint } from './catalog';

export type SlotSession = {
	pluginId: string | null;
	open: boolean;
	payload: Record<string, unknown> | null;
	covered: boolean;
};

const EMPTY: SlotSession = Object.freeze({
	pluginId: null,
	open: false,
	payload: null,
	covered: false,
});

// 每个「扩展点 + 槽」一份会话。插件还没下载时，打开的载荷先落在这里
const slots = new Map<string, SlotSession>();
// 只关心某一个槽开关的订阅者，HostPoint 的抽屉靠这个重绘
const slotListeners = new Map<string, Set<() => void>>();
// 关心整个点的订阅者：上下文变了，或这个点上任意槽开关了，都会被叫到
const pointListeners = new Map<string, Set<() => void>>();
// 页面交给插件的上下文，只留目录里声明的键，例如词库的 libraryId
const contexts = new Map<string, Record<string, unknown> | null>();
// 顶栏统计单独放，关抽屉不会把它清掉
const statsByPoint = new Map<
	// 键是扩展点 id，单词库和别的点各记一份
	string,
	// null 表示插件声明这份统计作废
	{ total: number; loaded: number } | null
	// 结束统计 Map 的类型参数
>();
/** 进行中按「点 + 插件 + 词」分开，关抽屉不清，避免两枚按钮一起转。 */
const pending = new Map<string, boolean>();
// play、openCard 等由主站启动时挂上，插件按名字调用
const commands = new Map<string, (arg: unknown) => unknown>();
// 转圈和顶栏数字的订阅者。它们不绑在某一个槽上
const signalListeners = new Set<() => void>();
// 每写一次信号加一。useSyncExternalStore 拿这个数判断要不要重绘
let signalRev = 0;

// 槽在 Map 里的键。点 id 用点号，槽名用连字符，冒号不会和它们粘在一起
function slotKey(pointId: string, slot: string): string {
	// 例如 english.vocab.card:drawer
	return `${pointId}:${slot}`;
	// 结束 slotKey
}

// 进行中的词先收成同一把键，Apple 和 apple、多空格都算同一个词
function lemmaKey(word: string): string {
	// 去掉首尾空白，中间连续空白收成一个空格，再忽略大小写
	return word.trim().replace(/\s+/g, ' ').toLowerCase();
	// 结束 lemmaKey
}

// 某个槽开、关或被盖住时，叫醒这个槽和整个点的订阅者
function emitSlot(pointId: string, slot: string): void {
	// 先算出槽键，下面两拨订阅者用的不是同一把
	const key = slotKey(pointId, slot);
	// 拷一份再调用：订阅者若在回调里退订，不会漏掉后面的人
	for (const listener of [...(slotListeners.get(key) ?? [])]) listener();
	// 订了整个点的人也能看见槽变化，例如词库上下文订阅会跟着抽屉刷新
	for (const listener of [...(pointListeners.get(pointId) ?? [])]) listener();
	// 结束 emitSlot
}

// 只叫醒这个点的订阅者。上下文变化走这里，不带动别的点
function emitPoint(pointId: string): void {
	// 同样先拷贝，避免回调里退订打乱遍历
	for (const listener of [...(pointListeners.get(pointId) ?? [])]) listener();
	// 结束 emitPoint
}

// 转圈或顶栏数字变了，只叫醒信号订阅者。槽位和上下文订阅不跟着转圈重读
function emitSignals(): void {
	// 快照从数字变成新值，useSyncExternalStore 才会认为状态变了
	signalRev += 1;
	// 拷贝后再调，退订发生在回调里也不影响这一轮
	for (const listener of [...signalListeners]) listener();
	// 结束 emitSignals
}

// 读某一个槽。没开过时返回同一份冻结空会话，引用不变，订阅才不会死循环
export function readSlot(pointId: string, slot: string): SlotSession {
	// ?? 而不是新建对象：空槽每次都是 EMPTY 这一个引用
	return slots.get(slotKey(pointId, slot)) ?? EMPTY;
	// 结束 readSlot
}

// 订阅一个槽的开、关和覆盖。HostPoint 用它决定画不画抽屉
export function subscribeSlot(
	// 只听这一个扩展点
	pointId: string,
	// 只听这一个槽，词卡抽屉和词库列表抽屉互不叫醒
	slot: string,
	// 状态变了就调用，调用方自己再 readSlot
	listener: () => void,
	// 返回退订函数，组件卸载时用
): () => void {
	// 和 slots 用同一把键
	const key = slotKey(pointId, slot);
	// 这个槽第一次有人订阅时才建 Set
	const set = slotListeners.get(key) ?? new Set();
	// 同一个函数重复订阅只会留一份
	set.add(listener);
	// 新 Set 要写回 Map；已有的 Set 再写一次也还是同一个
	slotListeners.set(key, set);
	// 退订只拿掉这一个监听，别的组件还留着
	return () => set.delete(listener);
	// 结束 subscribeSlot
}

// 订阅整个点：上下文变了，或这个点上任意槽变了，都会调到 listener
export function subscribePoint(
	// 词库上下文和语句库上下文各订各的
	pointId: string,
	// 回调里不再带数据，读的人自己 readContext 或 readSlot
	listener: () => void,
	// 返回退订函数
): () => void {
	// 这个点还没有订阅者时新建 Set
	const set = pointListeners.get(pointId) ?? new Set();
	// Set 去重，严格重复的监听函数不会存两份
	set.add(listener);
	// 把 Set 放回这个点名下
	pointListeners.set(pointId, set);
	// 卸载时只删除自己
	return () => set.delete(listener);
	// 结束 subscribePoint
}

// 订阅转圈和顶栏数字。不区分是哪个点写的信号
export function subscribeSignals(listener: () => void): () => void {
	// 直接进总集合，emitSignals 时一律叫到
	signalListeners.add(listener);
	// 退订后不再因为别的按钮转圈而重绘
	return () => signalListeners.delete(listener);
	// 结束 subscribeSignals
}

// useSyncExternalStore 的快照。数字没变就不要重绘
export function readSignalRev(): number {
	// 返回当前代数，不在这里自增
	return signalRev;
	// 结束 readSignalRev
}

// 打开目录里已有的一个槽。插件可以还没下载，载荷先记在槽上
export function openPoint(
	// 只能打开 catalog 里登记过的点
	pointId: string,
	// 必须是这个点上已启用的插件，不能凭空指定一个 id
	pluginId: string,
	// 要打开的槽。动作按钮传来的是它 opens 指向的抽屉槽
	slot: string,
	// 冷启动载荷。词卡是词，导入是词库 id 和标题
	payload: Record<string, unknown>,
	// false：点或槽不存在，或这个插件当前没挂在能打开该槽的位置上
): boolean {
	// 未登记的点没有槽表
	const spec = getHostPoint(pointId);
	// 插件不能自造槽名。目录里没有这个槽就当没打开
	if (!spec?.slots.some((item) => item.name === slot)) return false;
	// 找出哪个动作槽负责打开这个抽屉，例如 card-action 打开 drawer
	const opener = spec.slots.find((item) => item.opens === slot)?.name;
	// 已启用插件里，槽位要么就是这个抽屉，要么是负责打开它的按钮
	const enabled = listHostSurfacePlugins(pointId).some(
		// 先对上插件 id，再看它声明的 host.slot
		(plugin) =>
			plugin.id === pluginId &&
			// 列表按钮直接挂在 drawer 上；词卡按钮挂在 card-action 上，两者都能开抽屉
			(plugin.host?.slot === slot || plugin.host?.slot === opener),
		// 结束这一条插件是否匹配
	);
	// 没启用或槽位对不上：不写会话，调用方看到 false
	if (!enabled) return false;
	// 通过检查后再算键，避免给非法槽留下空记录
	const key = slotKey(pointId, slot);
	// 整份替换。后一次打开盖住前一次的词和插件
	slots.set(key, {
		// 抽屉渲染时按这个 id 找插件正文
		pluginId,
		// 标记为开。覆盖只藏起来，不会把 open 改回 false
		open: true,
		// 浅拷贝：调用方随后改自己的对象，不会改到已经记下的载荷
		payload: { ...payload },
		// 新打开的槽自己不被盖住。词库列表再去盖词卡抽屉
		covered: false,
		// 结束这一份新会话
	});
	// 让抽屉和订了这个点的界面读到新会话
	emitSlot(pointId, slot);
	// 词库的 drawer 会盖住词卡抽屉；打开别的槽不会去盖
	if (spec.covers?.slot === slot) {
		// 被盖的抽屉保持 open，只是加上 covered，这样没有退场动画
		coverPoint(spec.covers.targetPoint, spec.covers.targetSlot);
		// 结束「这个槽负责覆盖别的抽屉」
	}
	// 会话已经写下，调用方可以认为抽屉打开了
	return true;
	// 结束 openPoint
}

// 关掉一个槽。若这个槽盖着别的抽屉，把被盖的那层重新露出来，但不关掉它
export function closePoint(pointId: string, slot: string): void {
	// 用来判断这个槽是不是「盖住别人」的那一个
	const spec = getHostPoint(pointId);
	// 没有这条会话时，下面的 cur 是 undefined
	const key = slotKey(pointId, slot);
	// 从未打开、也没被盖住时，cur 是空的
	const cur = slots.get(key);
	// 已经是关闭且未覆盖就直接返回，避免关一次通知一次
	if (!cur?.open && !cur?.pluginId && !cur?.covered) return;
	// 换成一份明确关闭的会话，不从 Map 里删键
	slots.set(key, {
		// 抽屉不再指向任何插件
		pluginId: null,
		// HostPoint 看到 open 为 false 就不画抽屉
		open: false,
		// 载荷丢掉，下次打开必须重新带上词或词库
		payload: null,
		// 自己也不再处于被覆盖状态
		covered: false,
		// 结束关闭后的会话
	});
	// 通知这个槽收起
	emitSlot(pointId, slot);
	// 关掉词库列表抽屉时，把词卡抽屉的 covered 拿掉，详解还开着
	if (spec?.covers?.slot === slot) {
		// 只取消覆盖，不调用 closePoint，词卡里的词还在
		uncoverPoint(spec.covers.targetPoint, spec.covers.targetSlot);
		// 结束揭开被盖抽屉
	}
	// 结束 closePoint
}

// 把一个槽标成被盖住。open 和载荷保持原样，抽屉组件只是看不见
export function coverPoint(pointId: string, slot: string): void {
	// 被盖的多半是词卡 drawer
	const key = slotKey(pointId, slot);
	// 词卡还没开过时也要有一份会话，才能记下 covered
	const cur = slots.get(key) ?? {
		// 没有插件正文可藏
		pluginId: null,
		// 本来就没开
		open: false,
		// 没有词
		payload: null,
		// 先按未覆盖来填，下面再改成 true
		covered: false,
		// 结束这份占位会话
	};
	// 已经盖住就不再写、也不再通知，避免列表和详解互相刷新
	if (cur.covered) return;
	// 保留原来的 open 和词，只把 covered 设为 true
	slots.set(key, { ...cur, covered: true });
	// 详解抽屉靠这次通知加上 invisible，不走关闭动画
	emitSlot(pointId, slot);
	// 结束 coverPoint
}

// 取消覆盖。抽屉若本来开着，会在原处重新出现
export function uncoverPoint(pointId: string, slot: string): void {
	// 和 coverPoint 用同一把槽键
	const key = slotKey(pointId, slot);
	// 没有会话，或根本没被盖住
	const cur = slots.get(key);
	// 未覆盖时不写 Map，关闭列表时重复揭开也不会多通知一次
	if (!cur?.covered) return;
	// open、插件和载荷都留着，只清 covered
	slots.set(key, { ...cur, covered: false });
	// 详解抽屉去掉 invisible
	emitSlot(pointId, slot);
	// 结束 uncoverPoint
}

// 页面把当前库、错题类型等交给这个点。离开页面时传 null
export function publishPointContext(
	// 上下文按点隔离，词库的 libraryId 不会出现在错题集上
	pointId: string,
	// null 表示页面离开或还没有可发布的值
	data: Record<string, unknown> | null,
): void {
	// 未登记的点不接收上下文
	const spec = getHostPoint(pointId);
	// 没有目录就无法知道该留哪些键
	if (!spec) return;
	// 清空：页面卸载或还没选中库
	if (!data) {
		// 这个点从来没发布过。先放一个 null，让下一次清空走下面的分支
		if (contexts.get(pointId) == null && !contexts.has(pointId)) {
			// 记下「已经清空过」，但当时没有旧值，不通知订阅方
			contexts.set(pointId, null);
			// 第一次清空到此结束
			return;
			// 结束「从未发布过」
		}
		// 已经是 null 时再清空不再通知，避免页面每次渲染都叫醒插件
		if (contexts.get(pointId) == null) return;
		// 原先有 libraryId 或 kind，现在页面离开了
		contexts.set(pointId, null);
		// 只通知这个点，插件的 getContext 会读到 null
		emitPoint(pointId);
		// 清空有旧值的情况到此结束
		return;
		// 结束 data 为 null
	}
	// 只收集目录允许的键，插件读到的对象里不会多出别的字段
	const next: Record<string, unknown> = {};
	// 词库声明 libraryId，错题集和复习声明 kind，每日阅读声明 origin
	for (const key of spec.contextKeys) {
		// 没传、null、空字符串都不当成有效上下文
		if (key in data && data[key] != null && data[key] !== '')
			// 原样留下，数字和字符串都不改
			next[key] = data[key];
		// 结束这一个声明键
	}
	// 拿上一份做比较，相同就不要再 emit
	const prev = contexts.get(pointId);
	// 键的集合和每个值都一样才算没变
	const same =
		// 上一份是 null 时不算相同，空对象要能把旧值清掉
		prev != null &&
		// 目录里每个键的值都还是上次那一个
		spec.contextKeys.every((key) => prev[key] === next[key]) &&
		// 防止上一份多出目录里已经删掉的键时被当成相同
		Object.keys(prev).length === Object.keys(next).length;
	// 页面每次渲染都 publish 同一份时，停在这里
	if (same) return;
	// 一个有效键都没有时记 null，和「离开页面」读起来一样
	contexts.set(pointId, Object.keys(next).length > 0 ? next : null);
	// 插件订阅这个点后重读 getContext
	emitPoint(pointId);
	// 结束 publishPointContext
}

// 插件读当前页上下文。返回副本，插件改返回值不会改到内存里的那份
export function readContext(pointId: string): Record<string, unknown> | null {
	// 没发布过或已清空时是 null
	const row = contexts.get(pointId);
	// 有值就浅拷贝。没值返回 null，不返回空对象，方便插件判断页面还没准备好
	return row ? { ...row } : null;
	// 结束 readContext
}

// 读某个已打开槽的载荷，同样返回副本
export function readPayload(
	// 词卡载荷在 english.vocab.card 上，不在词库点上
	pointId: string,
	// 抽屉槽名，例如 drawer、import-drawer
	slot: string,
	// 槽没开过，或已经关掉时，是 null
): Record<string, unknown> | null {
	// readSlot 对空槽返回冻结的 EMPTY，其 payload 就是 null
	const payload = readSlot(pointId, slot).payload;
	// 浅拷贝，插件改词字段不会写回会话
	return payload ? { ...payload } : null;
	// 结束 readPayload
}

// 读顶栏统计。关抽屉不影响这里，只有 publishSignal 会改它
export function readStats(
	// 目前只有单词库声明了 stats
	pointId: string,
	// 还没写过，或插件用 null 作废后，返回 null
): { total: number; loaded: number } | null {
	// 直接取这个点的一份，不和别的点加总
	const row = statsByPoint.get(pointId);
	// 副本给顶栏用，调用方改 total 不会改到 Map 里的数字
	return row ? { ...row } : null;
	// 结束 readStats
}

// 词卡按钮问自己转不转：同一个词上两个插件的进行中互不影响
export function isPointPending(
	// 哪个扩展点，单词卡和单词库的进行中不混用
	pointId: string,
	// 哪一个插件。别的插件把同一词标成进行中时，这个按钮不转
	pluginId: string,
	// 词条原文。Apple 和 apple 会收成同一个键
	word: string,
	// 只有显式写过 true 才算进行中，没记录过的词是 false
): boolean {
	// \0 隔开三段，避免点 id 和插件 id 粘连后撞键
	return pending.get(`${pointId}\0${pluginId}\0${lemmaKey(word)}`) === true;
	// 结束 isPointPending
}

// 插件把主站要画的状态写回来。目录里没声明的信号名直接丢掉
export function publishSignal(
	// 信号只属于这一个扩展点
	pointId: string,
	// 目前只认 pending 和 stats，名字必须写在该点的 signals 里
	name: string,
	// pending 是 { pluginId, key, on }，stats 是 { total, loaded } 或 null
	value: unknown,
): void {
	// 未登记的点没有信号表，后面连目录都对不上
	const spec = getHostPoint(pointId);
	// 错题集这类空信号表，或插件自造的名字，都不写入、也不通知界面
	if (!spec?.signals.includes(name as 'pending' | 'stats')) return;
	// 词库顶栏的总数和已加载数。坏数字不能盖掉上一份好数字
	if (name === 'stats') {
		// null 表示插件声明这份统计作废，顶栏回到没有数字
		if (value == null) {
			// 本来就没有统计时不再通知，避免订阅方空转重绘
			if (statsByPoint.get(pointId) == null) return;
			// 清掉上一份，readStats 随后返回 null
			statsByPoint.set(pointId, null);
			// 通知词库顶栏和其它订阅了信号的界面
			emitSignals();
			// 清空到此结束，不再往下按数字解析
			return;
			// 结束「值为 null」这一支
		}
		// 只取 total / loaded，插件多传的字段不进顶栏
		const row = value as { total?: unknown; loaded?: unknown };
		// 字符串数字也能用；缺字段会变成 NaN，下一行丢掉
		const total = Number(row.total);
		// 已加载条数单独转，两个里有一个非法就整份不写
		const loaded = Number(row.loaded);
		// NaN、Infinity 不覆盖上一份有效统计
		if (!Number.isFinite(total) || !Number.isFinite(loaded)) return;
		// 顶栏只显示非负整数
		statsByPoint.set(pointId, {
			// 3.2 收成 3，负数收成 0
			total: Math.max(0, Math.floor(total)),
			// 已加载条数同样不出现小数和负数
			loaded: Math.max(0, Math.floor(loaded)),
			// 结束这一份统计
		});
		// 数字变了才走到这里，让顶栏重读 readStats
		emitSignals();
		// stats 处理完就返回，避免把统计对象再当成 pending
		return;
		// 结束 stats 分支
	}
	// 剩下的登记信号是 pending：哪个插件的哪个词正在转
	const row = value as { pluginId?: unknown; key?: unknown; on?: unknown };
	// 缺插件 id 或缺词时无法分开两枚按钮，整条丢掉
	if (typeof row.pluginId !== 'string' || typeof row.key !== 'string') return;
	// on 必须是布尔。省略或传 1 不算开始转圈
	if (typeof row.on !== 'boolean') return;
	// 和 isPointPending 用同一把键，大小写和多余空格先收平
	const id = `${pointId}\0${row.pluginId}\0${lemmaKey(row.key)}`;
	// 重复写同一个 true/false 不通知，按钮不会因此再渲染一次
	if (pending.get(id) === row.on) return;
	// 关抽屉不清这张表，转圈状态跟按钮走，不跟抽屉开关走
	pending.set(id, row.on);
	// 词卡按钮靠这次通知改 Spinner
	emitSignals();
	// 结束 publishSignal
}

// 主站在启动时把 play、openCard 这类实现挂上。插件只能按目录里的名字调用
export function bindPointCommand(
	// 命令跟扩展点走，词卡的 play 不会出现在词库上
	pointId: string,
	// 目录 commands 里的名字，例如 play、stop、pickJsonFile、openCard
	name: string,
	// 插件传来的参数原样交给实现，由实现自己校验
	fn: (arg: unknown) => unknown,
	// 返回解绑函数，供重复注册时撤掉上一次
): () => void {
	// 同一个点的不同命令靠这个键分开
	const key = `${pointId}:${name}`;
	// 后注册的同名命令盖住先注册的
	commands.set(key, fn);
	// 调用方在清理时执行这个函数
	return () => {
		// 只删掉自己挂上的那一个。期间若已换成新函数，旧清理不能把新的删掉
		if (commands.get(key) === fn) commands.delete(key);
		// 结束解绑
	};
	// 结束 bindPointCommand
}

// api.modules.point.command 用它找到实现；没有绑定时由调用方抛 POINT_COMMAND_UNBOUND
export function getPointCommand(
	// 与 bindPointCommand 的点 id 必须一致
	pointId: string,
	// 插件传入的命令名。目录没声明的名字在 api 层就被拒绝，到不了这里
	name: string,
	// 没人 bind 过时是 undefined
): ((arg: unknown) => unknown) | undefined {
	// 键和注册时一致，取不到就表示这条命令还没有实现
	return commands.get(`${pointId}:${name}`);
	// 结束 getPointCommand
}
