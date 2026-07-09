(function (global) {
	if (!global.__epubCjs) return;
	global.module = global.__epubCjs.module;
	global.exports = global.__epubCjs.exports;
	global.require = global.__epubCjs.require;
	delete global.__epubCjs;
})(typeof globalThis !== 'undefined' ? globalThis : window);
