/* global ePub */
(function () {
	const qs = new URLSearchParams(location.search);
	const apiBase = qs.get('apiBase') || '';
	const token = qs.get('token') || '';
	const bookId = qs.get('bookId') || '';
	const fileUrl = qs.get('fileUrl') || '';
	const mode = qs.get('mode') || 'read';
	const spineIndexParam = qs.get('spineIndex');
	const initialCfi = qs.get('cfi') || '';
	const bookTitle = qs.get('bookTitle') || '';
	if (bookTitle) document.title = bookTitle;

	let book = null;
	let rendition = null;
	let highlights = [];
	let thoughts = [];
	let pendingSelection = null;
	let flatToc = [];
	let activePanel = '';
	const settings = { fontSize: 100, lineHeight: 1.6, theme: 'light' };

	const THEME_STYLES = {
		light: { bg: '#ffffff', color: '#222222' },
		sepia: { bg: '#f4ecd8', color: '#5b4636' },
		dark: { bg: '#1a1a1a', color: '#dddddd' },
	};

	const chromeEl = document.getElementById('reader-chrome');
	const listenFab = document.getElementById('listen-fab');
	const chromeBook = document.getElementById('chrome-book');
	const chromeChapter = document.getElementById('chrome-chapter');
	const subpanelFont = document.getElementById('chrome-subpanel-font');
	const subpanelTheme = document.getElementById('chrome-subpanel-theme');
	const fontSizeLabel = document.getElementById('font-size-label');
	const lineHeightInput = document.getElementById('line-height');

	if (bookTitle) chromeBook.textContent = bookTitle;

	if (mode === 'extractText') {
		listenFab.classList.add('hidden');
		chromeEl.classList.add('hidden');
	}

	function resolveEpubFactory() {
		if (typeof window !== 'undefined' && typeof window.ePub === 'function') {
			return window.ePub;
		}
		if (typeof ePub === 'function') {
			return ePub;
		}
		throw new Error('ePub is not defined');
	}

	function postToMp(payload) {
		try {
			if (window.wx && wx.miniProgram) {
				wx.miniProgram.postMessage({ data: payload });
			}
		} catch (_) {
			/* ponytail: web-view 消息仅在特定时机送达 */
		}
		if (window.parent !== window) {
			window.parent.postMessage(payload, '*');
		}
	}

	function apiFetch(path, options) {
		const headers = Object.assign(
			{ Authorization: 'Bearer ' + token },
			(options && options.headers) || {},
		);
		return fetch(apiBase + path, Object.assign({}, options, { headers }));
	}

	function isChromeVisible() {
		return chromeEl && !chromeEl.classList.contains('hidden');
	}

	function setActivePanel(panel) {
		activePanel = panel;
		subpanelFont.classList.toggle('hidden', panel !== 'font');
		subpanelTheme.classList.toggle('hidden', panel !== 'theme');
	}

	function showChrome() {
		chromeEl.classList.remove('hidden');
		if (mode !== 'extractText') listenFab.classList.remove('hidden');
	}

	function hideChrome() {
		chromeEl.classList.add('hidden');
		setActivePanel('');
		listenFab.classList.add('hidden');
	}

	function toggleChrome() {
		if (isChromeVisible()) {
			if (activePanel) {
				setActivePanel('');
				return;
			}
			hideChrome();
		} else {
			showChrome();
		}
	}

	function applyTheme() {
		document.body.className = 'theme-' + settings.theme;
		fontSizeLabel.textContent = settings.fontSize + '%';
		lineHeightInput.value = String(Math.round(settings.lineHeight * 100));
		document.querySelectorAll('.theme-dot').forEach(function (btn) {
			btn.classList.toggle(
				'active',
				btn.getAttribute('data-theme') === settings.theme,
			);
		});
		if (!rendition) return;
		const t = THEME_STYLES[settings.theme] || THEME_STYLES.light;
		rendition.themes.default({
			html: {
				margin: '0 !important',
				padding: '0 !important',
				background: t.bg + ' !important',
			},
			body: {
				color: t.color + ' !important',
				background: t.bg + ' !important',
				'font-size': settings.fontSize + '% !important',
				'line-height': String(settings.lineHeight) + ' !important',
				margin: '0 !important',
				padding: '0 12px !important',
				'max-width': '100% !important',
			},
			'p, div, section, article': {
				'max-width': '100% !important',
			},
		});
	}

	function fitViewerSize() {
		if (!rendition) return;
		const el = document.getElementById('viewer');
		if (!el) return;
		const w = Math.max(
			el.clientWidth,
			document.documentElement.clientWidth,
			window.innerWidth || 0,
		);
		const h = Math.max(el.clientHeight, window.innerHeight || 0);
		rendition.resize(w, h);
	}

	function flattenToc(items, level) {
		let out = [];
		(items || []).forEach(function (item) {
			out.push({ label: item.label, href: item.href, level: level || 0 });
			if (item.subitems && item.subitems.length) {
				out = out.concat(flattenToc(item.subitems, (level || 0) + 1));
			}
		});
		return out;
	}

	function chapterLabelForHref(href) {
		if (!href) return '';
		const item = flatToc.find(function (t) {
			return t.href === href || href.endsWith(t.href) || t.href.endsWith(href);
		});
		return item ? item.label : '';
	}

	function updateChromeChapter(loc) {
		const href = loc && loc.start ? loc.start.href : '';
		const label = chapterLabelForHref(href);
		chromeChapter.textContent = label || '阅读中';
	}

	function closeToc() {
		document.getElementById('toc-shell').classList.add('hidden');
	}

	function openToc() {
		document.getElementById('toc-shell').classList.remove('hidden');
		setActivePanel('');
	}

	function renderToc(toc) {
		flatToc = flattenToc(toc);
		const list = document.getElementById('toc-list');
		list.innerHTML = '';
		flatToc.forEach(function (item) {
			const li = document.createElement('li');
			li.textContent = item.label;
			li.className = 'indent-' + Math.min(item.level, 2);
			li.onclick = function () {
				rendition.display(item.href);
				closeToc();
				hideChrome();
			};
			list.appendChild(li);
		});
	}

	function applyMarks() {
		if (!rendition) return;
		rendition.annotations.clear('hl');
		rendition.annotations.clear('thought');
		highlights.forEach(function (h) {
			rendition.annotations.highlight(h.cfiRange, {}, function () { }, 'hl', {
				fill: colorFill(h.color),
				'fill-opacity': '0.35',
			});
		});
		thoughts.forEach(function (t) {
			rendition.annotations.underline(
				t.cfiRange,
				{},
				function () { },
				'thought',
			);
		});
	}

	function colorFill(color) {
		const map = {
			pink: '#ff6b81',
			purple: '#9b59b6',
			blue: '#78bfff',
			green: '#96c24e',
			yellow: '#ffdc6a',
		};
		return map[color] || color || '#ffdc6a';
	}

	async function loadMarks() {
		const [hlRes, thRes] = await Promise.all([
			apiFetch('/ebook/highlights/' + bookId),
			apiFetch('/ebook/thoughts/' + bookId),
		]);
		const hlJson = await hlRes.json();
		const thJson = await thRes.json();
		highlights = hlJson.data || hlJson || [];
		thoughts = thJson.data || thJson || [];
		applyMarks();
	}

	async function loadBookBuffer() {
		const cached = await idbGet(bookId);
		if (cached) return cached;
		const res = await fetch(fileUrl, {
			headers: { Authorization: 'Bearer ' + token },
		});
		if (!res.ok) throw new Error('HTTP ' + res.status);
		const buf = await res.arrayBuffer();
		idbPut(bookId, buf).catch(function () { });
		return buf;
	}

	function idbOpen() {
		return new Promise(function (resolve, reject) {
			const req = indexedDB.open('epub-cache', 1);
			req.onupgradeneeded = function () {
				req.result.createObjectStore('books');
			};
			req.onsuccess = function () {
				resolve(req.result);
			};
			req.onerror = function () {
				reject(req.error);
			};
		});
	}

	function idbGet(key) {
		return idbOpen()
			.then(function (db) {
				return new Promise(function (resolve) {
					const tx = db.transaction('books', 'readonly');
					const req = tx.objectStore('books').get(key);
					req.onsuccess = function () {
						resolve(req.result || null);
					};
					req.onerror = function () {
						resolve(null);
					};
				});
			})
			.catch(function () {
				return null;
			});
	}

	function idbPut(key, buf) {
		return idbOpen().then(function (db) {
			return new Promise(function (resolve, reject) {
				const tx = db.transaction('books', 'readwrite');
				tx.objectStore('books').put(buf, key);
				tx.oncomplete = function () {
					resolve();
				};
				tx.onerror = function () {
					reject(tx.error);
				};
			});
		});
	}

	function bindContentTap(contents) {
		if (mode === 'extractText') return;
		const doc = contents.document;
		doc.addEventListener('click', function () {
			if (
				!document.getElementById('selection-bar').classList.contains('hidden')
			) {
				return;
			}
			const sel = contents.window.getSelection();
			if (sel && !sel.isCollapsed && sel.toString().trim()) return;
			toggleChrome();
		});
	}

	async function openBook() {
		const buf = await loadBookBuffer();
		book = resolveEpubFactory()(buf, {
			openAs: 'binary',
			replacements: 'blobUrl',
		});
		await book.ready;
		const el = document.getElementById('viewer');
		const w = Math.max(
			el.clientWidth,
			document.documentElement.clientWidth,
			window.innerWidth || 320,
		);
		const h = Math.max(el.clientHeight, window.innerHeight || 480);
		rendition = book.renderTo('viewer', {
			width: w,
			height: h,
			flow: 'scrolled',
			manager: 'continuous',
			spread: 'none',
			allowScriptedContent: true,
		});
		applyTheme();
		rendition.on('relocated', function (loc) {
			const cfi = loc.start.cfi;
			const percent = Math.round((loc.start.percentage || 0) * 100);
			const spineIndex = loc.start.index;
			updateChromeChapter(loc);
			postToMp({
				type: 'locationChanged',
				cfi: cfi,
				percent: percent,
				spineIndex: spineIndex,
			});
			apiFetch('/ebook/progress', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bookId: bookId,
					epubCfi: cfi,
					percent: percent,
				}),
			}).catch(function () { });
		});
		rendition.hooks.content.register(function (contents) {
			contents.document.addEventListener('mouseup', onSelection);
			contents.document.addEventListener('touchend', onSelection);
			bindContentTap(contents);
			try {
				const doc = contents.document;
				const style = doc.createElement('style');
				style.textContent =
					'html,body{margin:0!important;padding:0 12px!important;max-width:100%!important;box-sizing:border-box!important}' +
					'body *{max-width:100%!important;box-sizing:border-box!important}';
				(doc.head || doc.documentElement).appendChild(style);
			} catch (_) {
				/* ponytail: 部分章节无 head 时忽略 */
			}
		});
		await rendition.display(
			initialCfi ||
			(mode === 'read' && spineIndexParam != null
				? Number(spineIndexParam)
				: undefined),
		);
		renderToc(book.navigation.toc);
		postToMp({
			type: 'bookReady',
			toc: book.navigation.toc,
			spineCount: book.spine.length,
		});
		await loadMarks();
		fitViewerSize();
		window.addEventListener('resize', fitViewerSize);
		if (mode === 'extractText' && spineIndexParam != null) {
			extractChapterText(Number(spineIndexParam));
		}
	}

	function onSelection() {
		const sel =
			rendition &&
			rendition.getContents()[0] &&
			rendition.getContents()[0].window.getSelection();
		if (!sel || sel.isCollapsed) {
			document.getElementById('selection-bar').classList.add('hidden');
			return;
		}
		const range = sel.getRangeAt(0);
		const text = sel.toString().trim();
		if (!text) return;
		const cfiRange = rendition.getContents()[0].cfiFromRange(range);
		pendingSelection = { cfiRange: cfiRange, text: text };
		hideChrome();
		document.getElementById('selection-bar').classList.remove('hidden');
		postToMp({
			type: 'selection',
			cfiRange: cfiRange,
			text: text,
			rect: range.getBoundingClientRect(),
		});
	}

	async function saveHighlight(style, color) {
		if (!pendingSelection) return;
		const body = {
			bookId: bookId,
			cfiRange: pendingSelection.cfiRange,
			quote: pendingSelection.text,
			style: style,
			color: color,
		};
		const res = await apiFetch('/ebook/highlights', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
		const json = await res.json();
		highlights.push(json.data || json);
		applyMarks();
		document.getElementById('selection-bar').classList.add('hidden');
	}

	async function saveThought(content, isPublic) {
		if (!pendingSelection) return;
		const body = {
			bookId: bookId,
			cfiRange: pendingSelection.cfiRange,
			quote: pendingSelection.text,
			content: content,
			isPublic: isPublic,
		};
		const res = await apiFetch('/ebook/thoughts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
		const json = await res.json();
		thoughts.push(json.data || json);
		applyMarks();
		document.getElementById('thought-dialog').classList.add('hidden');
		document.getElementById('selection-bar').classList.add('hidden');
	}

	function extractChapterText(spineIndex) {
		if (!book || !rendition) return;
		rendition.display(spineIndex).then(function () {
			setTimeout(function () {
				const doc = rendition.getContents()[0].document;
				const plain = (doc.body.innerText || '').trim();
				const sentences = plain
					.split(/(?<=[。！？.!?])\s*/)
					.filter(Boolean)
					.map(function (s, i) {
						return { text: s, index: i };
					});
				postToMp({
					type: 'chapterText',
					spineIndex: spineIndex,
					text: plain,
					sentences: sentences,
				});
			}, 500);
		});
	}

	function goPrevChapter() {
		if (!rendition) return;
		const loc = rendition.currentLocation();
		const idx = loc?.start ? loc.start.index : 0;
		if (idx <= 0) return;
		rendition.display(idx - 1);
	}

	function goNextChapter() {
		if (!rendition || !book) return;
		const loc = rendition.currentLocation();
		const idx = loc?.start ? loc.start.index : 0;
		if (idx >= book.spine.length - 1) return;
		rendition.display(idx + 1);
	}

	function closeMoreSheet() {
		document.getElementById('more-sheet').classList.add('hidden');
	}

	function openMoreSheet() {
		document.getElementById('more-sheet').classList.remove('hidden');
		setActivePanel('');
	}

	document.getElementById('chrome-mask').onclick = hideChrome;

	document.querySelector('.chrome-bar').addEventListener('click', function (e) {
		const btn = e.target.closest('[data-action]');
		if (!btn) return;
		const action = btn.getAttribute('data-action');
		if (action === 'toc') {
			openToc();
		} else if (action === 'font') {
			setActivePanel(activePanel === 'font' ? '' : 'font');
		} else if (action === 'theme') {
			setActivePanel(activePanel === 'theme' ? '' : 'theme');
		} else if (action === 'more') {
			openMoreSheet();
		}
	});

	document.getElementById('toc-overlay').onclick = closeToc;
	document.getElementById('btn-toc-close').onclick = closeToc;

	document.getElementById('font-dec').onclick = function () {
		settings.fontSize = Math.max(80, settings.fontSize - 10);
		applyTheme();
	};
	document.getElementById('font-inc').onclick = function () {
		settings.fontSize = Math.min(160, settings.fontSize + 10);
		applyTheme();
	};
	lineHeightInput.oninput = function (e) {
		settings.lineHeight = Number(e.target.value) / 100;
		applyTheme();
	};
	document.querySelectorAll('.theme-dot').forEach(function (btn) {
		btn.onclick = function () {
			settings.theme = btn.getAttribute('data-theme');
			applyTheme();
		};
	});

	document.getElementById('more-sheet').addEventListener('click', function (e) {
		if (e.target === e.currentTarget) {
			closeMoreSheet();
			return;
		}
		const btn = e.target.closest('[data-more]');
		if (!btn) return;
		const action = btn.getAttribute('data-more');
		closeMoreSheet();
		hideChrome();
		if (action === 'prev') goPrevChapter();
		else if (action === 'next') goNextChapter();
		else if (action === 'native' && wx && wx.miniProgram) {
			wx.miniProgram.redirectTo({
				url:
					'/packages/epub-reader/pages/reader/index?bookId=' +
					bookId +
					'&mode=native',
			});
		}
	});
	document.getElementById('more-cancel').onclick = closeMoreSheet;

	listenFab.onclick = function () {
		const spineIndex = rendition ? rendition.currentLocation().start.index : 0;
		postToMp({
			type: 'listenRequest',
			bookId: bookId,
			spineIndex: spineIndex,
		});
		if (wx && wx.miniProgram) {
			wx.miniProgram.navigateTo({
				url:
					'/packages/epub-reader/pages/listen/index?bookId=' +
					bookId +
					'&spineIndex=' +
					spineIndex,
			});
		}
	};

	document
		.getElementById('selection-bar')
		.addEventListener('click', function (e) {
			const btn = e.target.closest('button');
			if (!btn) return;
			const action = btn.getAttribute('data-action');
			if (action === 'highlight')
				saveHighlight('highlight', btn.getAttribute('data-color'));
			else if (action === 'underline')
				saveHighlight('underline', btn.getAttribute('data-color'));
			else if (action === 'wavy')
				saveHighlight('wavy', btn.getAttribute('data-color'));
			else if (action === 'thought')
				document.getElementById('thought-dialog').classList.remove('hidden');
			else if (action === 'listen') listenFab.onclick();
		});
	document.getElementById('thought-cancel').onclick = function () {
		document.getElementById('thought-dialog').classList.add('hidden');
	};
	document.getElementById('thought-save').onclick = function () {
		const content = document.getElementById('thought-input').value.trim();
		const isPublic = document.getElementById('thought-public').checked;
		if (content) saveThought(content, isPublic);
	};

	if (fileUrl && bookId) {
		openBook().catch(function (err) {
			document.getElementById('viewer').textContent =
				'加载失败: ' + (err.message || err);
		});
	}
})();
