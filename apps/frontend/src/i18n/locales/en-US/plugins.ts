/** en-US · plugins */
export const plugins = {
	'plugins.card.enter': 'Open',
	'plugins.card.entry': 'Entry',
	'plugins.card.noDesc': 'No description',
	'plugins.card.route': 'Route',
	'plugins.card.sidebar': 'Sidebar',
	'plugins.card.sidebar.off': 'No',
	'plugins.card.sidebar.on': 'Yes',
	'plugins.card.trust': 'Trust',
	'plugins.card.trust.first-party': 'official',
	'plugins.card.trust.partner': 'partner',
	'plugins.card.trust.untrusted': 'untrusted',
	'plugins.host.delisted': 'This plugin is delisted. Re-list it from Plugins.',
	'plugins.host.loadFailed': 'Failed to load plugin "{id}"',
	'plugins.host.loading': 'Loading…',
	'plugins.host.loadingNamed': 'Loading plugin "{id}"…',
	'plugins.host.missingIframeUrl':
		'Plugin "{id}" is untrusted but iframeUrl is missing',
	'plugins.host.notLoaded': 'Not loaded (start the Remote and retry)',
	'plugins.host.reload': 'Reload',
	'plugins.host.unavailable': 'Plugin "{id}" is unavailable',
	'plugins.page.desc':
		'All off by default. Disabling stops host load and hides entry points',
	'plugins.page.editRegistry': 'Edit config',
	'plugins.page.empty': 'No plugins (check that the registry is reachable)',
	'plugins.page.empty.app': 'No apps (standalone route injection)',
	'plugins.page.empty.plugin': 'No plugins (embedded / surface slot)',
	'plugins.page.tab.app': 'Apps',
	'plugins.page.tab.plugin': 'Plugins',
	'plugins.page.tabsAria': 'Plugins and apps',
	'plugins.registry.back': 'Back to Plugins',
	'plugins.registry.help.description':
		'Localized blurb, or a legacy plain string; shown on plugin cards.',
	'plugins.registry.help.enabled':
		'Catalog default (now false). Actual shelf state is per-account on the server (Web/desktop sync) and is not written back here.',
	'plugins.registry.help.entry':
		'MF entry URL (prefer mf-manifest.json). Production requires https; localhost http is allowed in dev.',
	'plugins.registry.help.expose':
		'MF expose path; default ./App (e.g. ./LearningNotes, ./EbookIdeas).',
	'plugins.registry.help.fieldTitle':
		'Localized name map (zh-CN / en-US) for the plugins page and breadcrumbs.',
	'plugins.registry.help.footnote':
		'Bump version only for cache bust. hostApiRange must cover the current Host API (see VITE_HOST_API_VERSION).',
	'plugins.registry.help.framework':
		'Optional react | vue. For vue, Remote must export mount(el, bridge); Host has no Vue and only calls mount.',
	'plugins.registry.help.host':
		'Auto-mount on a host surface: surface (e.g. ebook.read), slot (drawer/toolbar), icon (SVG URL), order.',
	'plugins.registry.help.hostApiRange':
		'Required Host API range (e.g. ^1.0.0). Must cover the current Host; change only when the Host contract upgrades.',
	'plugins.registry.help.id':
		'Unique plugin id used for routes, sidebar, and local state.',
	'plugins.registry.help.iframeUrl':
		'Required when trust is untrusted: standalone HTTPS page opened in an iframe.',
	'plugins.registry.help.injectRoute':
		'Whether PluginManager injects a top-level route. false means the host tree already mounts PluginHostPage; true without menu = route only, no sidebar.',
	'plugins.registry.help.integrity':
		'Optional sha384 integrity hash for the entry resource.',
	'plugins.registry.help.menu':
		'Sidebar entry (optional): present → inject sidebar; omit → route/embed only, no left-nav item. order; icon is an SVG image URL.',
	'plugins.registry.help.panelTitle': 'plugins-registry field reference',
	'plugins.registry.help.permissions':
		'Permission list, e.g. ui:toast, nav:subtree, http:plugin-api, modules:ebook.',
	'plugins.registry.help.plugins':
		'Array of plugin descriptors; each item is one listable plugin.',
	'plugins.registry.help.preload':
		'Load timing: route/idle (lazy, default) or eager (background preload after init; rarely needed).',
	'plugins.registry.help.remoteName':
		'MF registerRemotes.name; defaults to id. Use the federation name when multiple plugins share one Remote.',
	'plugins.registry.help.routePath':
		'Plugin route path, e.g. /english-learning/notes.',
	'plugins.registry.help.sectionBasic': 'Plugin basics',
	'plugins.registry.help.sectionHost': 'Mount & security',
	'plugins.registry.help.sectionMf': 'Load & permissions',
	'plugins.registry.help.sectionRoot': 'Root',
	'plugins.registry.help.signature':
		'Optional signature flag; loading is rejected when set to invalid.',
	'plugins.registry.help.trust':
		'Trust level: first-party / partner / untrusted (iframe only, no loadRemote).',
	'plugins.registry.help.updatedAt':
		'Last updated time; written automatically by the host on save.',
	'plugins.registry.help.version':
		'Plugin package version. Bump this for releases / cache bust; do not confuse with hostApiRange.',
	'plugins.registry.hostApiIncompatible':
		'Plugin {id}: hostApiRange "{range}" is incompatible with Host API {hostApi}. Bump version only for cache bust; keep hostApiRange as ^{hostApi}',
	'plugins.registry.iconNoTarget':
		'Plugin has no menu / host; cannot write icon',
	'plugins.registry.iconPickPlugin': 'Select plugin',
	'plugins.registry.iconSvgOnly': 'Only SVG files are supported',
	'plugins.registry.iconUpload': 'Upload & write',
	'plugins.registry.iconUploadFail': 'Icon upload failed',
	'plugins.registry.iconUploading': 'Uploading…',
	'plugins.registry.iconUploadLabel': 'Set plugin icon',
	'plugins.registry.iconUploadOk': 'SVG icon uploaded and written to registry',
	'plugins.registry.invalidJson':
		'Invalid JSON: must parse and include a plugins array',
	'plugins.registry.missingHostApiRange': 'Plugin {id} is missing hostApiRange',
	'plugins.registry.noChanges': 'No changes, no need to save',
	'plugins.registry.pluginNotFound': 'Plugin {id} not found in registry',
	'plugins.registry.save': 'Save to server',
	'plugins.registry.saveOk': 'Saved to remotes',
	'plugins.registry.saving': 'Saving…',
	'plugins.registry.title': 'Plugin registry',
	'plugins.shelf.off': 'Delisted',
	'plugins.shelf.on': 'Listed',
	'plugins.shelf.toggle': 'List / delist',
	'plugins.verify.hostApiIncompatible':
		'Plugin {id}: Host API is {hostApi}, incompatible with hostApiRange "{range}". Bump version only for cache bust; change hostApiRange only when the Host contract upgrades',
};
