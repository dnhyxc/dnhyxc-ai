/** remote-plugins copy (English) */
const enUS: Record<string, string> = {
	'common.confirm': 'Confirm',
	'common.cancel': 'Cancel',
	'common.untitledNote': 'Untitled note',
	'common.emptyContent': 'No content',
	'common.requestFailed': 'Request failed',
	'common.loading': 'Loading…',
	'common.loadingMore': 'Loading more…',
	'common.noMore': 'No more',
	'common.allLoaded': 'All loaded',
	'common.loadedCount': 'Loaded {loaded} / {total}',
	'common.toggleLanguage': 'Toggle language',
	'common.connectingHost': 'Connecting to host…',

	'layout.brand': 'remote-plugins',
	'layout.home': 'Home',
	'layout.learningNotes': 'Learning notes',
	'layout.ideasList': 'EPUB ideas',
	'layout.ebookHighlights': 'All highlights',
	'layout.ebookTestBookInfo': 'Book info test',
	'layout.previewHint': 'Standalone preview · :9008',

	'home.title': 'Plugin standalone preview',
	'home.desc':
		'Routes mirror the host app for local preview; embedding still uses MF loadRemote.',
	'home.learningNotes.title': 'Learning notes',
	'home.learningNotes.desc': 'expose ./LearningNotes · registry learningNotes',
	'home.ideasList.title': 'EPUB ideas list',
	'home.ideasList.desc': 'expose ./EbookIdeas · registry ebookIdeas',
	'home.ebookHighlights.title': 'All highlights',
	'home.ebookHighlights.desc':
		'expose ./EbookHighlights · registry ebookHighlights',
	'home.ebookTestBookInfo.title': 'Book info test',
	'home.ebookTestBookInfo.desc':
		'expose ./EbookTestBookInfo · registry ebookTestBookInfo',

	'learningNotes.listTitle': 'Notes',
	'learningNotes.titleBadge': 'Note title',
	'learningNotes.empty': 'No notes yet — save one to get started',
	'learningNotes.placeholder':
		'Capture words, grammar, or speaking notes for today…',
	'learningNotes.new': 'New note',
	'learningNotes.edit': 'Edit',
	'learningNotes.preview': 'Details',
	'learningNotes.delete': 'Delete',
	'learningNotes.exportDocx': 'Export Word',
	'learningNotes.exportingDocx': 'Exporting…',
	'learningNotes.saving': 'Saving…',
	'learningNotes.save': 'Save note ⌘S',
	'learningNotes.update': 'Update note ⌘S',
	'learningNotes.openList': 'Open notes list',
	'learningNotes.closeList': 'Close notes list',
	'learningNotes.scrollBottom': 'Scroll to bottom',
	'learningNotes.scrollTop': 'Scroll to top',
	'learningNotes.scrollCurrent': 'Scroll to selection',
	'learningNotes.deleteConfirmTitle': 'Delete this note?',
	'learningNotes.deleteConfirmDesc': 'This cannot be undone',
	'learningNotes.toast.needTitle': 'Please enter a title',
	'learningNotes.toast.needContent': 'Please enter some content',
	'learningNotes.toast.httpDeniedSync':
		'HTTP not authorized — cannot sync notes',
	'learningNotes.toast.httpDeniedSave': 'HTTP not authorized — cannot save',
	'learningNotes.toast.saved': 'Note saved',
	'learningNotes.toast.noSave':
		'The content has not been modified and does not require updating',
	'learningNotes.toast.updated': 'Note updated',
	'learningNotes.toast.deleted': 'Deleted',
	'learningNotes.toast.exportEmpty': 'Open a note before exporting',
	'learningNotes.toast.httpDeniedExport': 'HTTP not authorized — cannot export',
	'learningNotes.toast.exportOk': 'Word download started',
	'learningNotes.toast.exportFail': 'Export failed',
	'learningNotes.toast.exportNoDownload': 'Download is unavailable here',
	'learningNotes.toast.exportInvalid': 'Invalid export file',

	'ideasList.unboundBook': 'No book bound',
	'ideasList.empty': 'No ideas yet',
	'ideasList.noBody': '(No body)',

	'highlightsList.unboundBook': 'No book bound',
	'highlightsList.empty': 'No highlights yet',
	'highlightsList.noQuote': '(No quote)',
	'highlightsList.style.highlight': 'Highlight',
	'highlightsList.style.underline': 'Underline',
	'highlightsList.style.wavy': 'Wavy',

	'ebookTest.bookInfo.blurb':
		'Host toolbar-slot test: inline book info in the reader header.',
	'ebookTest.bookInfo.bookId': 'bookId',
	'ebookTest.bookInfo.bookTitle': 'bookTitle',
	'ebookTest.bookInfo.unbound': '(unbound)',
	'ebookTest.bookInfo.ping': 'Toast',
	'ebookTest.bookInfo.toastOk': 'Current book: {id}',
	'ebookTest.bookInfo.toastUnbound':
		'No book bound (common in standalone preview)',
};

export default enUS;
