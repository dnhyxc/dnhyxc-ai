import type { HostPointSpec } from './catalog';
import {
	getPointCommand,
	publishSignal,
	readContext,
	readPayload,
	subscribePoint,
} from './session';

/** 一个插件只拿到它自己 surface 上的那一个点。 */
export function createPointApi(spec: HostPointSpec) {
	return Object.freeze({
		// 只读这个点的页面上下文。目录没声明的键已被裁掉，页面离开后是 null
		getContext: () => readContext(spec.id),
		// 只读这个点上某个已打开槽的载荷。槽名由插件传入，槽没开是 null
		getPayload: (slot: string) => readPayload(spec.id, slot),
		// 上下文变了，或这个点任意槽开关时调用 listener。回写信号不会进来
		subscribe: (listener: () => void) => subscribePoint(spec.id, listener),
		// 把外壳要画的状态写回这个点。名字必须是目录里声明的信号
		publishSignal: (name: string, value: unknown) =>
			// 未声明的名字在 session 里直接丢掉，不会通知界面
			publishSignal(spec.id, name, value),
		// 第二个参数必须传。插件没有参数时传 undefined，漏传会在类型检查阶段失败
		command: (name: string, arg: unknown) => {
			// 目录没声明的命令不往下找实现，避免插件调到别的点的能力
			if (!spec.commands.includes(name))
				throw new Error('UNKNOWN_POINT_COMMAND');
			// 目录有名字，但当前页面还没 bind，或离开页面后已经解绑
			const fn = getPointCommand(spec.id, name);
			// 和「名字不存在」分开抛，插件能区分写错命令和页面还没挂上
			if (!fn) throw new Error('POINT_COMMAND_UNBOUND');
			// 参数原样交给页面注册的实现，返回值也原样交回插件
			return fn(arg);
		},
	});
}
