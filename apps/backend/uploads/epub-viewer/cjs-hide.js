(function (global) {
	// ponytail: 微信 web-view 注入 module/exports，UMD 会误走 CommonJS
	global.__epubCjs = {
		module: global.module,
		exports: global.exports,
		require: global.require,
	};
	try {
		delete global.module;
		delete global.exports;
		delete global.require;
	} catch (_) {
		global.module = undefined;
		global.exports = undefined;
		global.require = undefined;
	}
})(typeof globalThis !== 'undefined' ? globalThis : window);
