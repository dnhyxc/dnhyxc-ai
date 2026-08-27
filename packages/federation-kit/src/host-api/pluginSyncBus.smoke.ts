import assert from 'node:assert/strict';
import { createPluginSyncBus } from './pluginSyncBus';

type Msg = { type: 'ping'; windowId: string };

const published: Msg[] = [];
const bus = createPluginSyncBus<Msg>({
	channel: 'test-sync-bus',
	windowIdKey: 'test_window_id',
	transport: {
		publishGlobal: (_ch, msg) => {
			published.push(msg);
		},
	},
});

const wid = bus.getWindowId();
assert.ok(wid.length > 0);

let seen: Msg | null = null;
const off = bus.subscribe((msg) => {
	seen = msg;
});

bus.publish({ type: 'ping', windowId: wid });
assert.deepEqual(seen, { type: 'ping', windowId: wid });
assert.deepEqual(published, [{ type: 'ping', windowId: wid }]);

off();
console.info('[pluginSyncBus.smoke] ok');
