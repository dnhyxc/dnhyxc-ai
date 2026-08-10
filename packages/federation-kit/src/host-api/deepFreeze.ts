/** 深度冻结，防止插件改写 Bridge 结构 */
export function deepFreeze<T>(value: T): T {
	if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
		return value;
	}
	for (const key of Reflect.ownKeys(value as object)) {
		const child = (value as Record<PropertyKey, unknown>)[key];
		if (child && typeof child === 'object') {
			deepFreeze(child);
		}
	}
	return Object.freeze(value);
}
