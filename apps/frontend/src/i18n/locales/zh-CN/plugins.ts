/** zh-CN · plugins */
export const plugins = {
	'plugins.card.enter': '进入',
	'plugins.card.entry': '入口',
	'plugins.card.noDesc': '暂无说明',
	'plugins.card.route': '路由',
	'plugins.card.sidebar': '侧栏',
	'plugins.card.sidebar.off': '无',
	'plugins.card.sidebar.on': '有',
	'plugins.card.trust': '信任',
	'plugins.card.trust.first-party': '官方',
	'plugins.card.trust.partner': '合作方',
	'plugins.card.trust.untrusted': '未信任',
	'plugins.host.delisted': '该插件已下架，可在「插件中心」重新上架。',
	'plugins.host.loadFailed': '插件「{id}」加载失败',
	'plugins.host.loading': '正在加载中...',
	'plugins.host.loadingNamed': '插件「{id}」正在加载中...',
	'plugins.host.missingIframeUrl': '插件「{id}」为 untrusted，但缺少 iframeUrl',
	'plugins.host.notLoaded': '未加载（请确认 Remote 已启动后重试）',
	'plugins.host.reload': '重新加载',
	'plugins.host.unavailable': '插件「{id}」不可用',
	'plugins.page.desc': '默认全部关闭，关闭后基座不再加载，相关入口也会隐藏',
	'plugins.page.editRegistry': '编辑配置',
	'plugins.page.empty': '暂无插件（请确认 registry 可访问）',
	'plugins.page.empty.app': '暂无应用（独立路由注入）',
	'plugins.page.empty.plugin': '暂无插件（业务内嵌 / surface 槽）',
	'plugins.page.tab.app': '应用',
	'plugins.page.tab.plugin': '插件',
	'plugins.page.tabsAria': '插件与应用',
	'plugins.registry.back': '返回插件中心',
	'plugins.registry.help.description':
		'多语言说明，或旧版单语字符串；插件中心卡片描述。',
	'plugins.registry.help.enabled':
		'目录建议默认值（现已默认 false）。实际上架/下架按账号保存在服务端（Web/桌面同步），不再写回此字段。',
	'plugins.registry.help.entry':
		'MF 入口 URL，优先 mf-manifest.json；生产须 https，开发可用 localhost。',
	'plugins.registry.help.expose':
		'MF expose 路径，默认 ./App；如 ./LearningNotes、./EbookIdeas。',
	'plugins.registry.help.fieldTitle':
		'多语言名称对象（zh-CN / en-US）；插件中心与面包屑展示。',
	'plugins.registry.help.footnote':
		'发版破缓存请只改 version；hostApiRange 须覆盖当前 Host API（见 VITE_HOST_API_VERSION）。',
	'plugins.registry.help.framework':
		'可选 react | vue。vue 时 Remote 须导出 mount(el, bridge)；Host 不装 Vue，仅调用 mount。',
	'plugins.registry.help.host':
		'业务页自动挂载：surface（如 ebook.read）、slot（drawer/toolbar）、icon（SVG URL）、order。',
	'plugins.registry.help.hostApiRange':
		'要求的 Host API 版本范围（如 ^1.0.0）。须覆盖当前 Host；仅 Host 契约升级时再改。',
	'plugins.registry.help.id': '插件唯一 ID；Host 用其挂路由/侧栏与本地状态。',
	'plugins.registry.help.iframeUrl':
		'trust 为 untrusted 时必填：独立 HTTPS 页，Host 用 iframe 打开。',
	'plugins.registry.help.injectRoute':
		'是否由 PluginManager 注入顶层路由。false 表示宿主业务树已挂好 PluginHostPage；true + 不写 menu = 仅路由、无侧栏。',
	'plugins.registry.help.integrity': '可选：entry 资源的 sha384 完整性校验。',
	'plugins.registry.help.menu':
		'侧栏入口（可选）：有则注入侧栏；省略则仅路由/内嵌，不出现在左侧菜单。order 排序；icon 为 SVG 图片 URL。',
	'plugins.registry.help.panelTitle': 'plugins-registry 字段说明',
	'plugins.registry.help.permissions':
		'权限声明，如 ui:toast、nav:subtree、http:plugin-api、modules:ebook。',
	'plugins.registry.help.plugins': '插件描述符数组；每一项对应一个可上架插件。',
	'plugins.registry.help.preload':
		'加载时机：route/idle（默认懒加载）或 eager（启动后后台预拉，一般勿用）。',
	'plugins.registry.help.remoteName':
		'MF registerRemotes.name；默认等于 id。多插件共用同一 Remote 时填 federation name。',
	'plugins.registry.help.routePath':
		'插件路由路径，如 /english-learning/notes。',
	'plugins.registry.help.sectionBasic': '插件基础',
	'plugins.registry.help.sectionHost': '挂载与安全',
	'plugins.registry.help.sectionMf': '加载与权限',
	'plugins.registry.help.sectionRoot': '根字段',
	'plugins.registry.help.signature':
		'可选：签名标记；值为 invalid 时拒绝加载。',
	'plugins.registry.help.trust':
		'信任等级：first-party / partner / untrusted（后者走 iframe，不 loadRemote）。',
	'plugins.registry.help.updatedAt':
		'配置最近更新时间；保存时由 Host 自动写入。',
	'plugins.registry.help.version':
		'插件自身版本。发版/破缓存时 bump 此字段即可，勿与 hostApiRange 混淆。',
	'plugins.registry.hostApiIncompatible':
		'插件 {id} 的 hostApiRange「{range}」与当前 Host API {hostApi} 不兼容。破缓存请只改 version，保持 hostApiRange 为 ^{hostApi}',
	'plugins.registry.iconNoTarget': '该插件没有 menu / host，无法写入 icon',
	'plugins.registry.iconPickPlugin': '选择插件',
	'plugins.registry.iconSvgOnly': '仅支持上传 SVG 文件',
	'plugins.registry.iconUpload': '上传并写入',
	'plugins.registry.iconUploadFail': '图标上传失败',
	'plugins.registry.iconUploading': '上传中…',
	'plugins.registry.iconUploadLabel': '设置插件图标',
	'plugins.registry.iconUploadOk': 'SVG 图标已上传并写入 registry',
	'plugins.registry.invalidJson': 'JSON 无效：须可解析且包含 plugins 数组',
	'plugins.registry.missingHostApiRange': '插件 {id} 缺少 hostApiRange',
	'plugins.registry.noChanges': '内容未修改，无需保存',
	'plugins.registry.pluginNotFound': 'registry 中无插件 {id}',
	'plugins.registry.save': '保存到服务器',
	'plugins.registry.saveOk': '已保存到 remotes',
	'plugins.registry.saving': '保存中…',
	'plugins.registry.title': '插件配置',
	'plugins.shelf.off': '已下架',
	'plugins.shelf.on': '已上架',
	'plugins.shelf.toggle': '上架 / 下架',
	'plugins.verify.hostApiIncompatible':
		'插件 {id}：Host API 当前为 {hostApi}，与 hostApiRange「{range}」不兼容。发版破缓存请只改 version；hostApiRange 仅在 Host 契约升级时再改',
};
