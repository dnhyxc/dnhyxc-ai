# 页面插件接入

这篇说明怎么从零接上一个**嵌在主项目页面里**的插件。插件只拿到 `api.modules.point`。主项目事先在 `points/catalog.ts` 登记点和槽，页面把入口画出来。之后再增加挂在同一点、同一槽上的插件，主项目不用改。第 11 节是已经接上的三个插件：主项目接线的意图，以及插件仓库里的完整实现。

学习笔记、聊天会话入口仍是专属模块（`modules:learningNotes`、`modules:chat`）。新的页面内嵌插件不要再加 `modules/<pluginId>`。

## 1. 先判断要不要改主项目

| 你要做的事 | 主项目 |
| --- | --- |
| 插件挂到下面表格里**已经有的点**和**已经有的槽** | 不改。只写插件，并在注册表声明 `host.surface`、`host.slot`、`modules:point` |
| 某个页面上还没有可挂的位置 | 改 `points/catalog.ts`，并在那个页面放上 `HostPoint`（或阅读页这种自己画的按钮和抽屉） |
| 插件要调用「当前这一页才能做」的事，例如跳到阅读位置 | 目录里先声明命令名，页面用 `bindPointCommand` 注册实现，离开页面时解绑 |
| 插件要调用「不依赖当前页状态」的事，例如朗读、选 JSON | 目录里声明命令名，实现写在 `points/commands.ts`，应用启动时注册一次 |

下面这些文件**不用**为新插件修改：`runtime/index.ts`、`points/api.ts`、`points/session.ts`、`packages/federation-kit`。`buildModules` 看到 `modules:point` 和 `host.surface` 后，会按目录把冻结好的 `api.modules.point` 交给这个插件。`host.surface` 对不上目录时，插件拿不到 `modules.point`。

## 2. 已经登记的点

点 id 在 `points/catalog.ts` 的 `POINT` 里。插件的 `host.surface` 必须等于这个 id，`host.slot` 必须等于该点 `slots` 里的某个 `name`。

| 点 id | 页面自己挂的槽 | 布局挂的抽屉 | 上下文 | 信号 | 命令 |
| --- | --- | --- | --- | --- | --- |
| `english.vocab.card` | `card-action` | `drawer`（`persist`，`order: 1`） | 无 | `pending` | `play`、`stop` |
| `english.vocab.library` | `toolbar`、`item-action`、`library-card-action`；列表抽屉 `drawer` 由页面自己挂（`layout.page`） | `item-drawer`、`import-drawer`（导入抽屉非模态，让位给词卡抽屉） | `libraryId` | `stats` | `pickJsonFile`、`openCard` |
| `english.classic.card` | `card-action` | `drawer` | 无 | 无 | 无 |
| `english.classic.library` | `toolbar`、`item-action`、`library-card-action` | `item-drawer`、`drawer`、`import-drawer` | `libraryId` | 无 | 无 |
| `english.mistakes` | `toolbar`、`item-action` | `drawer` | `kind` | 无 | 无 |
| `english.review` | `toolbar`、`item-action` | `drawer` | `kind` | 无 | 无 |
| `english.favorites` | `toolbar`、`item-action` | `drawer` | `kind` | 无 | 无 |
| `english.dailyReading` | `toolbar`、`item-action` | `drawer` | `origin` | 无 | 无 |
| `ebook.read` | 阅读页自己画按钮和抽屉，槽名仍是 `toolbar`、`drawer` | 不由英语学习布局挂（`layout.page`） | `bookId`、`bookTitle` | 无 | `navigateToCfi`、`openThought`、`closeIdeasList` |

词库、语句库的行按钮打开的是 `item-drawer`。错题、复习、收藏、每日阅读的行按钮打开的是同一个 `drawer`。语句库目录里还有一个名叫 `drawer` 的槽，当前页面没有按钮去打开它，新插件不要挂到这个槽。

词库列表抽屉打开时会盖住词卡详解（`covers`）。导入抽屉在词卡详解开着且没被盖住时只隐藏，不关闭（`yieldTo`）。隐藏是同一帧把面板透明度设为 0 并关掉滑入动画，不是只加 `invisible`。从列表或导入点开详解时，详解不从右侧滑入，遮罩也不从全透明淡入。

错题、复习、收藏、每日阅读用 `listPoint` 就够。下面几种目录是手写的，因为槽名、谁来画抽屉、两层抽屉怎么叠，和 `listPoint` 不一样。以后要做同类页面，按现象抄对应的那一节，不要只改 `contextKeys`。

### 2.1 先按现象选一段目录

| 你要的效果 | 抄哪一段 |
| --- | --- |
| 顶栏 + 每行一枚按钮 + 一个共用抽屉 | `listPoint`，见第 10 节 |
| 卡片角落一枚按钮，抽屉关掉时要播退场，按钮在生成时转圈，插件能朗读 | `english.vocab.card` |
| 卡片角落一枚按钮，普通抽屉，没有转圈、没有命令 | `english.classic.card` |
| 同一页上有「行详情」和「整页列表」两个抽屉，行按钮不能把列表抽屉顶掉 | `english.vocab.library` 的 `item-action` / `item-drawer`，列表抽屉另用 `drawer` |
| 列表抽屉的标题要放统计数字，或打开时不要播进场动画 | 该抽屉 `layout.page: true`，页面自己 `openPoint` + `PluginHostSurface` |
| 打开列表抽屉时，另一张已经打开的抽屉先藏起来，关掉列表后再出现 | 点上的 `covers` |
| 卡片上还有第二枚按钮，打开另一层抽屉，并且不锁住下面那层 | `library-card-action` + `import-drawer` 的 `modal: false` 和 `yieldTo` |
| 页面不在英语学习布局里，按钮和抽屉都要自己画，命令要读到当前页状态 | `ebook.read` |

### 2.2 单词卡：持久抽屉、转圈、朗读

目录没有顶栏，也没有页面上下文。词在点击时的载荷里。抽屉 `persist: true`，关掉后组件还挂着，才能播退场。`order: 1` 让它叠在导入抽屉（`order: 0`）上面。

```ts
[POINT.vocabCard]: {
	// 点 id。注册表 host.surface 必须写 english.vocab.card，插件只能拿到这个点
	id: POINT.vocabCard,
	slots: [
		{
			// 槽名。插件 host.slot 和页面 HostPoint 的 slot 都写 card-action
			name: 'card-action',
			// action：主项目画一枚图标按钮，插件组件不直接铺在卡片上
			kind: 'action',
			// 点击后打开的抽屉槽。载荷写在 drawer 上，插件 getPayload('drawer') 才读得到
			opens: 'drawer',
		},
		{
			// 详解抽屉的槽名，必须和上面 opens 的 'drawer' 相同
			name: 'drawer',
			// drawer：英语学习布局把打开后的插件画进右侧抽屉
			kind: 'drawer',
			layout: {
				// true：关闭后抽屉组件仍挂着，才能播退场。被列表盖住时不播退场
				persist: true,
				// 1：比导入抽屉的 order 0 大，后挂，叠在导入上面
				order: 1,
			},
		},
	],
	// 空数组：这个点没有整页上下文，词只存在点击载荷里
	contextKeys: [],
	// 允许 publishSignal('pending')。载荷里的 word 对得上时，这枚按钮转圈
	signals: ['pending'],
	// play / stop 在 points/commands.ts 注册，任何页面都能调用，不跟某一页的 state 走
	commands: ['play', 'stop'],
},
```

页面只放按钮，不放抽屉组件：

```tsx
<HostPoint pointId={POINT.vocabCard} slot="card-action" payload={payload} />
```

`payload` 必须带字符串 `word`，转圈和「再点一次关闭」都认这个字段。插件注册表 `host.slot` 写 `card-action`。抽屉里 `getPayload('drawer')`。朗读调用 `command('play', word)` 和 `command('stop', undefined)`。生成过程中：

```ts
point.publishSignal('pending', { pluginId: 'vocabDetail', key: word, on: true });
```

`pluginId` 是注册表 id，`key` 要和载荷里的 `word` 是同一个词。

### 2.3 语句卡：只有按钮和普通抽屉

和单词卡相比，抽屉不写 `layout`，所以没有退场保留，也没有 `order`。没有 `pending`，没有 `play` / `stop`。载荷用 `english`，不是 `word`，所以按钮不会转圈；再点一次仍会关闭，因为 `HostPoint` 也会拿 `english` 做同一行判断。

```ts
[POINT.classicCard]: {
	// 点 id。注册表 host.surface 写 english.classic.card
	id: POINT.classicCard,
	slots: [
		{
			// 语句卡角落按钮的槽名。插件 host.slot 写 card-action
			name: 'card-action',
			// action：主项目画按钮，插件组件画进抽屉
			kind: 'action',
			// 点击把这一句的 payload 写入 drawer
			opens: 'drawer',
		},
		{
			// 不写 layout：布局挂普通模态抽屉，关掉就卸载，没有退场保留，也没有叠放顺序
			name: 'drawer',
			// drawer：由英语学习布局挂载
			kind: 'drawer',
		},
	],
	// 没有整页字段。句子在载荷的 english 上
	contextKeys: [],
	// 空数组：publishSignal 一律丢掉，按钮不会转圈
	signals: [],
	// 空数组：这个点没有命令，调用会抛 UNKNOWN_POINT_COMMAND
	commands: [],
},
```

插件 `host.slot` 写 `card-action`，读 `getPayload('drawer')`。

### 2.4 单词库：为什么不能用 `listPoint`

`listPoint` 只准备三样东西：一个顶栏、一枚行按钮、一个名叫 `drawer` 的抽屉，而且行按钮打开的就是这同一个抽屉。单词库页面上同时有四件互不替代的事，塞进一个抽屉会互相关掉：

1. 顶栏要挂插件，并且要显示「总数 / 已加载」。
2. 词条行上的按钮打开的是**这一行的详解**，不能把整库列表清掉。
3. 顶栏那个「单词解析」打开的是**整库列表**。它的标题里要放统计数字，从词卡切过来时还不能再播一次进场动画，所以不能交给布局的普通抽屉。
4. 词库卡片上还有一枚导入按钮，打开的是**导入**。导入开着时，用户还要点词卡详解叠在上面；词卡详解开着时，导入不能被关掉，只是先看不见。

另外，整库列表打开时，词卡上已经打开的详解要藏起来，列表关掉后再回到原处。这是两个点之间的关系，`listPoint` 没有这个字段。

所以 `english.vocab.library` 把槽拆成三对「按钮槽 → 抽屉槽」，再单独写上下文、信号、命令和覆盖。

| 字段 | 写成这样 | 页面上因此发生什么 |
| --- | --- | --- |
| `id` | `POINT.vocabLibrary`，值是 `english.vocab.library` | 注册表 `host.surface` 必须写这个字符串。插件拿到的 `api.modules.point` 只属于这个点 |
| `toolbar` | `kind: 'toolbar'` | 词库页顶栏放 `<HostPoint slot="toolbar" />`。`host.slot` 为 `toolbar` 的插件画在这里，不打开抽屉 |
| `item-action` | `kind: 'action'`，`opens: 'item-drawer'` | 每一行的按钮。点击把这一行的 `payload` 写进 `item-drawer`，不会写入名叫 `drawer` 的列表槽 |
| `item-drawer` | `kind: 'drawer'`，不写 `layout` | 行详解抽屉。英语学习布局负责挂上和离开时关闭。插件 `host.slot` 仍写 `item-action`，组件里读 `getPayload('item-drawer')` |
| `drawer` | `layout: { page: true }` | 整库列表。`page: true` 表示布局不渲染它，词库页自己用 `openPoint` 和 `PluginHostSurface` 画。标题和「列表已经开着就不要再滑入」只有页面做得到。离开英语学习时布局仍会 `closePoint` |
| `library-card-action` | `kind: 'action'`，`opens: 'import-drawer'` | 词库卡片上的导入按钮，和行按钮不是同一个槽。点击把 `{ libraryId, title }` 写入 `import-drawer` |
| `import-drawer.persist` | `true` | 关掉导入后组件还留着，抽屉能播退场。插件若已停用而槽还开着，会把槽关掉 |
| `import-drawer.modal` | `false` | 不锁焦点，遮罩不挡住下层。词卡详解才能叠在导入上面继续操作 |
| `import-drawer.order` | `0` | 布局挂载顺序。词卡抽屉是 `order: 1`，数字更大，后挂，盖在导入上面 |
| `import-drawer.yieldTo` | 词卡的 `drawer` | 词卡详解 `open` 且没有被盖住时，导入抽屉只隐藏，不执行关闭。面板同一帧透明并停掉动画，词卡关掉后导入还在原位 |
| `contextKeys` | `['libraryId']` | 整页只有当前词库 id。页面 `usePointContext(POINT.vocabLibrary, { libraryId })`。空串会被丢掉。列表插件读 `getContext().libraryId`，不从点击载荷里拿 |
| `signals` | `['stats']` | 只允许列表插件回写 `{ total, loaded }`。没写 `pending`，这个点上的按钮不会因 `publishSignal('pending')` 转圈 |
| `commands` | `pickJsonFile`、`openCard` | 这两个不依赖词库页里的 React state，实现放在 `points/commands.ts`。`openCard` 打开的是**词卡点**的抽屉，所以列表可以保持打开 |
| `covers.slot` | `'drawer'` | 只有打开整库列表这个槽时才去盖别人。打开 `item-drawer` 或 `import-drawer` 不会盖住词卡 |
| `covers.targetPoint` / `targetSlot` | 词卡的 `drawer` | 列表打开时词卡详解保持 `open: true` 和原来的词，只多一个 `covered`。列表 `closePoint` 后揭开，详解在原处出现，不重新播打开动画 |

对应代码：

```ts
[POINT.vocabLibrary]: {
	// 点 id，值是 english.vocab.library。注册表 host.surface 与插件 api.modules.point 都锁在这个点上
	id: POINT.vocabLibrary,
	slots: [
		{
			// 顶栏槽名。页面 HostPoint 和插件 host.slot 都写 toolbar
			name: 'toolbar',
			// toolbar：把插件组件铺在顶栏里，点击不会打开抽屉
			kind: 'toolbar',
		},
		{
			// 词条行上的按钮槽，和卡片上的导入按钮分开
			name: 'item-action',
			// action：主项目按注册表图标画按钮，插件组件画的是抽屉内容
			kind: 'action',
			// 打开 item-drawer，不打开下面那个名叫 drawer 的整库列表，避免一行点击清掉列表
			opens: 'item-drawer',
		},
		{
			// 行详解的抽屉槽。不写 layout，英语学习布局负责挂上，离开英语学习时关闭
			name: 'item-drawer',
			// drawer：布局用 HostPoint 渲染这个槽
			kind: 'drawer',
		},
		{
			// 整库列表的槽名。和 item-drawer 是两份会话，行点击不会写到这里
			name: 'drawer',
			// drawer：仍然是抽屉槽，但下面的 layout.page 改由页面自己画
			kind: 'drawer',
			layout: {
				// true：布局不渲染这个抽屉。词库页自己 openPoint，并用 PluginHostSurface 画标题里的统计和进场
				page: true,
			},
		},
		{
			// 词库卡片上的导入按钮槽，和行上的 item-action 不是同一个按钮
			name: 'library-card-action',
			// action：主项目画这枚导入图标
			kind: 'action',
			// 点击把 { libraryId, title } 写入 import-drawer
			opens: 'import-drawer',
		},
		{
			// 导入抽屉槽名，必须和上面 opens 的 'import-drawer' 相同
			name: 'import-drawer',
			// drawer：由英语学习布局挂载，具体行为由下面的 layout 四个字段决定
			kind: 'drawer',
			layout: {
				// true：关闭后组件仍挂着，Sheet 才能播退场。插件停用而槽还开着时会把槽关掉
				persist: true,
				// false：不锁焦点，遮罩不挡下层。词卡详解才能叠在导入上面继续点
				modal: false,
				// 0：比词卡抽屉的 order 1 小，先挂，躺在下层
				order: 0,
				yieldTo: {
					// 让位的目标点是词卡，不是单词库自己
					point: POINT.vocabCard,
					// 词卡详解槽。它 open 且没有被盖住时，导入只隐藏，不 closePoint
					slot: 'drawer',
				},
			},
		},
	],
	// 只允许把当前词库 id 交给插件。空串和未声明的键会被丢掉
	contextKeys: ['libraryId'],
	// 只允许回写顶栏统计。没有 pending，这个点上的按钮不会转圈
	signals: ['stats'],
	// 选 JSON 和打开词卡详解。实现在 commands.ts，openCard 打开的是词卡点，列表保持开着
	commands: ['pickJsonFile', 'openCard'],
	covers: {
		// 只有这个槽被打开时才去盖别人。行详解和导入不会触发覆盖
		slot: 'drawer',
		// 被盖住的是词卡这个点
		targetPoint: POINT.vocabCard,
		// 被盖住的是词卡详解。open 和词都保留，只加上 covered，列表关掉后再出现
		targetSlot: 'drawer',
	},
},
```

页面对三个入口各放一个 `HostPoint`，列表抽屉自己画：

```tsx
usePointContext(POINT.vocabLibrary, libraryKey ? { libraryId: libraryKey } : null);

<HostPoint pointId={POINT.vocabLibrary} slot="toolbar" />
<HostPoint
	pointId={POINT.vocabLibrary}
	slot="item-action"
	payload={{ word, pos, ipa, translationZh, example }}
/>
<HostPoint
	pointId={POINT.vocabLibrary}
	slot="library-card-action"
	payload={{ libraryId: lib.id, title }}
/>
```

列表按钮不走 `HostPoint`。页面找出 `host.slot === 'drawer'` 的插件，再 `openPoint`。载荷是空对象，词库 id 在上下文里：

```tsx
openPoint(POINT.vocabLibrary, listPlugin.id, 'drawer', {});
```

抽屉本体用 `PluginHostSurface`，`surface` 为 `english.vocab.library`，`part` 为 `drawer`。关闭时调用 `closePoint(POINT.vocabLibrary, 'drawer')`。`covers` 会把词卡抽屉标成 `covered`，词卡那边不播退场，列表关掉后再露出来。

插件按槽登记，不要混用：

| 插件做什么 | `host.slot` | 读什么 |
| --- | --- | --- |
| 顶栏 | `toolbar` | `getContext().libraryId`，或 `publishSignal('stats', { total, loaded })` |
| 每一行的详解 | `item-action` | `getPayload('item-drawer')` |
| 整库列表 | `drawer` | `getContext().libraryId`。打开时载荷是 `{}` |
| 卡片上的导入 | `library-card-action` | `getPayload('import-drawer')`，字段是 `libraryId`、`title` |

`pickJsonFile` 和 `openCard` 已在 `points/commands.ts` 里。导入插件调用 `command('pickJsonFile', undefined)`。列表里点开某个词调用 `command('openCard', word)`，它打开的是词卡那个点的抽屉，载荷带 `source: 'list'`，不会把单词库的列表抽屉关掉。这一次打开详解不滑入、遮罩不从 0 淡入；列表和导入面板同一帧隐藏。从词卡按钮打开不带这个字段，仍会滑入。

### 2.5 语句库：槽和单词库同名，叠层规则没有抄过去

语句库先展开 `listPoint`，再整份换掉 `slots`。`contextKeys` 仍是 `libraryId`。`signals` 和 `commands` 仍是空数组，因为展开之后没有覆盖这两项。

```ts
[POINT.classicLibrary]: {
	// 展开 listPoint：带上 id、contextKeys 为 libraryId、signals 和 commands 都是空数组
	...listPoint(POINT.classicLibrary, ['libraryId']),
	slots: [
		{
			// 顶栏槽名。插件 host.slot 写 toolbar
			name: 'toolbar',
			// toolbar：插件内容铺在顶栏，点击不开抽屉
			kind: 'toolbar',
		},
		{
			// 语句行上的按钮槽
			name: 'item-action',
			// action：主项目画按钮
			kind: 'action',
			// 打开 item-drawer，避免和下面的 drawer 共用一份会话
			opens: 'item-drawer',
		},
		{
			// 行详解抽屉槽名。不写 layout，由英语学习布局挂普通模态抽屉
			name: 'item-drawer',
			// drawer：布局用 HostPoint 渲染打开后的插件
			kind: 'drawer',
		},
		{
			// 布局会挂这个槽，但语句库页面目前没有按钮对它 openPoint
			name: 'drawer',
			// drawer：仍是抽屉类型。插件不要把 host.slot 写成这个名字，否则行上没有按钮
			kind: 'drawer',
		},
		{
			// 语句库卡片上的第二枚按钮
			name: 'library-card-action',
			// action：主项目画导入图标
			kind: 'action',
			// 点击把卡片载荷写入 import-drawer
			opens: 'import-drawer',
		},
		{
			// 导入抽屉。不写 layout，所以没有退场保留、非模态、叠放顺序和让位
			name: 'import-drawer',
			// drawer：英语学习布局按普通模态抽屉挂上
			kind: 'drawer',
		},
	],
},
```

和单词库的差别要单独记住：

- 三个抽屉都没写 `layout`，全部由英语学习布局挂，都是普通模态抽屉。
- 没有 `covers`，打开任何抽屉都不会藏起语句卡。
- 没有 `yieldTo`，导入抽屉不会在语句卡打开时自动让开。
- 没有 `stats`，`publishSignal('stats', …)` 会被丢掉。
- 没有 `pickJsonFile` / `openCard`。
- 名叫 `drawer` 的槽目前没有页面按钮打开。新插件不要把 `host.slot` 写成 `drawer`，应写 `toolbar`、`item-action` 或 `library-card-action`。

行插件读 `getPayload('item-drawer')`，载荷字段是 `english`、`translationZh`、`source`、`noteZh`。

如果语句库以后也要「列表盖住语句卡、导入层让位」，把单词库那段 `layout`、`covers`、`signals`、`commands` 按需要抄过来，并让页面自己挂 `drawer`。只改槽名不会得到那些行为。

### 2.6 阅读页：页面自己画，命令绑在页面上

阅读页不在英语学习布局里。抽屉标 `page: true` 后，`Layout.tsx` 不会给它挂 `HostPoint`。按钮和抽屉都在 `views/ebook/read.tsx` 里用 `PluginHostSurface`。

```ts
[POINT.ebookRead]: {
	// 点 id。注册表 host.surface 写 ebook.read
	id: POINT.ebookRead,
	slots: [
		{
			// 阅读页顶栏槽。PluginHostSurface part="toolbar" 画挂在这里的插件
			name: 'toolbar',
			// toolbar：插件组件直接出现在顶栏，不负责开抽屉
			kind: 'toolbar',
		},
		{
			// 阅读页插件抽屉槽。触发按钮由 PluginHostSurface part="drawer-triggers" 画
			name: 'drawer',
			// drawer：打开后渲染 host.slot 为 drawer 的插件
			kind: 'drawer',
			layout: {
				// true：英语学习布局不挂这个抽屉。阅读页不在那个布局里，必须自己画、自己关
				page: true,
			},
		},
	],
	// 只把当前书的 id 和标题交给插件。PDF 或离开页面时发布 null
	contextKeys: ['bookId', 'bookTitle'],
	// 阅读页插件不回写转圈或顶栏数字
	signals: [],
	// 这三个名字要在阅读页 effect 里 bindPointCommand。它们读的是当前这本书的渲染器
	commands: ['navigateToCfi', 'openThought', 'closeIdeasList'],
},
```

顶栏插件 `host.slot` 写 `toolbar`，只读 `getContext()`。抽屉插件 `host.slot` 写 `drawer`，由阅读页的触发器打开，一般没有行载荷。

三条命令不能写进 `points/commands.ts`。它们要读到当前这本书的渲染器和「关掉抽屉」的 state，所以在阅读页 effect 里 `bindPointCommand`，EPUB 就绪时 `publishPointContext(POINT.ebookRead, { bookId, bookTitle })`，PDF 或卸载时发布 `null` 并解绑。

插件调用：

```ts
point.command('navigateToCfi', cfi);
point.command('openThought', thought);
point.command('closeIdeasList', undefined);
```

离开阅读页后这三条会变成 `POINT_COMMAND_UNBOUND`。

### 2.7 自己加一种特殊页时改哪些字段

1. 在 `POINT` 里加 id，在 `hostPoints` 里写一整项。有多个抽屉就不要用 `listPoint` 的默认槽，把 `slots` 写全。
2. 每个按钮槽用 `opens` 指向它自己的抽屉名。两个按钮若 `opens` 同一个槽，后一次点击会盖住前一个插件的载荷。
3. 抽屉交给英语学习布局时不写 `layout`，或只写 `persist`、`modal`、`order`、`yieldTo`。页面要自定义标题、宽度或进场时写 `layout: { page: true }`，并在页面里 `openPoint` / `closePoint`。
4. 打开 A 应该把 B 藏起来而不是关掉时，在 A 所在的点上写 `covers`，`slot` 是 A 的抽屉名。
5. 整页都会变的数据放进 `contextKeys`，点某一行才有的数据放进 `HostPoint` 的 `payload`。
6. 按钮要转圈就加 `signals: ['pending']`，并且载荷里要有 `word`。顶栏要数字就加 `signals: ['stats']`，页面用 `readStats` 而不是 `useSyncExternalStore(readStats)`。
7. 命令若闭包了某一页的 state，写进 `commands` 数组，并在该页 `bindPointCommand`。全站都能做的命令再写到 `points/commands.ts`。

## 3. 插件实际拿到的五个方法

`createPointApi` 用目录项闭包把点 id 固定住。插件不能传另一个点。

```ts
api.modules.point.getContext(): Record<string, unknown> | null
api.modules.point.getPayload(slot: string): Record<string, unknown> | null
api.modules.point.subscribe(listener: () => void): () => void
api.modules.point.publishSignal(name: string, value: unknown): void
api.modules.point.command(name: string, arg: unknown): unknown
```

- `getContext` 只含目录 `contextKeys` 里的键。页面还没发布，或已经离开，返回 `null`。返回的是副本。
- `getPayload(slot)` 读**那个槽**上当前打开的载荷。按钮槽的名字不是载荷所在的槽。行按钮 `item-action` 若 `opens: 'drawer'`，插件要读 `getPayload('drawer')`。槽没开是 `null`。
- `subscribe` 在上下文变化，或这个点任意槽开关时调用。它返回退订函数。`publishSignal` **不会**唤醒这次订阅。顶栏数字要用页面侧的 `subscribeSignals`，不要在插件里靠 `subscribe` 等自己刚写出去的 `stats`。
- `publishSignal` 的名字必须是该点 `signals` 里的 `'pending'` 或 `'stats'`。其它名字直接丢掉，界面不会更新。
- `command` 的第二个参数必须传。没有参数时传 `undefined`。目录里没有这个名字会抛 `UNKNOWN_POINT_COMMAND`。名字在目录里、但当前页面还没 `bindPointCommand`，或离开后已经解绑，会抛 `POINT_COMMAND_UNBOUND`。

`pending` 的值是 `{ pluginId, key, on }`。按钮转圈只在载荷里有字符串 `word` 时出现，语句卡的 `english` 不会转圈。

`stats` 的值是 `{ total, loaded }` 或 `null`。`null` 表示清掉顶栏数字。非有限数字不会盖掉上一份有效数字。页面读统计时用 `useState` 加上 `subscribeSignals`。不要把 `readStats` 直接交给 `useSyncExternalStore`，它每次调用都返回新对象，会循环渲染。

每个字段的类型、缺省和会被丢掉的值见文末 [参数说明](#9-参数说明)。

## 4. 从零新增一个挂载位置

下面先说明挂载位置怎么登记。同一页的目录、页面、注册表和两个插件的完整文件在 [从零开始的完整示例](#10-从零开始的完整示例)。那个例子多加了一条页面命令 `markDone`。

### 4.1 登记目录

文件：`apps/frontend/src/federation/points/catalog.ts`。

在 `POINT` 里增加常量，并在 `hostPoints` 里增加一项。槽位形状与错题集相同，可以直接套 `listPoint`：

```ts
export const POINT = {
	// 短名字只在主项目代码里用。注册表 host.surface 要写后面的字符串 english.practice
	practice: 'english.practice',
} as const;

// hostPoints 的一项。第一个参数是点 id，第二个参数是上下文白名单，只允许字段 kind
[POINT.practice]: listPoint(POINT.practice, ['kind']),
```

第二个参数 `['kind']` 是上下文白名单，不是槽类型，也不是每个点都要传 `kind`。它表示页面以后只能把名为 `kind` 的字段交给插件。练习页没有整页状态时改成 `[]`。词库传 `['libraryId']`，每日阅读传 `['origin']`。键名必须和页面 `usePointContext` 里的对象键一致，插件用 `getContext().kind` 读取。

`listPoint` 会登记三个槽：

- `toolbar`：顶栏，由页面放 `<HostPoint slot="toolbar" />`。注册表 `host.slot` 也写 `toolbar`。
- `item-action`：行按钮。点击后把这一行的 `payload` 写到 `drawer` 槽并打开它。注册表 `host.slot` 写 `item-action`，插件读载荷时写 `getPayload('drawer')`。
- `drawer`：普通抽屉。不写 `layout` 时，英语学习 `Layout` 会挂上 `HostPoint`，离开英语学习时 `closePoint`。页面自己不用再放一个抽屉组件。

这一步之后 `layoutDrawerSlots` 会自动包含这个抽屉，`Layout.tsx` 不用改。

如果抽屉要一直挂着以便播退场动画，给抽屉槽加 `layout: { persist: true, order: 1 }`。`order` 小的先挂，后挂的盖在上面。未写 `order` 的按 `2` 排序。

如果抽屉必须由页面自己画（标题里要放统计、或要跳过进场动画），给抽屉槽加 `layout: { page: true }`。布局不再挂这个抽屉，离开英语学习时仍会关掉它。页面要自己根据会话渲染抽屉。词库列表、阅读页抽屉是这种。

### 4.2 在页面上挂入口并发布上下文

文件：练习页组件，例如 `apps/frontend/src/views/englishLearning/pluginDemo/List.tsx`。从 `@/federation` 引入 `HostPoint`、`POINT`、`usePointContext`。页面必须作为 `/english-learning` 的子路由挂上，父级才是会自动挂抽屉的 `EnglishLearningLayout`。完整路由改法和逐行注释见 [第 10 节](#10-从零开始的完整示例)。不要挂到已有的 `practice` 子路由上，那是练习功能自己的页面。

页面上下文只在数据真正有值时发布。离开页面时 `usePointContext` 会发布 `null`。依赖用的是序列化结果，同一份内容重复渲染不会反复写入。

```tsx
const kind = 'vocab';
usePointContext(POINT.practice, { kind });
```

顶栏：

```tsx
<HostPoint pointId={POINT.practice} slot="toolbar" />
```

每一行。`payload` 会在点击时写入 `drawer` 槽。插件之后用 `getPayload('drawer')` 读取。同一插件、同一个 `word` 或 `english` 再点一次会关闭抽屉。载荷里既没有 `word` 也没有 `english` 时，再点一次是再打开，不会当成切换关闭。

```tsx
<HostPoint
	pointId={POINT.practice}
	slot="item-action"
	payload={{ id: item.id, title: item.title }}
/>
```

没有启用中的插件挂在这个槽上时，`HostPoint` 渲染空，不占按钮位置。点击发生在插件下载完成之前时，载荷已经写进槽里，插件加载后 `getPayload` 仍能读到。

抽屉不用在这个页面再放一个 `HostPoint`。英语学习布局会挂所有没标 `layout.page` 的抽屉。

### 4.3 页面级命令

命令要读到这一页的状态时，在页面 effect 里绑定，清理函数里解绑。目录的 `commands` 数组必须先有这个名字，否则插件调用会抛 `UNKNOWN_POINT_COMMAND`。

阅读页在 EPUB 就绪后发布 `bookId`、`bookTitle`，并绑定 `navigateToCfi`、`openThought`、`closeIdeasList`。PDF 或离开页面时发布 `null` 并解绑。写法在 `apps/frontend/src/views/ebook/read.tsx` 里对 `POINT.ebookRead` 的那段 effect。

`bindPointCommand` 返回解绑函数。后一次注册盖住前一次；旧的解绑函数只会删掉自己那次注册的函数，不会把新的删掉。

### 4.4 全站命令

实现不关闭页面上的 state 时，写在 `points/commands.ts`，并在 `runtime/index.ts` 里保留现有的副作用导入（已有，不用为新命令再改 runtime）。现成例子：

- `english.vocab.card` 的 `play` / `stop`
- `english.vocab.library` 的 `pickJsonFile` / `openCard`

`openCard` 只打开词卡抽屉，不负责再点一次关闭。词是空的，或详解插件没启用，返回 `false`。

### 4.5 页面不在英语学习布局下

阅读页就是这样。目录里把抽屉标成 `layout: { page: true }`，页面自己用 `PluginHostSurface` 画按钮和抽屉，并用 `publishPointContext`、`bindPointCommand` 接上上下文和命令。离开页面时要 `closePoint`，因为英语学习布局的卸载清理不会在这条路由上跑。英语学习布局卸载时仍会顺带 `closePoint` 阅读页抽屉，没打开过时这是空操作。

页面自己画抽屉时，宽度用 `@/federation` 导出的 `pointDrawerWidth`（`w-full sm:max-w-[420px]`），和 `HostPoint` 的抽屉一致。

## 5. 从零写插件并登记

主项目目录和页面入口就绪后，插件侧做三件事：注册表、远程组件、用 `api.modules.point` 读上下文和载荷。

### 5.1 注册表

内嵌插件不要再注入一条顶层业务路由。`injectRoute` 设为 `false`。`host.surface` 等于点 id。`host.slot` 等于这个插件要出现的槽：按钮插件写按钮槽名，顶栏插件写 `toolbar`，由页面按钮打开的抽屉插件写抽屉槽名。字段含义见 [注册表](#911-注册表)。

```json
{
  "id": "practiceNote",
  "title": { "zh-CN": "练习笔记", "en-US": "Practice note" },
  "routePath": "/plugins/practice-note",
  "entry": "http://127.0.0.1:9008/mf-manifest.json",
  "version": "0.0.1",
  "hostApiRange": "^1.0.0",
  "injectRoute": false,
  "host": {
    "surface": "english.practice",
    "slot": "item-action",
    "icon": "notebook"
  },
  "permissions": ["modules:point"],
  "enabled": false,
  "trust": "first-party"
}
```

`enabled` 先保持 `false`，在插件中心打开。改完注册表后，插件中心要重新拉取。本地开发缓存键是 `dnhyxc.plugin.registry.dev.v1`，拉到旧清单时清掉这份缓存再刷新。

`hostApiRange` 保持 `^1.0.0`。这次接入没有改宿主 API 版本。已经发布、只声明了 `modules:ebook`、`modules:vocabDetail`、`modules:vocabDetailImport` 的包，要改成 `modules:point` 后重新发布才能加载。

一个插件只有一个 `host.slot`。

- 行按钮或卡片按钮：`slot` 写成按钮槽，例如 `item-action`、`card-action`、`library-card-action`。`HostPoint` 画按钮。点击后打开目录里 `opens` 指向的抽屉，并把**这同一个插件**画进抽屉。插件包里要同时有按钮图标（用注册表 `host.icon`）和抽屉内容。
- 顶栏：`slot` 为 `toolbar`。只渲染顶栏那一块，不会因为点击去开抽屉。
- 页面自己打开的抽屉（词库列表、阅读页）：`slot` 写成那个抽屉槽，例如 `drawer`。按钮在页面上，打开时 `openPoint` 或 `PluginHostSurface` 指定这个插件。

### 5.2 顶栏插件

挂在 `toolbar`。页面上下文用 `getContext`，变化时靠 `subscribe` 重读。顶栏插件通常没有点击载荷。

```tsx
const point = bridge.api.modules?.point;

function Toolbar() {
  const [kind, setKind] = useState('');
  useEffect(() => {
    if (!point) return;
    const read = () => {
      const ctx = point.getContext();
      setKind(typeof ctx?.kind === 'string' ? ctx.kind : '');
    };
    read();
    return point.subscribe(read);
  }, [point]);
  if (!point) return null;
  return <p>{kind}</p>;
}
```

### 5.3 按钮打开的抽屉插件

注册表 `host.slot` 写按钮槽，例如错题集、每日阅读写 `item-action`，词库行插件写 `item-action` 但载荷在 `item-drawer`。按钮由 `HostPoint` 画，图标来自 `host.icon`。同一个插件在抽屉里渲染内容。抽屉打开后读 `opens` 那个槽的载荷，不要读按钮槽：

```tsx
const PAYLOAD_SLOT = 'drawer';

function Panel({ point }: { point: PointModule }) {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    const read = () => setPayload(point.getPayload(PAYLOAD_SLOT));
    read();
    return point.subscribe(read);
  }, [point]);
  if (!payload) return null;
  return <p>{String(payload.title ?? '')}</p>;
}
```

词库、语句库行插件的 `PAYLOAD_SLOT` 是 `item-drawer`。注册表 `host.slot` 仍是 `item-action`。写成 `item-drawer` 时，行上不会出现按钮。

生成过程要让按钮转圈时，载荷里要有字符串 `word`，并调用：

```ts
point.publishSignal('pending', { pluginId, key: word, on: true });
```

结束时 `on: false`。该点的 `signals` 必须包含 `pending`，否则这次写入会被丢掉。

### 5.4 调用命令

```ts
await point.command('play', word);
point.command('closeIdeasList', undefined);
```

第二个参数不能省。`play` 在词卡点上，空白词会得到一个已完成的 Promise，不会去合成。`openCard` 返回 `false` 表示没打开。

## 6. 抽屉布局旗标

写在目录里该抽屉槽的 `layout` 上。

| 字段 | 作用 |
| --- | --- |
| 不写 | 英语学习布局挂普通抽屉，离开英语学习时关闭 |
| `page: true` | 页面自己画。布局只在离开英语学习时关闭 |
| `persist: true` | 抽屉组件保持挂载，关闭时能播退场。插件停用后若槽还开着，会把槽关掉 |
| `modal: false` | 不锁焦点，遮罩不挡下面的操作。抽屉开着就锁定页面滚动，让位时也不先解开 |
| `yieldTo` | 目标槽开着且没被盖住时，本抽屉只隐藏，不关闭。面板同一帧 `opacity: 0` 并关掉动画 |
| `order` | 小的先挂，在下层。不写按 `2` |
| 点上的 `covers` | 本点某个槽打开时，把另一个点的槽标成被盖住。被盖住的抽屉不播退场，逻辑上仍算打开 |

## 7. 接上之后看不到

按这个顺序查：

1. 插件中心已启用，注册表 `enabled` 且账号偏好里也是开的。
2. `permissions` 含 `modules:point`。没有这项就没有 `api.modules.point`。
3. `host.surface` 与 `POINT` 里的 id 完全一致，`host.slot` 是该点某个槽的 `name`。
4. 页面上确实渲染了对应的 `<HostPoint pointId slot />`。抽屉槽若没标 `page`，要确认页面在英语学习 `Layout` 下面。
5. `HostPoint` 按钮要求 `host.slot` 等于按钮槽名。挂到 `opens` 指向的抽屉槽上时，行上不会出现按钮。页面自己打开的抽屉则相反，`host.slot` 要等于那个抽屉槽。
6. `getContext()` 为 `null`：页面还没 `usePointContext` / `publishPointContext`，或键不在 `contextKeys` 里，或页面传了 `null`。
7. `getPayload` 为 `null`：槽名用了按钮槽，而不是 `opens` 指向的抽屉槽；或抽屉已经 `closePoint`。
8. 命令抛 `UNKNOWN_POINT_COMMAND`：目录 `commands` 没有这个名字。抛 `POINT_COMMAND_UNBOUND`：页面还没绑定，或 effect 已经清理。
9. 顶栏统计不变：点的 `signals` 没有 `stats`，或写入的 `total` / `loaded` 不是有限数字。
10. 注册表改了仍是旧插件：清 `dnhyxc.plugin.registry.dev.v1` 后重新拉取。

## 8. 最小验收

- 插件中心关闭时，顶栏和行按钮都不占位。
- 打开后，顶栏能读到当前页上下文；切换页面上的 `kind` / `libraryId` / `origin` 后，插件跟着变。
- 点击行按钮能打开抽屉，插件读到这一行的 `payload`。插件包还在下载时先点，下载完后载荷仍在。
- 同一按钮再点一次，在载荷含 `word` 或 `english` 时关闭。
- 离开英语学习后，抽屉关掉，`getContext()` 变为 `null`。
- 未声明的命令抛 `UNKNOWN_POINT_COMMAND`，页面未绑定时抛 `POINT_COMMAND_UNBOUND`。

## 9. 参数说明

下面按调用方会碰到的对象列字段。插件读到的上下文和载荷都是浅拷贝，改返回值不会写回主项目。

### 9.1 目录 `HostPointSpec`

写在 `points/catalog.ts` 的 `hostPoints` 里。少一个字段，插件就少一种能力。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | `string` | 点的唯一名字，同时也是注册表 `host.surface`。建议 `业务.页面`，例如 `english.practice`。插件不能把这个 id 传进五个方法里，闭包已经固定 |
| `slots` | `HostPointSlot[]` | 这个点允许出现的位置。名字不在这里的槽，`HostPoint` 渲染空，`openPoint` 返回 `false` |
| `contextKeys` | `readonly string[]` | 页面可以交给插件的键。`publishPointContext` 会丢掉名单以外的键。空数组表示这个点没有页面上下文，`getContext()` 在发布过非空对象后仍可能是 `null` |
| `signals` | `('pending' \| 'stats')[]` | 插件允许回写的信号。只能是这两项。空数组时任何 `publishSignal` 都被丢掉 |
| `commands` | `readonly string[]` | 插件允许调用的命令名。未列入的名字抛 `UNKNOWN_POINT_COMMAND`，不会去查有没有绑定 |
| `covers` | `{ slot, targetPoint, targetSlot }` 可选 | 本点的 `slot` 被打开时，把 `targetPoint` 上的 `targetSlot` 标成被盖住。被盖住的槽保持 `open: true` 和原来的载荷，只是看不见，也不播退场。关掉本槽时只揭开那一层，不关闭它 |

`contextKeys` 里的值还有一条过滤：`null`、`undefined`、空字符串 `''` 都不会留下。过滤完一个有效键都没有时，会话记成 `null`，和离开页面一样。

### 9.2 槽 `HostPointSlot`

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `name` | `string` | 槽名。注册表 `host.slot`、`<HostPoint slot>`、`getPayload(slot)`、`openPoint` / `closePoint` 的槽参数都用这个字符串，大小写必须一致 |
| `kind` | `'toolbar' \| 'action' \| 'drawer'` | `toolbar` 把 `host.slot` 等于这个名字的插件画成顶栏内容。`action` 把它们画成一枚按钮。`drawer` 画打开后的抽屉正文 |
| `opens` | `string` 可选 | 仅 `action` 使用。点击后打开的抽屉槽名，载荷写在那个槽上。不写时，点击会尝试打开与按钮同名的槽，通常打不开 |
| `layout` | 见下表，可选 | 只对 `drawer` 有意义。不写时：英语学习布局挂一个普通模态抽屉，离开英语学习时关闭 |

`layout`：

| 字段 | 类型 | 缺省 | 含义 |
| --- | --- | --- | --- |
| `page` | `boolean` | `false` | `true` 时布局不挂这个抽屉，页面自己画。离开英语学习时布局仍会 `closePoint` |
| `persist` | `boolean` | `false` | `true` 时抽屉组件在关闭后仍挂着，用来播退场。被盖住时不播退场。该插件已不在启用列表里、槽却还开着时，会把槽关掉 |
| `modal` | `boolean` | `true` | `false` 时不锁焦点，遮罩不挡下层点击。抽屉开着就把 `document.body` 的滚动锁住，让位时不先解开 |
| `yieldTo` | `{ point: string; slot: string }` | 无 | 目标槽 `open && !covered` 时，本抽屉只隐藏，不关闭，也不响应点外面关闭。隐藏写在内容区的内联样式上：`opacity: 0`，并关掉动画和过渡 |
| `order` | `number` | `2` | 布局挂载顺序。数字小的先挂，在下层 |

### 9.3 页面组件 `HostPoint`

```tsx
<HostPoint
  pointId={string}
  slot={string}
  payload?: Record<string, unknown>
  className?: string
  drawerClassName?: string
  drawerStyle?: CSSProperties
/>
```

| 参数 | 何时生效 | 含义 |
| --- | --- | --- |
| `pointId` | 必填 | `POINT` 里的 id。目录没有这个点时组件返回 `null` |
| `slot` | 必填 | 目录里的槽名。槽不存在时返回 `null`。按钮传按钮槽，顶栏传 `toolbar`。普通抽屉由布局传抽屉槽，页面不用再传一次 |
| `payload` | 仅 `action` | 点击打开时整份浅拷贝写入 `opens` 指向的抽屉槽。顶栏和抽屉忽略它 |
| `className` | 顶栏外包一层，抽屉正文包一层 | 顶栏默认还有 `contents`，用来不打乱父级 flex |
| `drawerClassName` | 仅抽屉面板 | 加在抽屉根上。被盖住或让位时组件还会禁止指针。看不见靠内容区的内联样式，不靠 `invisible` |
| `drawerStyle` | 仅抽屉 | 传给抽屉的 `contentStyle`。让位、被盖住，或从列表打开时，组件会在这份样式上盖住透明度、过渡和滑入距离 |

按钮用载荷里的 `word` 或 `english` 判断「再点一次是关闭」。两者都是字符串时优先 `word`。比较前会去掉首尾空白、把连续空白收成一个空格、忽略大小写。两个字段都没有，或收成空串时，再点一次是再次打开。载荷里有 `word` 或 `english` 但收成空串时，按钮禁用。

转圈只看 `payload.word` 是非空字符串，并且该插件对这个词写过 `pending.on === true`。只有 `english` 的语句卡不会转圈。

### 9.4 `usePointContext` 与 `publishPointContext`

```ts
usePointContext(pointId: string, data: Record<string, unknown> | null): void
publishPointContext(pointId: string, data: Record<string, unknown> | null): void
```

| 参数 | 含义 |
| --- | --- |
| `pointId` | 目录里的点 id。未登记的点直接返回，不通知插件 |
| `data` | 页面当前上下文。`null` 表示离开或还没有可发布的值。对象里只保留 `contextKeys` 中、值不是 `null` / `undefined` / `''` 的键 |

`usePointContext` 用 `JSON.stringify(data)` 判断有没有变化，内容相同不会重复发布。组件卸载时再发布一次 `null`。页面不要把还没裁剪的整份业务对象塞进来指望插件能读到，名单外的键会被丢掉。词库在调用前先 `libraryId?.trim() ?? ''`，空串会变成不发布。

### 9.5 `openPoint`、`closePoint` 和槽会话

```ts
openPoint(
  pointId: string,
  pluginId: string,
  slot: string,
  payload: Record<string, unknown>,
): boolean

closePoint(pointId: string, slot: string): void
```

| 参数 | 含义 |
| --- | --- |
| `pointId` | 目录里的点 |
| `pluginId` | 注册表里的插件 id。必须已启用，并且 `host.surface` 是这个点。`host.slot` 要么就是要打开的抽屉槽，要么是 `opens` 指向该抽屉的按钮槽 |
| `slot` | 要打开或关闭的槽名，动作按钮这里传的是抽屉槽，不是按钮槽 |
| `payload` | 冷启动载荷。插件还没下载也会先记下。浅拷贝 |

`openPoint` 返回 `false` 的情况：点或槽不在目录里，插件未启用，或 `host.slot` 对不上。返回 `true` 只表示会话已经写下。后一次打开盖住前一次的插件 id 和载荷。

`closePoint` 把该槽收成 `pluginId: null`、`open: false`、`payload: null`、`covered: false`。本来就是这个状态时不再通知。若这个槽的 `covers` 盖着别的抽屉，只揭开那一层。

插件和页面读到的槽会话是：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `pluginId` | `string \| null` | 当前打开的插件。关闭后是 `null` |
| `open` | `boolean` | 抽屉是否逻辑上开着。被盖住时仍为 `true` |
| `payload` | `Record<string, unknown> \| null` | 打开时写入的载荷。`getPayload` 再浅拷贝一份；关闭后是 `null` |
| `covered` | `boolean` | 被另一个槽盖住。界面不可见，载荷还在 |

没开过的槽读到同一份冻结空会话：四项分别是 `null`、`false`、`null`、`false`。

### 9.6 `bindPointCommand`

```ts
bindPointCommand(
  pointId: string,
  name: string,
  fn: (arg: unknown) => unknown,
): () => void
```

| 参数 | 含义 |
| --- | --- |
| `pointId` | 命令属于哪个点。词卡的 `play` 不会出现在词库上 |
| `name` | 必须先出现在该点的 `commands` 里。绑定本身不检查名单，检查发生在插件调用 `command` 时 |
| `fn` | 插件传入的 `arg` 原样进来。返回值原样交回插件，可以是 `Promise` |

返回的函数只删除这一次注册的 `fn`。清理跑晚了、中间已经换成新实现时，不会把新的删掉。同点同名再次绑定会盖住旧实现。

### 9.7 `api.modules.point`

点 id 不在参数里。插件换 `host.surface` 才会换到另一个点。

`getContext(): Record<string, unknown> | null`

无参数。没发布过、已清空、或过滤后没有有效键时返回 `null`。有值时是浅拷贝。

`getPayload(slot: string): Record<string, unknown> | null`

| 参数 | 含义 |
| --- | --- |
| `slot` | 抽屉槽名，例如 `drawer`、`item-drawer`、`import-drawer`。传按钮槽名会读到 `null`，因为载荷写在 `opens` 指向的槽上 |

槽没开、已关闭、或载荷为空时返回 `null`。有值时是浅拷贝。

`subscribe(listener: () => void): () => void`

| 参数 | 含义 |
| --- | --- |
| `listener` | 无参数。这个点的上下文变了，或任意槽开关、被盖住、揭开时调用。自己 `publishSignal` 不会调用它 |

返回退订函数。组件卸载时要调用，否则离开页面后仍会收到回调。

`publishSignal(name: string, value: unknown): void`

| 参数 | 含义 |
| --- | --- |
| `name` | `'pending'` 或 `'stats'`，并且要写在该点 `signals` 里。其它名字直接返回，不抛错 |
| `value` | 见下一节。形状不对时整次丢掉，不抛错，也不覆盖上一份有效值 |

`command(name: string, arg: unknown): unknown`

| 参数 | 含义 |
| --- | --- |
| `name` | 目录 `commands` 里的名字 |
| `arg` | 必须传。没有业务参数时传 `undefined`。类型是 `unknown`，漏传会在插件自己的类型检查里失败 |

返回值由具体命令决定。`UNKNOWN_POINT_COMMAND` 表示名字不在目录里。`POINT_COMMAND_UNBOUND` 表示名字合法，但当前没有绑定。

### 9.8 `pending` 与 `stats` 的值

`publishSignal('pending', value)` 要求 `value` 同时满足：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `pluginId` | `string` | 注册表插件 id。缺了或不是字符串，整次丢掉 |
| `key` | `string` | 和按钮载荷里的 `word` 对应。会先去掉首尾空白、压缩中间空白、忽略大小写。`Apple` 和 `apple` 是同一个键 |
| `on` | `boolean` | `true` 开始转圈，`false` 停止。省略、`1`、`'true'` 都丢掉 |

键按「点 + 插件 + 词」分开。同一词上两个插件互不影响。关抽屉不清这张表。重复写同一个 `on` 不会再通知界面。

`publishSignal('stats', value)`：

| 值 | 结果 |
| --- | --- |
| `null` 或 `undefined` | 清掉这份统计。本来就没有时不再通知 |
| `{ total, loaded }` | 两个都要能转成有限数字。字符串数字可以。缺字段、`NaN`、`Infinity` 整份丢掉，保留上一份。小数向下取整，负数变成 `0`。其它字段不进顶栏 |

页面用 `readStats(pointId)` 读 `{ total, loaded } | null`。每次调用都是新对象。

### 9.9 已经登记的命令

插件调用时第二个参数照下表传。实现在主项目里，插件只按名字调用。

| 点 | 命令 | `arg` | 返回值 |
| --- | --- | --- | --- |
| `english.vocab.card` | `play` | 词字符串，或 `{ word: string }`。其它形状当成空词 | 空词：已完成的 `Promise`。有词：朗读的 `Promise` |
| `english.vocab.card` | `stop` | 忽略，传 `undefined` | `undefined`。停掉当前正在播的声音 |
| `english.vocab.library` | `pickJsonFile` | 忽略，传 `undefined` | 选中的 JSON 文件；取消是 `null`。选了非 JSON 会抛错，由插件接 |
| `english.vocab.library` | `openCard` | 与 `play` 相同 | `boolean`。空词，或词卡详解插件未启用，为 `false`。只打开，不切换关闭 |
| `ebook.read` | `navigateToCfi` | CFI 字符串。不是字符串时按空串处理 | 由阅读页实现决定 |
| `ebook.read` | `openThought` | 想法对象。不是对象时直接返回 | 由阅读页实现决定 |
| `ebook.read` | `closeIdeasList` | `undefined` | 关掉阅读页当前打开的插件抽屉 |

这些命令只在对应的点上存在。在别的点调用会抛 `UNKNOWN_POINT_COMMAND`。阅读页三条只在 EPUB 且页面还挂着时有绑定，PDF 上调用会抛 `POINT_COMMAND_UNBOUND`。

### 9.10 当前各点的上下文和载荷

上下文（`getContext()`）：

| 点 | 字段 | 页面实际写入 |
| --- | --- | --- |
| `english.vocab.library` | `libraryId` | 去掉首尾空白后的词库 id。还没选库时是 `null` |
| `english.classic.library` | `libraryId` | 语句库 id。没有时是 `null` |
| `english.mistakes`、`english.review`、`english.favorites` | `kind` | `'vocab'` 或 `'classic'` |
| `english.dailyReading` | `origin` | 当前列表来源，例如按日或手动 |
| `ebook.read` | `bookId`、`bookTitle` | 仅 EPUB。PDF 或离开阅读页是 `null` |
| `english.vocab.card`、`english.classic.card` | 无 | 始终没有页面上下文。词在载荷里 |

载荷（`getPayload(抽屉槽)`）：

| 打开方式 | 抽屉槽 | 字段 |
| --- | --- | --- |
| 单词卡 `card-action`，以及词库/错题/复习/收藏行上的单词 `item-action` | 词卡是 `drawer`；词库行是 `item-drawer`；错题等列表点是 `drawer` | `word`、`pos`、`ipa`、`translationZh`、`example`。后四个可以是 `null` |
| 语句卡 `card-action`，以及语句列表行 `item-action` | 同上规则，语句库行是 `item-drawer` | `english`、`translationZh`、`source`、`noteZh`。后两个可以是 `null` |
| 词库、语句库卡片上的 `library-card-action` | `import-drawer` | `libraryId`、`title` |
| 每日阅读行 `item-action` | `drawer` | `id`、`titleEn`、`publishDate`、`origin` |
| 词库列表按钮（页面自己打开） | `drawer` | `{}`。列表认的是 `getContext()` 里的 `libraryId`，不在载荷里 |
| `openCard` | 词卡 `drawer` | `{ word, source: 'list' }` |

同一插件、同一 `word` 或 `english` 再点一次会关闭。`openCard` 不走这条切换，它只打开。

### 9.11 注册表

内嵌插件至少要有这些字段。`host` 缺了或 `surface` 对不上目录时，没有 `api.modules.point`。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | `string` | 插件 id。`openPoint` 的 `pluginId`、`pending.pluginId` 都用它 |
| `title` | `{ "zh-CN"?: string; "en-US"?: string }` | 按钮的无障碍名称和抽屉标题。缺省时用 `id` |
| `description` | `string` 或同 `title` 的多语言对象 | 插件中心描述。不参与页面挂载 |
| `routePath` | `string` | 注册表要求有。内嵌插件把 `injectRoute` 设为 `false` 后，不会因此多一条顶层业务路由 |
| `entry` | `string` | 远程 `mf-manifest.json` 地址 |
| `version` | `string` | 插件版本 |
| `hostApiRange` | `string` | 与主项目宿主 API 版本匹配的范围。当前写 `^1.0.0` |
| `injectRoute` | `boolean` | 缺省 `true`。页面内嵌插件必须写 `false` |
| `host.surface` | `string` | 等于目录点 id |
| `host.slot` | `string` | 等于该点某个槽的 `name`。按钮插件写按钮槽，这样同一个插件会画进 `opens` 指向的抽屉 |
| `host.icon` | `string` 可选 | 按钮图标名。没有时按钮仍在，只是没有对应图标 |
| `host.order` | `number` 可选 | 同一槽上多个插件的顺序 |
| `permissions` | `string[]` | 必须含 `modules:point`。还可以有 `ui:toast`、`http:plugin-api` 等通用能力，那些不在 `modules.point` 上 |
| `enabled` | `boolean` | 注册表总开关。还要在插件中心对当前账号打开 |
| `trust` | `'first-party' \| 'partner' \| 'untrusted'` | 信任级别。影响隔离方式，不决定能挂哪个点 |
| `framework` | `'react' \| 'vue'` 可选 | 远程框架。不写按现有加载约定 |
| `preload` | `'eager' \| 'route' \| 'idle'` 可选 | 何时预加载远程包。不写则按注册表缺省 |
| `remoteName`、`expose` | `string` 可选 | 模块联邦远程名和导出名。与页面挂载槽无关 |
| `iframeUrl` | `string` 可选 | 不可信 iframe 地址。阅读页 iframe 仍要 `modules:point`，并且 `host.surface` 为 `ebook.read` |

改完 `plugins-registry.json` 后重新拉取。开发环境缓存键是 `dnhyxc.plugin.registry.dev.v1`。

## 10. 从零开始的完整示例

这一节按操作顺序写。每一步先说要改哪个文件、为什么要改，再给出带注释的代码。注释写的是这行在运行时做什么。仓库里目前没有 `english.practice`，下面的文件都要你自己加上。

做完后打开 `http://localhost:9002/english-learning/plugin-demo`。页面上有一个切换「vocab / classic」的按钮、一块顶栏插件、两行标题和每行一枚插件按钮。点行按钮打开右侧抽屉，抽屉里可以让这一行变成已完成。

路径用 `plugin-demo`，不要用 `practice`。`/english-learning/practice` 已经是练习功能自己的页面。

### 10.1 先分清三份数据

后面的代码反复出现这三个名字，先对上再往下看。

| 名字 | 谁写入 | 谁读取 | 本例里的值 |
| --- | --- | --- | --- |
| 上下文 `kind` | 练习页 `usePointContext` | 插件 `getContext()` | `'vocab'` 或 `'classic'`，整页只有一份，换行不变 |
| 载荷 `payload` | 行上的 `HostPoint` 在点击时写入 | 插件 `getPayload('drawer')` | `{ id: '1', title: 'apple' }`，每一行不同 |
| 命令 `markDone` | 练习页 `bindPointCommand` 提供实现 | 插件 `command('markDone', id)` | 参数是这一行的 `id`，返回 `true` 或 `false` |

`listPoint` 的第二个参数 `['kind']` 只是声明「上下文里允许出现名为 kind 的字段」。它不是槽类型，也不是每个点都要传 `kind`。错题集用 `kind`，每日阅读用 `origin`，词库用 `libraryId`。这个练习页如果没有整页状态，第二个参数写 `[]`，同时删掉页面里的 `usePointContext`。

### 10.2 第一步：在目录里登记这个点

文件：`apps/frontend/src/federation/points/catalog.ts`。

这一步只是声明。不改这里，后面的 `HostPoint` 和插件都对不上名字，页面上什么都不会出现。

在 `POINT` 对象里加一行。`practice` 是主项目代码里的短名字，`'english.practice'` 才是注册表 `host.surface` 必须逐字相等的 id。

```ts
export const POINT = {
	// 已有的 vocabCard、ebookRead 等保持不动。practice 是代码里的短名
	practice: 'english.practice',
	// as const 让 POINT.practice 的类型是字面量 'english.practice'，写错 surface 时能被类型检查发现
} as const;
```

在 `hostPoints` 对象里加一项。`listPoint` 会生成三个槽，第二个参数是上下文白名单：

```ts
[POINT.practice]: {
	// 展开后得到 toolbar、item-action（opens 为 drawer）、drawer，以及 contextKeys: ['kind']
	// 第二个参数只声明字段名 kind。页面 usePointContext 必须传 { kind }，插件读 getContext().kind
	...listPoint(POINT.practice, ['kind']),
	// 覆盖 listPoint 自带的空 commands。没有这一行时，插件调用 markDone 会抛 UNKNOWN_POINT_COMMAND
	commands: ['markDone'],
},
```

三个槽分别是：

- `toolbar`：顶栏区域。插件注册表 `host.slot` 写 `toolbar` 才会出现在这里。
- `item-action`：每一行末尾的按钮。插件注册表 `host.slot` 写 `item-action`。按钮本身由主项目画，插件组件画的是抽屉里的内容。
- `drawer`：右侧抽屉。点击行按钮时，主项目把这一行的 `payload` 记到这个槽上。插件读载荷时参数写 `'drawer'`。

`drawer` 没有写 `layout.page`，所以不用在练习页里再放一个抽屉组件。英语学习的 `Layout.tsx` 会扫描目录，自己把这个抽屉挂上，离开 `/english-learning` 时关掉。这一步不要改 `Layout.tsx`。

### 10.3 第二步：写练习页

新建 `apps/frontend/src/views/englishLearning/pluginDemo/List.tsx`。

这个文件做三件事：把当前种类交给插件、在顶栏和每一行放上入口、在用户还停在本页时实现 `markDone`。

```tsx
import { useEffect, useState } from 'react';
import {
	// 把 markDone 的函数注册到 english.practice，插件 command 会调到它
	bindPointCommand,
	// 按目录槽位画出顶栏或行按钮；本页不负责画抽屉
	HostPoint,
	// 上一步在 catalog.ts 里加的 id
	POINT,
	// 把 { kind } 交给这个点，离开页面时自动改成 null
	usePointContext,
} from '@/federation';

// 教学数据。接真实列表时换成接口返回的行，字段名仍要和下面的 payload 一致
const ITEMS = [
	{ id: '1', title: 'apple' },
	{ id: '2', title: 'river' },
];

export default function PluginDemoList() {
	// 整页只有一个种类。切换它会让所有插件的 getContext().kind 一起变
	const [kind, setKind] = useState<'vocab' | 'classic'>('vocab');
	// 已经标记完成的行 id。存在页面上，刷新或离开后会丢，这是本例故意的
	const [done, setDone] = useState<string[]>([]);
	// 第二个参数的键必须叫 kind，因为目录白名单写的是 ['kind']
	usePointContext(POINT.practice, { kind });

	useEffect(() => {
		// 返回值是解绑函数。组件卸载时 React 会调用它，之后插件再调 markDone 会得到 POINT_COMMAND_UNBOUND
		return bindPointCommand(POINT.practice, 'markDone', (arg) => {
			// 插件传来的 arg 类型是 unknown，先确认是非空字符串
			const id = typeof arg === 'string' ? arg.trim() : '';
			// false 会原样回到插件的 command 返回值，插件据此知道没标记成功
			if (!id) return false;
			// 已有的 id 不重复追加
			setDone((prev) => (prev.includes(id) ? prev : [...prev, id]));
			return true;
		});
	}, []);

	return (
		<div className="flex h-full min-h-0 flex-col gap-3 p-4">
			<div className="flex items-center justify-between gap-3">
				<button
					type="button"
					onClick={() =>
						setKind((prev) => (prev === 'vocab' ? 'classic' : 'vocab'))
					}
				>
					{kind}
				</button>
				{/* 没有启用 slot=toolbar 的插件时，这里是空的，不占高度以外的按钮 */}
				<HostPoint pointId={POINT.practice} slot="toolbar" />
			</div>
			<ul className="flex flex-col gap-2">
				{ITEMS.map((item) => (
					<li key={item.id} className="flex items-center gap-2">
						<span>
							{item.title}
							{done.includes(item.id) ? ' · done' : ''}
						</span>
						{/* 点击后主项目把 payload 写入 drawer 槽，并打开抽屉。插件稍后用 getPayload('drawer') 读这份对象 */}
						<HostPoint
							pointId={POINT.practice}
							slot="item-action"
							payload={{ id: item.id, title: item.title }}
						/>
					</li>
				))}
			</ul>
		</div>
	);
}
```

`payload` 里只有 `id` 和 `title`，没有 `word` 或 `english`。所以再点同一行会再次打开，不会把抽屉关掉。单词卡那种「再点一次关闭」依赖载荷里的 `word` 或 `english`。

这一页还没有抽屉组件。抽屉由英语学习布局根据目录挂上。

### 10.4 第三步：把页面挂进英语学习路由

文件：`apps/frontend/src/router/routes.ts`。

必须挂在 `path: '/english-learning'` 的 `children` 里。这个父路由的组件是 `EnglishLearningLayout`，离开它才会统一关抽屉。挂到别的父级下，行按钮可以出现，但右侧抽屉不会被布局挂出来。

文件顶部其它 `lazy` 附近加：

```ts
const EnglishPluginDemoPage = lazy(
	() => import('@/views/englishLearning/pluginDemo/List'),
);
```

在 `/english-learning` 的 `children` 数组里加一条。放在 `path: 'practice'` 那条旁边即可，不要嵌进 `practice` 的 `children`：

```ts
{
	path: 'plugin-demo',
	Component: EnglishPluginDemoPage,
	meta: {
		titleKey: 'route.englishLearning.title',
	},
},
```

浏览器地址是 `/english-learning/plugin-demo`。此时还没有插件，页面上只有种类按钮和两行标题，这是正常的。

### 10.5 第四步：写顶栏插件

插件仓库新建 `src/views/practice-toolbar/index.tsx`。

主项目渲染顶栏时，会把宿主桥 `api` 传给这个组件的 props。`api.modules.point` 只有在注册表声明了 `modules:point`、并且 `host.surface` 是 `english.practice` 时才存在。

```tsx
import { useEffect, useState } from 'react';

// 与主项目 createPointApi 的五个方法一致。第二个参数必须写上，没有业务参数时调用方传 undefined
type PointModule = {
	getContext: () => Record<string, unknown> | null;
	getPayload: (slot: string) => Record<string, unknown> | null;
	subscribe: (listener: () => void) => () => void;
	publishSignal: (name: string, value: unknown) => void;
	command: (name: string, arg: unknown) => unknown;
};

type Props = {
	api: { modules?: { point?: PointModule } };
};

export default function PracticeToolbar({ api }: Props) {
	const point = api.modules?.point;
	const [kind, setKind] = useState('');

	useEffect(() => {
		if (!point) return;
		const read = () => {
			// 页面 usePointContext 发布的对象。键被目录限制成只有 kind
			const ctx = point.getContext();
			// 页面还没发布、已经离开，或 kind 不是字符串时显示空
			setKind(typeof ctx?.kind === 'string' ? ctx.kind : '');
		};
		// 先读一次当前值，否则要等下一次种类变化才有字
		read();
		// 种类变化时 read 会再跑。返回的函数在组件卸载时退订
		return point.subscribe(read);
	}, [point]);

	// 权限或 surface 不对时没有 point，顶栏留空，避免画出「练习：」却永远没有种类
	if (!point) return null;
	return <span>练习：{kind || '…'}</span>;
}
```

顶栏插件不调用 `getPayload`。点击某一行不会改变 `kind`。

`vite.config.ts` 的 `federation({ exposes })` 里加一行。键名要带 `./`，值是这个文件：

```ts
'./PracticeToolbar': './src/views/practice-toolbar/index.tsx',
```

### 10.6 第五步：登记顶栏插件

在 `plugins-registry.json` 的 `plugins` 数组里加对象。开发环境文件在主项目 `apps/backend/uploads/remotes/plugins-registry.json`。保存后到插件中心重新拉取；仍是旧清单时清掉浏览器里的 `dnhyxc.plugin.registry.dev.v1`。

```json
{
  "id": "practiceToolbar",
  "title": { "zh-CN": "练习顶栏", "en-US": "Practice toolbar" },
  "routePath": "/plugins/practice-toolbar",
  "entry": "http://127.0.0.1:9008/mf-manifest.json",
  "expose": "./PracticeToolbar",
  "remoteName": "dnhyxc-ai-practice-toolbar",
  "version": "0.0.1",
  "hostApiRange": "^1.0.0",
  "injectRoute": false,
  "host": {
    "surface": "english.practice",
    "slot": "toolbar"
  },
  "permissions": ["modules:point"],
  "enabled": false,
  "trust": "first-party"
}
```

这几个字段决定它能不能出现在顶栏：

| 字段 | 本例为什么这样写 |
| --- | --- |
| `entry` | 插件开发服务打出的清单地址。进程没开或端口不是 9008 时，顶栏会一直加载失败 |
| `expose` | 必须等于 vite `exposes` 的键 `./PracticeToolbar`。主项目靠它加载刚才那个组件 |
| `remoteName` | 同一份 manifest 里每个插件各用一个名字。不写就用 `id`，两个插件都省略时可能撞车 |
| `injectRoute` | `false` 表示不要再占一条独立业务路由。页面内嵌插件都写 false |
| `host.surface` | 必须等于目录里的 `english.practice`。写错就没有 `api.modules.point` |
| `host.slot` | `toolbar` 才会被练习页那个 `<HostPoint slot="toolbar" />` 画出来 |
| `permissions` | 含 `modules:point` 才会下发五个方法 |
| `enabled` | 先 false。到插件中心打开后才渲染 |

启用后刷新 `/english-learning/plugin-demo`。顶栏应出现「练习：vocab」。点页面上的种类按钮，文字变成「练习：classic」。行上仍然没有按钮，因为还没登记行插件。

### 10.7 第六步：写行按钮对应的抽屉组件

插件仓库新建 `src/views/practice-note/index.tsx`。

注册表里这个插件的 `host.slot` 将写成 `item-action`。主项目只借用这个插件的图标画按钮。抽屉打开后，主项目把**同一个组件**放进抽屉。所以这个文件画的是抽屉内容，不是那枚小按钮。

```tsx
import { useEffect, useState } from 'react';

type PointModule = {
	getContext: () => Record<string, unknown> | null;
	getPayload: (slot: string) => Record<string, unknown> | null;
	subscribe: (listener: () => void) => () => void;
	publishSignal: (name: string, value: unknown) => void;
	command: (name: string, arg: unknown) => unknown;
};

type Props = {
	api: { modules?: { point?: PointModule } };
};

export default function PracticeNote({ api }: Props) {
	const point = api.modules?.point;
	const [title, setTitle] = useState('');
	const [id, setId] = useState('');
	const [kind, setKind] = useState('');
	const [marked, setMarked] = useState(false);

	useEffect(() => {
		if (!point) return;
		const read = () => {
			// 参数是抽屉槽名 drawer，不是按钮槽名 item-action。载荷是点击那一行的 { id, title }
			const payload = point.getPayload('drawer');
			const ctx = point.getContext();
			setId(typeof payload?.id === 'string' ? payload.id : '');
			setTitle(typeof payload?.title === 'string' ? payload.title : '');
			setKind(typeof ctx?.kind === 'string' ? ctx.kind : '');
		};
		read();
		// 换一行打开、或页面切换 kind 时都会再读
		return point.subscribe(read);
	}, [point]);

	if (!point) return null;
	return (
		<div className="flex flex-col gap-3 p-4">
			<p>{title || '还没有打开某一行'}</p>
			<p>当前种类：{kind || '…'}</p>
			<button
				type="button"
				disabled={!id}
				onClick={() => {
					// 第二个参数是这一行的 id。页面上的 bindPointCommand 收到后写入 done
					// 比较 === true，是因为未绑定会抛错，空 id 时页面返回 false
					const ok = point.command('markDone', id) === true;
					setMarked(ok);
				}}
			>
				{marked ? '已标记' : '标记完成'}
			</button>
		</div>
	);
}
```

`vite.config.ts` 的 `exposes` 再加：

```ts
'./PracticeNote': './src/views/practice-note/index.tsx',
```

### 10.8 第七步：登记行插件

`plugins-registry.json` 再加一条。和顶栏插件的差别只在 `id`、`expose`、`remoteName`、`host.slot` 和 `icon`。

```json
{
  "id": "practiceNote",
  "title": { "zh-CN": "练习笔记", "en-US": "Practice note" },
  "routePath": "/plugins/practice-note",
  "entry": "http://127.0.0.1:9008/mf-manifest.json",
  "expose": "./PracticeNote",
  "remoteName": "dnhyxc-ai-practice-note",
  "version": "0.0.1",
  "hostApiRange": "^1.0.0",
  "injectRoute": false,
  "host": {
    "surface": "english.practice",
    "slot": "item-action",
    "icon": "notebook"
  },
  "permissions": ["modules:point"],
  "enabled": false,
  "trust": "first-party"
}
```

`host.slot` 必须是 `item-action`。写成 `drawer` 时，行上不会出现按钮，因为练习页只在 `item-action` 这个槽上放了 `HostPoint`。`icon` 没有对应图标时按钮仍在，只是图标为空。`title` 会成为按钮的无障碍名称和抽屉标题。

重新拉取注册表并在插件中心启用 `practiceNote`。每一行标题右侧出现一枚按钮。点第一行，右侧抽屉标题是「练习笔记」，正文是 `apple` 和当前种类。点「标记完成」，这一行标题后出现 ` · done`，按钮文字变成「已标记」。

### 10.9 对照：点一次按钮之后发生了什么

1. 练习页把 `<HostPoint slot="item-action" payload={{ id: '1', title: 'apple' }} />` 放在第一行。
2. 主项目找出 `host.surface === 'english.practice'` 且 `host.slot === 'item-action'` 的已启用插件，这里是 `practiceNote`，画出它的图标按钮。
3. 点击时，目录规定 `item-action` 的 `opens` 是 `drawer`，于是把 `{ id: '1', title: 'apple' }` 记到 `english.practice` 的 `drawer` 槽，并记下插件 id `practiceNote`。
4. 英语学习布局里已经挂着这个 `drawer` 的 `HostPoint`。它看到槽打开了，就把 `practiceNote` 的组件放进右侧抽屉。
5. 组件里的 `subscribe` 触发，`getPayload('drawer')` 得到这份载荷，`getContext()` 得到 `{ kind: 'vocab' }`。
6. 点「标记完成」调用 `command('markDone', '1')`。目录允许这个名字，页面 effect 里的函数还在，于是 `done` 里加入 `'1'`，页面那一行重新渲染出 `done`。

插件下载完成之前就点击，第 3 步的载荷已经记下。组件稍后挂上时，第 5 步仍能读到 `apple`。

### 10.10 做完后逐项看

1. 两个插件都关闭：只有种类按钮和两行字，没有顶栏文字，没有行按钮。
2. 只开 `practiceToolbar`：顶栏是「练习：vocab」。切换种类后变成 `classic`。没有行按钮。
3. 再开 `practiceNote`：每行有按钮。打开第一行，抽屉正文是 `apple`，种类与顶栏相同。
4. 点「标记完成」：该行出现 ` · done`，抽屉按钮变成「已标记」。
5. 离开 `/english-learning` 再进入：`done` 清空，因为那份状态在页面组件里。顶栏在页面重新发布 `kind` 后恢复。
6. 把 `practiceNote` 的 `host.slot` 改成 `drawer` 并重新拉取：行按钮消失。改回 `item-action` 后恢复。
7. 从目录的 `commands` 里去掉 `markDone`：点击标记时插件抛 `UNKNOWN_POINT_COMMAND`。目录保留名字、但已经离开页面：抛 `POINT_COMMAND_UNBOUND`。

## 11. 已经接上的三个插件

第 10 节的练习页没有落地。下面三个是仓库里正在用的页面插件，各自代表一种接法。目录字段的逐项说明仍在第 2 节，这里不重复抄一遍目录，只讲这些字段在主项目和插件里怎么对上。

| 插件 id | 接法 | `host.surface` | `host.slot` | 插件正文 |
| --- | --- | --- | --- | --- |
| `vocabDetail` | 卡片角落一枚按钮，打开持久抽屉。生成时按钮转圈，抽屉里可以朗读 | `english.vocab.card` | `card-action` | `src/views/vocab-detail/panel.tsx` |
| `vocabDetailList` | 词库页自己打开整库列表抽屉。标题上的条数由插件写回，点词再打开详解 | `english.vocab.library` | `drawer` | `src/views/vocab-detail-list/list.tsx` |
| `vocabDetailImport` | 词库卡片上的第二枚按钮，打开不锁焦点的导入抽屉。详解开着时这层只藏起来 | `english.vocab.library` | `library-card-action` | `src/views/vocab-detail-import/panel.tsx` |

三个插件打在同一份 `mf-manifest.json` 里，所以 `remoteName` 必须各不相同。`expose` 必须等于 vite 的 `exposes` 键。`injectRoute` 都是 `false`，不占独立业务路由。`permissions` 都含 `modules:point`。详解和导入还要请求后端、弹 Toast，所以再加 `http:plugin-api` 和 `ui:toast`。列表只读列表接口，同样带了这两项。`enabled` 先是 `false`，到插件中心打开后入口才出现。

vite 里对应的三行：

```ts
'./VocabDetail': './src/views/vocab-detail/index.ts',
'./VocabDetailList': './src/views/vocab-detail-list/index.ts',
'./VocabDetailImport': './src/views/vocab-detail-import/index.ts',
```

`index.ts` 只做两件事：引进插件自己的样式，再把面板当默认导出。主项目加载的是这个文件，不是 `panel.tsx`。样式不在这里引的话，抽屉里的类名没有插件侧的 Tailwind。

### 11.1 主项目：布局负责把抽屉挂上，也负责离开时关掉

`Layout.tsx` 全文在 11.9。它不认识 `vocabDetail` 这三个 id。

- `Outlet` 是英语学习下面的各个页面。词卡、词库列表都画在这里。
- `layoutDrawerSlots` 把目录里每只抽屉摊平，按 `layout.order` 排序，没写的按 2。`layout.page === true` 的槽布局不渲染 `HostPoint`。词库的列表抽屉就是这种，所以「单词解析」按钮和抽屉标题在词库页里。词卡抽屉、行详情 `item-drawer`、导入抽屉没有 `page`，由布局挂上。`order: 0` 的导入先挂，在下层；`order: 1` 的词卡后挂，在上层。
- 离开英语学习时，对每一只布局抽屉 `closePoint`，包括标了 `page` 的列表抽屉。子页之间切换不跑这段清理，已经打开的词还在。
- 同一段清理旁边还有停朗读。那是英语页自己的行为，不是扩展点协议。

### 11.2 主项目：不依赖某一页 state 的命令

`points/commands.ts` 全文在 11.9，文件里每一行已经写了注释。这里只讲这三个插件为什么走这里，而不是页面里的 `bindPointCommand`。

朗读、选文件、从列表打开详解，都不闭包某一页的 React state。应用启动时注册一次，插件随时能调。

- `play` / `stop` 挂在 `english.vocab.card`。详解插件不能自己调主站 TTS。`play` 接受一段要朗读的字符串，或带 `word` 字段的对象。详解里点单词、点例句，传的都是字符串，所以例句也能读。空白字符串返回一个已完成的 Promise，插件不会把它当成播放失败。音频进 `TTS_CACHE_FOLDER.vocabDetail`，不和语句、练习混在一起。`stop` 停掉当前正在播的所有声音。再点同一段、换词、组件卸载时，插件都会调它。
- `pickJsonFile` 挂在 `english.vocab.library`。导入插件在联邦沙箱里弹不出主站的系统文件框。取消得到 `null`。选了非 `.json` 会抛 `accept`，插件自己把这句话显示成「文件不对」。
- `openCard` 也挂在词库点，但 `openPoint` 的目标是 **词卡点** 的 `drawer`，插件 id 写死 `vocabDetail`。列表插件和导入插件都调这一个命令，所以都会带上 `source: 'list'`。详解看到这个来源就不从右侧滑入。空词，或详解插件没启用、槽位对不上，返回 `false`。插件用 `=== true` 判断。这条命令只打开，不会再点一次关掉。

页面生命周期才有的命令不要学它们写进这个文件。阅读页的 `navigateToCfi` 就是反例：必须在阅读页 effect 里 `bindPointCommand`，离开页面解绑。

### 11.3 主项目：词卡上的两枚插件按钮

`CardActionButtons` 全文在 11.9。词卡组件把当前词收成一份载荷：

- `word` 必有。主项目用它判断「同一个词再点一次是关闭」，也用它匹配 `pending` 转圈。
- `pos`、`ipa`、`translationZh`、`example` 给详解头部。插件缺了这些字段会再请求，但载荷里有就可以先画。
- 这里不写 `source`。从词卡按钮打开时，插件把来源收成 `card`。只有 `openCard` 会写成 `list`。

两枚 `HostPoint` 的差别：

- `pointId={POINT.vocabCard}`、`slot="card-action"`。目录规定这个按钮打开词卡自己的 `drawer`。已启用且 `host.slot` 为 `card-action` 的插件会出现，现在就是 `vocabDetail`。点击由 `HostPoint` 写会话，插件组件不负责画这枚按钮。
- `pagePointId` 有值时再挂一枚 `slot="item-action"`。词库页把 `pagePointId` 设成 `POINT.vocabLibrary`。这枚按钮打开的是词库的 `item-drawer`，不是整库列表那个 `drawer`。所以词条上的插件不会把「单词解析」列表顶掉。语句卡用的是另一份 `Card`，点 id 是语句库，和这三个插件无关。

### 11.4 主项目：词库卡片上的导入按钮

`LibraryListPanel` 里和导入有关的是这两处，片段在 11.9。

- `useHostSurfacePlugins` 取当前是单词库还是语句库，再滤出 `host.slot === 'library-card-action'` 的插件。一个都没有，`showImport` 为 false，卡片上不留空位。
- `showImport = showEdit && cardActionPlugins.length > 0`。`showEdit` 表示这张库可以改。不能改的库不给导入入口。
- 渲染时 `pointId` 按 `kind` 选词库或语句库，`slot` 固定 `library-card-action`，`payload` 是 `{ libraryId, title }`。点击后这份载荷写进该点的 `import-drawer`。单词库上对上的插件是 `vocabDetailImport`。语句库目前没有插件登记在这个槽，按钮不会出现。
- 外层 `span` 把点击和按下停掉，避免点导入按钮时把整张库卡片选中。

导入抽屉本身不在这个文件里画。它由 `Layout` 里的 `HostPoint` 按目录挂上。`modal: false` 所以不锁焦点；`yieldTo` 指向词卡抽屉，详解开着时导入面板同一帧透明，会话还在。

### 11.5 主项目：词库页自己打开单词解析列表

列表抽屉标了 `layout.page: true`，布局不画它。`VocabularyLibrarySection` 里和插件有关的代码在 11.9。词条怎么分页、怎么收藏，不是扩展点，不收进这一节。

- `usePointContext(POINT.vocabLibrary, { libraryId })`。`libraryId` 先 trim，空字符串就传 `null`。列表插件的 `getContext().libraryId` 只可能来自这里。换库或离开这段时，上下文会更新或变成 `null`。
- 订阅词卡 `drawer`。`detailOpen = open && !covered`。列表打开时目录的 `covers` 会把词卡标成 `covered`，这时 `detailOpen` 是 false，列表保持可见。从列表点词后 `openCard` 把词卡重新设为打开且未覆盖，`detailOpen` 变成 true，列表才让开。
- `listPlugin` 在词库点上找 `host.slot === 'drawer'` 的插件。没有启用 `vocabDetailList` 就不画顶栏那个「单词解析」按钮。
- 统计不用 `useSyncExternalStore(readStats)`。`readStats` 每次返回新对象，那样会循环渲染。这里是 `useState` 加上 `subscribeSignals`，插件 `publishSignal('stats', …)` 之后标题上的「共 N / 已加载 M」才会变。
- 点「单词解析」：已经开着就 `closePoint` 并清掉 `openPluginId`。要打开时 `openPoint(POINT.vocabLibrary, listPlugin.id, 'drawer', {})`。载荷是空对象，库 id 走上下文，不走载荷。如果词卡详解当时已经开着，`setListStill(true)`，列表不再从右侧滑入。
- `PluginHostSurface` 的 `surface` 是 `english.vocab.library`，`part` 是 `drawer`。这只抽屉的开关由页面的 `openPluginId` 管。用户点遮罩关掉时，回调里再 `closePoint`。`tucked` 为真（列表开着且详解在最上面）时，面板透明度写成 0、动画关掉、遮罩透明、点外面不能关列表。关掉详解后 `listStill` 仍为 true，列表停在原位。
- 每一张词卡上传 `pagePointId={POINT.vocabLibrary}`，从而出现 11.3 里的第二枚按钮。

### 11.6 插件：单词详解怎么用这五个方法

`panel.tsx` 全文在 11.9。和扩展点有关的只有下面这些，其余是请求详解、切换来源、停止生成和排版。

- `const point = api.modules?.point`。没拿到就说明注册表没有 `modules:point`，或 `host.surface` 对不上 `english.vocab.card`。朗读和转圈会直接跳过，抽屉里也不知道当前词。
- `useEffect` 里 `getPayload('drawer')` 再 `subscribe`。槽名是 `drawer`，不是注册表里的 `card-action`。按钮槽只负责打开，词在抽屉槽的载荷里。换词、从列表打开、会话被盖住后揭开，都会再读。`cardFromPayload` 要求 `word` 是非空字符串，否则当成没打开。
- `publishSignal('pending', { pluginId: 'vocabDetail', key: word, on })`。`pluginId` 必须等于注册表 id，`key` 是当前词。主项目只让这一枚、这一个词的按钮转圈。别的插件写同一个词不会让这枚按钮转。
- `command('play', text)` 和 `command('stop', undefined)`。第二个参数不能省。`play` 的返回值可能是 Promise，用 `Promise.resolve` 包一层。同一段再点一次，或组件卸载、换词，都先 `stop`，避免抽屉关了声音还在。
- 组件不调用 `getContext`。词卡点的 `contextKeys` 是空的，词只在载荷里。

### 11.7 插件：单词解析列表怎么用这五个方法

`list.tsx` 全文在 11.9。这个插件的 `host.slot` 是 `drawer`，因为它就是那只由页面 `openPoint` 打开的抽屉正文，不是一枚行按钮。

- `getContext()` 经 `libraryIdFromContext` 取 `libraryId`。`subscribe` 在上下文变化时再取。库 id 变了就清空已加载行、游标和失败状态，并把 `stats` 写成 `{ total: 0, loaded: 0 }`，然后拉第一页。空库 id 只停在不加载，不发请求。
- 每一页成功后 `publishSignal('stats', { total, loaded })`。`total` 是这一库的详解总数，`loaded` 是已经拼进列表的行数。主项目词库页标题读的就是这个信号。非数字会被主项目丢掉，上一份数字还在。
- 点一行 `command('openCard', lemma)`。这里的 `lemma` 是字符串，主项目 `wordOf` 会 trim。返回值不是 `true` 就 Toast「需要先启用详解」，列表自己保持打开。
- 不读 `getPayload`。这只抽屉打开时载荷是 `{}`，库 id 只在上下文里。

### 11.8 插件：导入怎么用这五个方法

`panel.tsx` 全文在 11.9。注册表槽是 `library-card-action`，但读载荷的槽名是 `import-drawer`。按钮和抽屉是同一个插件，主项目点按钮时把载荷写到 `opens` 指向的那个槽。

- 首屏和 `subscribe` 都用 `getPayload('import-drawer')`，再经 `importTargetFromPayload` 收成 `{ libraryId, title }`。没有 `libraryId` 就是还没点开某张库，标题显示未选中，列表不请求。换一张库卡片再点，载荷变，已导入列表换库重拉。
- `command('pickJsonFile', undefined)`。没有 `point` 时才退回一个藏起来的 `<input>`。有命令时取消得到 `null`，不导入。抛出的 `accept` 显示成文件类型不对，其它错误显示成导入失败。
- 已导入列表里点一个词，同样是 `command('openCard', lemma) === true`。打不开就 Toast，导入抽屉不关。详解出现后，主项目按 `yieldTo` 把导入面板藏起来，这份列表状态还在。

`point.ts` 是三个插件共用的类型和三个读取函数，全文在 11.9。`PointModule.command` 的第二个参数写成可选，是插件侧类型放宽了；主项目实现要求调用时仍然传，没有参数就传 `undefined`。

### 11.9 完整源码

下面每份都是当前仓库里的全文。主项目只放接线文件和接线片段。插件放这个插件的全部实现（类型与读取、入口、面板）。注册表只放这三个插件的对象，不放文件里其它插件。

下面先放主项目里和这三个插件对接的代码。布局和命令是整个文件。词卡、词库卡片、词库页只放接入扩展点的那几段，词条分页、收藏和练习入口不在其中。插件侧从 `point.ts` 起每个文件都是全文。目录字段的逐项说明仍在第 2.2 节和第 2.4 节。

#### 主项目 `apps/frontend/src/views/englishLearning/Layout.tsx`

整个英语学习壳。`page` 为真的抽屉不在这里画，离开这一层时所有布局抽屉都会关掉。

```tsx
/**
 * 英语学习路由壳：首页、导入、资源库、收藏、拉取结果（stream）等子路由。
 */
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { closePoint, HostPoint, layoutDrawerSlots } from '@/federation';
import { stopAllPlayback } from '@/utils/speech';

export default function Layout() {
	const { pathname, search } = useLocation();

	// 子页切换或离开英语学习时停播，避免跨页继续朗读
	useEffect(() => {
		return () => stopAllPlayback();
	}, [pathname, search]);

	// 只在离开英语学习时关抽屉。子页之间切换保持当前词。
	useEffect(() => {
		return () => {
			for (const { pointId, slot } of layoutDrawerSlots) {
				closePoint(pointId, slot.name);
			}
		};
	}, []);

	return (
		<div className="h-full min-h-0 w-full min-w-0">
			<Outlet />
			{layoutDrawerSlots.map(({ pointId, slot }) =>
				slot.layout?.page ? null : (
					<HostPoint
						key={`${pointId}:${slot.name}`}
						pointId={pointId}
						slot={slot.name}
					/>
				),
			)}
		</div>
	);
}
```

#### 主项目 `apps/frontend/src/federation/points/commands.ts`

应用启动时注册一次。`play` 和 `stop` 在词卡点，`pickJsonFile` 和 `openCard` 在词库点。`openCard` 打开的是词卡点上的 `vocabDetail`，并带上 `source: 'list'`。

```ts
import { playPreferred, stopAllPlayback } from '@/utils/speech';
import { pickEnglishLearningJsonFile } from '@/views/englishLearning/import/englishLearningImportFile';
import { TTS_CACHE_FOLDER } from '@/views/englishLearning/utils/ttsCacheFolder';
import { POINT } from './catalog';
import { bindPointCommand, openPoint } from './session';

// 朗读和开详解的入参不固定：插件可能传词字符串，也可能传带 word 的载荷
function wordOf(arg: unknown): string {
	// 纯字符串去掉首尾空白；只剩空白时后面会当成「没有词」
	if (typeof arg === 'string') return arg.trim();
	// 对象形态只认 word 字段，和词卡载荷、列表行用的是同一个键
	if (arg && typeof arg === 'object' && 'word' in arg) {
		// 先取出 word，类型还没确认，避免把数字或 null 直接送去朗读
		const word = (arg as { word?: unknown }).word;
		// 不是字符串就当成没有词，不把 [object Object] 送进 TTS 或抽屉
		return typeof word === 'string' ? word.trim() : '';
		// 结束 { word } 这一支，字符串已修剪，其它类型已变成空串
	}
	// 缺参、null，或对象里根本没有 word：两条命令都按无词处理
	return '';
}

// 词卡 play：插件不能直接调主站朗读，只能经这条命令读当前词
bindPointCommand(POINT.vocabCard, 'play', (arg) => {
	// 字符串和 { word } 收成同一个词条
	const word = wordOf(arg);
	// 空白词不发起合成；已完成的 Promise 让插件把这次当成正常结束，而不是播放失败
	if (!word) return Promise.resolve();
	// 会员优先云端、失败回本机；同一词的音频写入磁盘，下次不再合成
	return playPreferred(word, {
		// 合成结果落到磁盘缓存
		persistDisk: true,
		// 只进单词详解目录，不和语句、练习的语音缓存混在一起
		cacheFolder: TTS_CACHE_FOLDER.vocabDetail,
		// 结束这一次 playPreferred：缓存开关和目录只作用于当前词
	});
	// 结束 play 回调的注册，调用名固定为词卡点上的 play
});

// 词卡 stop：关抽屉或插件主动停读时调用，停掉当前正在播的声音
bindPointCommand(POINT.vocabCard, 'stop', () => {
	// 不按词过滤，本机和云端正在播的都停
	stopAllPlayback();
	// 结束 stop
});

// 词库 pickJsonFile：导入插件弹不出系统文件框，借主站选一个 JSON
bindPointCommand(
	POINT.vocabLibrary,
	'pickJsonFile',
	() =>
		// 取消得到 null；选了非 .json 会抛 accept，由插件自己接
		pickEnglishLearningJsonFile(),
	// 结束 pickJsonFile 的注册，选文件的结果原样交给插件
);

// 词库 openCard：列表里点开某个词的详解。插件可能还没下载，词先记在词卡抽屉槽上
bindPointCommand(POINT.vocabLibrary, 'openCard', (arg) => {
	// 没有词就不开抽屉，避免空详解盖住列表
	const word = wordOf(arg);
	// false 表示这次没打开；下面插件未启用时也是 false，插件不用区分两种原因
	if (!word) return false;
	// 固定打开 vocabDetail 的词卡抽屉。它未启用，或槽位对不上时，openPoint 返回 false
	return openPoint(POINT.vocabCard, 'vocabDetail', 'drawer', {
		// 详解只凭这个词取内容；音标和释义等由插件自己再读
		word,
		// list 表示从词库列表点开，不是词卡按钮。这条命令只打开，不会再次点击关掉
		source: 'list',
		// 结束 openPoint 的载荷；返回值就是词卡抽屉这次有没有打开
	});
	// 结束 openCard 回调的注册，调用名固定为词库点上的 openCard
});
```

#### 主项目 `apps/frontend/src/views/englishLearning/components/vocab/Card.tsx` 中的 `CardActionButtons`

这是词卡右上角按钮区的完整函数。前面的喇叭是词卡自己的朗读，不走扩展点。`payload` 不带 `source`，从这两枚按钮打开的抽屉仍从右侧滑入。`card-action` 打开词卡自己的 `drawer`。`pagePointId` 有值时再挂当前列表页的 `item-action`。

```tsx
function CardActionButtons({
	card,
	playing,
	playDisabled,
	onTogglePlay,
	playLabels,
	trailingActions,
	pagePointId,
}: {
	card: CardData;
	playing: boolean;
	playDisabled: boolean;
	onTogglePlay?: () => void;
	playLabels: { play: string; stop: string };
	trailingActions?: ReactNode;
	pagePointId?: string;
}) {
	const payload = {
		word: card.word,
		pos: card.pos ?? null,
		ipa: card.ipa,
		translationZh: card.translationZh,
		example: card.example ?? null,
	};
	return (
		<div className="row-span-3 flex shrink-0 items-center gap-1 self-start">
			{onTogglePlay ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={playDisabled}
					onClick={onTogglePlay}
					className={cn(
						'h-7 w-7 shrink-0 rounded-md border p-2 transition-colors',
						playing
							? 'border-teal-500/40 bg-teal-500/15 text-teal-600 dark:text-teal-400'
							: 'border-theme/10 text-textcolor/60 hover:border-theme/20 hover:bg-theme/10 hover:text-teal-600 dark:hover:text-teal-400',
					)}
					aria-label={playing ? playLabels.stop : playLabels.play}
				>
					{playing ? (
						<Square className="size-3.5 fill-current" />
					) : (
						<Volume2 className="size-3.5" />
					)}
				</Button>
			) : null}
			{trailingActions}
			<HostPoint
				pointId={POINT.vocabCard}
				slot="card-action"
				payload={payload}
			/>
			{pagePointId ? (
				<HostPoint pointId={pagePointId} slot="item-action" payload={payload} />
			) : null}
		</div>
	);
}
```

#### 主项目 `LibraryListPanel.tsx`：这个槽上有没有插件

单词库取 `english.vocab.library`，语句库取 `english.classic.library`，再只留 `library-card-action`。一个都没有，后面就不会留导入按钮的位置。

```tsx
	const cardActionPlugins = useHostSurfacePlugins(
		kind === 'vocab' ? POINT.vocabLibrary : POINT.classicLibrary,
	).filter((plugin) => plugin.host?.slot === 'library-card-action');
```

#### 主项目 `LibraryListPanel.tsx`：这张库能不能导入

`showEdit` 表示这张库属于当前用户、可以改。不能改的库即使插件已启用也不显示导入。

```tsx
							const showImport = showEdit && cardActionPlugins.length > 0;
```

#### 主项目 `LibraryListPanel.tsx`：导入按钮

外层 `span` 把点击停在按钮上，避免点导入时选中整张库卡片。载荷只有 `libraryId` 和 `title`，由 `HostPoint` 写入该点的 `import-drawer`。语句库走同一个组件，目前没有插件登记在这个槽，按钮不会出现。

```tsx
											{showImport ? (
												<span
													className="contents"
													onClick={(event) => event.stopPropagation()}
													onPointerDown={(event) => event.stopPropagation()}
												>
													<HostPoint
														pointId={
															kind === 'vocab'
																? POINT.vocabLibrary
																: POINT.classicLibrary
														}
														slot="library-card-action"
														payload={{
															libraryId: lib.id,
															title: lib.title?.trim() || '',
														}}
													/>
												</span>
											) : null}
```

#### 主项目 `library/vocabulary/index.tsx`：上下文、详解是否在最上层、统计

`libraryId` 先 trim，空字符串不发布。`detailOpen` 要求词卡抽屉开着且没有被盖住；列表自己打开时目录会盖住词卡，这时列表保持可见。`readStats` 不直接交给 `useSyncExternalStore`，因为每次调用都是新对象。

```tsx
	const [openPluginId, setOpenPluginId] = useState<string | null>(null);
	// 从词卡切到列表时不要再从右侧滑入，否则开场那一帧 Loading 落在槽位右边
	const [listStill, setListStill] = useState(false);
	const libraryKey = libraryId?.trim() ?? '';
	usePointContext(
		POINT.vocabLibrary,
		libraryKey ? { libraryId: libraryKey } : null,
	);
	const detail = useSyncExternalStore(
		(listener) => subscribeSlot(POINT.vocabCard, 'drawer', listener),
		() => readSlot(POINT.vocabCard, 'drawer'),
		() => readSlot(POINT.vocabCard, 'drawer'),
	);
	const detailOpen = detail.open && !detail.covered;
	const tucked = Boolean(openPluginId && detailOpen);
	const listPlugin = useHostSurfacePlugins(POINT.vocabLibrary).find(
		(plugin) => plugin.host?.slot === 'drawer',
	);
	const [listStats, setListStats] = useState(() =>
		readStats(POINT.vocabLibrary),
	);

	useEffect(
		() => subscribeSignals(() => setListStats(readStats(POINT.vocabLibrary))),
		[],
	);

	// 详解开着时记下。关掉详解后列表还在 data-state=open，animation 恢复时位移必须是 0
	useEffect(() => {
		if (tucked) setListStill(true);
	}, [tucked]);

	// 列表不跟详解抢滚动锁，只在自己打开时把页面滚定住
	useEffect(() => {
		if (!openPluginId) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	}, [openPluginId]);
```

#### 主项目 `library/vocabulary/index.tsx`：顶栏按钮和列表抽屉

顶栏第一枚 `HostPoint` 的槽是 `toolbar`，单词解析列表不登记在这里。`listPlugin` 找到后才画「单词解析」。打开时载荷是空对象，库 id 走上下文。详解已经开着就 `setListStill(true)`，列表不再滑入。`tucked` 时面板同一帧透明，并且不能点外面把列表关掉。

```tsx
				<div className="flex shrink-0 flex-nowrap items-center gap-3">
					<HostPoint pointId={POINT.vocabLibrary} slot="toolbar" />
					<Entry
						variant="text"
						disabled={total <= 0}
						practice={{
							source: 'library',
							libraryId,
							sourceTitle: meta?.title?.trim() || undefined,
							poolTotal: total > 0 ? total : undefined,
						}}
					/>
					<button
						type="button"
						className="flex items-center gap-1 text-teal-500 hover:text-teal-400 cursor-pointer text-sm"
						onClick={() => {
							navigate('/english-learning/favorites');
						}}
					>
						<Star className="size-4.5" />
						{t('englishLearning.practice.favorites')}
					</button>
					{listPlugin ? (
						<button
							type="button"
							className="flex cursor-pointer items-center gap-1 text-sm text-teal-500 hover:text-teal-400"
							onClick={() => {
								const opening = openPluginId !== listPlugin.id;
								if (!opening) {
									setListStill(false);
									closePoint(POINT.vocabLibrary, 'drawer');
									setOpenPluginId(null);
									return;
								}
								const detailWasOpen = readSlot(POINT.vocabCard, 'drawer').open;
								const opened = openPoint(
									POINT.vocabLibrary,
									listPlugin.id,
									'drawer',
									{},
								);
								if (!opened) return;
								setListStill(detailWasOpen);
								setOpenPluginId(listPlugin.id);
							}}
						>
							<PluginIcon
								name={listPlugin.menu?.icon ?? listPlugin.host?.icon}
								className="size-4.5"
							/>
							{pickPluginLocaleText(listPlugin.title, locale) || '单词解析'}
						</button>
					) : null}
				</div>
			</div>
			<PluginHostSurface
				surface="english.vocab.library"
				part="drawer"
				openPluginId={openPluginId}
				onOpenPluginIdChange={(id) => {
					if (!id) {
						setListStill(false);
						closePoint(POINT.vocabLibrary, 'drawer');
					}
					setOpenPluginId(id);
				}}
				drawerBodyClassName="overflow-hidden p-0"
				drawerWidth={pointDrawerWidth}
				chromeStyle={
					tucked
						? {
								animation: 'none',
								transition: 'none',
								opacity: 0,
								visibility: 'hidden',
							}
						: listStill
							? ({
									'--tw-enter-translate-x': '0px',
									opacity: 1,
									transition: 'none',
								} as CSSProperties)
							: undefined
				}
				drawerModal={false}
				drawerPlainOverlay
				drawerOverlayClassName={
					tucked ? 'pointer-events-none opacity-0' : undefined
				}
				drawerPreventDismiss={tucked}
				drawerClassName={tucked ? 'pointer-events-none' : undefined}
				onDrawerInteractOutside={(event) => {
					if (openPluginId && detailOpen) event.preventDefault();
				}}
				drawerTitle={
					<span className="flex min-w-0 items-baseline gap-2">
						<span className="shrink-0">
							{t('englishLearning.vocabDetailList.heading')}
						</span>
						<span className="text-textcolor/50 truncate text-sm font-normal">
							{t('englishLearning.vocabDetailList.summary', {
								total: listStats?.total ?? 0,
								loaded: listStats?.loaded ?? 0,
							})}
						</span>
					</span>
				}
			/>
```

#### 主项目 `library/vocabulary/index.tsx`：词条卡片把词库点交给行按钮

这是列表里每一张词卡的接入点。`data`、朗读和后面的收藏按钮是词库自己的。`pagePointId={POINT.vocabLibrary}` 让 `CardActionButtons` 再挂一枚 `item-action`，打开的是词库的 `item-drawer`，不是整库列表。

```tsx
												<Card
													variant="library"
													data={item}
													playing={playing}
													onTogglePlay={() =>
														void toggleWordAudio(item.word, key)
													}
													playLabels={{
														play: t('englishLearning.vocab.playWord'),
														stop: t('englishLearning.tts.stop'),
													}}
													pagePointId={POINT.vocabLibrary}
```

#### 主项目 `apps/backend/uploads/remotes/plugins-registry.json` 中的三个插件

`host.slot` 决定它出现在哪一枚入口。抽屉正文读的槽名是目录里该按钮 `opens` 指向的槽，列表插件则直接登记在 `drawer` 上。三个插件共用一份 `mf-manifest.json`，所以 `remoteName` 必须不同。`expose` 等于 vite 的 `exposes` 键。`enabled` 为 false 时入口不出现，到插件中心打开后才加载。

```json
[
	{
		"id": "vocabDetail",
		"remoteName": "dnhyxc-ai-vocab-detail",
		"expose": "./VocabDetail",
		"title": {
			"zh-CN": "单词解析详情",
			"en-US": "Word details"
		},
		"description": {
			"zh-CN": "在单词卡上查看词根词缀、记忆、详细释义和例句。",
			"en-US": "Open roots, a memory hook, fuller meanings, and example sentences from a word card."
		},
		"routePath": "/english-learning/vocab-detail",
		"entry": "http://127.0.0.1:9008/mf-manifest.json",
		"version": "1.0.0",
		"hostApiRange": "^1.0.0",
		"injectRoute": false,
		"host": {
			"surface": "english.vocab.card",
			"slot": "card-action",
			"order": 10,
			"icon": "https://dnhyxc-ai-1313243176.cos.ap-shanghai.myqcloud.com/assets/4bf871cd-ceb4-42e2-b7aa-6ddeb09f3713_sparkle.svg"
		},
		"permissions": [
			"ui:toast",
			"http:plugin-api",
			"modules:point"
		],
		"preload": "idle",
		"enabled": false,
		"trust": "first-party"
	},
	{
		"id": "vocabDetailList",
		"remoteName": "dnhyxc-ai-vocab-detail-list",
		"expose": "./VocabDetailList",
		"title": {
			"zh-CN": "单词解析",
			"en-US": "Word details"
		},
		"description": {
			"zh-CN": "在词汇库单词列表顶栏查看已经生成过详解的词，点开复用单词详解。",
			"en-US": "Browse words that already have a detail, from the library word list."
		},
		"routePath": "/english-learning/vocab-detail-list",
		"entry": "http://127.0.0.1:9008/mf-manifest.json",
		"version": "1.0.0",
		"hostApiRange": "^1.0.0",
		"injectRoute": false,
		"host": {
			"surface": "english.vocab.library",
			"slot": "drawer",
			"order": 10,
			"icon": "https://dnhyxc-ai-1313243176.cos.ap-shanghai.myqcloud.com/assets/5f75feea-f9ab-48d4-8eaf-929189ae2584_package.svg"
		},
		"permissions": [
			"ui:toast",
			"http:plugin-api",
			"modules:point"
		],
		"preload": "idle",
		"enabled": false,
		"trust": "first-party"
	},
	{
		"id": "vocabDetailImport",
		"remoteName": "dnhyxc-ai-vocab-detail-import",
		"expose": "./VocabDetailImport",
		"title": {
			"zh-CN": "导入单词解析",
			"en-US": "Import word analysis"
		},
		"description": {
			"zh-CN": "在单词库卡片编辑按钮右侧导入外部生成的单词解析。只写入你自己的账号。",
			"en-US": "Import externally prepared word analysis from a library card. Stored only on your account."
		},
		"routePath": "/english-learning/vocab-detail-import",
		"entry": "http://127.0.0.1:9008/mf-manifest.json",
		"version": "1.0.0",
		"hostApiRange": "^1.0.0",
		"injectRoute": false,
		"host": {
			"surface": "english.vocab.library",
			"slot": "library-card-action",
			"order": 20,
			"icon": "https://dnhyxc-ai-1313243176.cos.ap-shanghai.myqcloud.com/assets/8d0850cc-e408-4f58-bb52-c57767709e75_database-arrow-up.svg"
		},
		"permissions": [
			"ui:toast",
			"http:plugin-api",
			"modules:point"
		],
		"preload": "idle",
		"enabled": false,
		"trust": "first-party"
	}
]
```

插件仓库是 `dnhyxc-ai-plugins`。下面每个文件都是当前全文，和仓库一致。

#### 插件 `src/views/vocab-detail/point.ts`

三个插件共用。`cardFromPayload` 只认非空 `word`；`source` 只有列表命令会写成 `list`，否则收成 `card`。`libraryIdFromContext` 给列表插件，`importTargetFromPayload` 给导入插件。`command` 的第二个参数在类型上可选，调用时仍然要传。

```ts
import type { VocabCardSnapshot } from './types';

/** 主站按插件的 host.surface 下发的唯一模块。 */
export type PointModule = {
	getContext: () => Record<string, unknown> | null;
	getPayload: (slot: string) => Record<string, unknown> | null;
	subscribe: (listener: () => void) => () => void;
	publishSignal: (name: string, value: unknown) => void;
	command: (name: string, arg?: unknown) => unknown;
};

export function cardFromPayload(
	payload: Record<string, unknown> | null,
): VocabCardSnapshot | null {
	if (!payload || typeof payload.word !== 'string' || !payload.word.trim()) {
		return null;
	}
	return {
		word: payload.word,
		pos: typeof payload.pos === 'string' ? payload.pos : null,
		ipa: typeof payload.ipa === 'string' ? payload.ipa : null,
		translationZh:
			typeof payload.translationZh === 'string' ? payload.translationZh : null,
		example: typeof payload.example === 'string' ? payload.example : null,
		source: payload.source === 'list' ? 'list' : 'card',
	};
}

export function libraryIdFromContext(
	context: Record<string, unknown> | null | undefined,
): string {
	const libraryId = context?.libraryId;
	return typeof libraryId === 'string' ? libraryId : '';
}

export function importTargetFromPayload(
	payload: Record<string, unknown> | null,
): { libraryId: string; title: string } | null {
	if (!payload || typeof payload.libraryId !== 'string' || !payload.libraryId) {
		return null;
	}
	return {
		libraryId: payload.libraryId,
		title: typeof payload.title === 'string' ? payload.title : '',
	};
}
```

#### 插件 `src/views/vocab-detail/index.ts`

vite 的 `./VocabDetail` 指向这个文件。先引进插件样式，再把面板当默认导出。

```ts
import '@/styles.css';

export { default } from './panel';
```

#### 插件 `src/views/vocab-detail/panel.tsx`

单词详解的完整实现。扩展点只出现在组件后半：读 `drawer` 载荷、`pending`、`play` / `stop`。前面的排版、请求和版本切换不改变接入方式。

```tsx
import Loading from '@design/Loading';
import { Button } from '@ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import { ScrollArea } from '@ui/index';
import { Spinner } from '@ui/spinner';
import {
	Check,
	History,
	Import,
	PanelTopClose,
	PanelTopOpen,
	RefreshCw,
	Sparkles,
	Square,
	Volume2,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useHostLocale, useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	cancelVocabDetail,
	errorMessage,
	loadVocabDetail,
	regenerateVocabDetail,
	type VersionSource,
	type VocabVersions,
} from './api';
import { cardFromPayload, type PointModule } from './point';
import type { VocabCardSnapshot, VocabDetail } from './types';

type HostApi = {
	locale?: 'zh-CN' | 'en-US';
	event?: {
		on: (event: string, handler: (data?: unknown) => void) => void;
		off: (event: string, handler: (data?: unknown) => void) => void;
	};
	http?: {
		get: (url: string) => Promise<unknown>;
		post?: (url: string, body?: unknown) => Promise<unknown>;
	};
	modules?: { point?: PointModule };
};

function displayIpa(ipa: string): string {
	const text = ipa.trim();
	if (!text) return '';
	if (text.length >= 2 && text.startsWith('/') && text.endsWith('/')) {
		return text;
	}
	return `/${text}/`;
}

const KIND_LABEL: Record<string, string> = {
	prefix: 'vocabDetail.kind.prefix',
	root: 'vocabDetail.kind.root',
	suffix: 'vocabDetail.kind.suffix',
	base: 'vocabDetail.kind.base',
};

function kindLabel(kind: string, t: (key: string) => string): string {
	const key = KIND_LABEL[kind];
	return key ? t(key) : kind;
}

function WordHead({
	card,
	playing,
	onPlay,
}: {
	card: VocabCardSnapshot | null;
	playing: boolean;
	onPlay?: (key: string, text: string) => void;
}) {
	const { t } = useI18n();
	if (!card?.word) return null;
	const ipa = card.ipa ? displayIpa(card.ipa) : '';
	const pos = card.pos?.trim();
	const key = `word:${card.word}`;
	return (
		<header className="flex items-start gap-2">
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<div className="flex flex-wrap items-baseline gap-x-2">
					<h2 className="text-textcolor text-[1.75rem] font-semibold leading-none tracking-tight">
						{card.word}
					</h2>
					{pos ? (
						<span className="text-textcolor/45 text-xs">{pos}</span>
					) : null}
				</div>
				{ipa ? (
					<p className="font-mono text-[13px] leading-snug text-teal-600/90 dark:text-teal-400/90">
						{ipa}
					</p>
				) : null}
			</div>
			{onPlay ? (
				<PlayButton
					playing={playing}
					label={playing ? t('vocabDetail.stop') : t('vocabDetail.play')}
					onClick={() => onPlay(key, card.word)}
				/>
			) : null}
		</header>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-3">
			<h3 className="text-textcolor/55 text-[13px] font-medium">{title}</h3>
			{children}
		</section>
	);
}

function Tag({ children }: { children: string }) {
	return (
		<span className="mr-1.5 inline-flex shrink-0 rounded bg-teal-500/15 px-1.5 text-[11px] leading-5 text-teal-600 dark:text-teal-400">
			{children}
		</span>
	);
}

const VERSION_ORDER: VersionSource[] = ['manual', 'generated', 'regen'];

const VERSION_LABEL: Record<VersionSource, string> = {
	manual: 'vocabDetail.version.manual',
	generated: 'vocabDetail.version.generated',
	regen: 'vocabDetail.version.regen',
};

const VERSION_ICON: Record<VersionSource, typeof Import> = {
	manual: Import,
	generated: History,
	regen: Sparkles,
};

function presentVersions(versions: VocabVersions | null): VersionSource[] {
	if (!versions) return [];
	return VERSION_ORDER.filter((source) => versions[source]);
}

function DetailActions({
	source,
	choices,
	regenerating,
	stopping,
	onPick,
	onRegen,
	onStop,
}: {
	source: VersionSource;
	choices: VersionSource[];
	regenerating: boolean;
	stopping: boolean;
	onPick: (source: VersionSource) => void;
	onRegen: () => void;
	onStop: () => void;
}) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const TriggerIcon = open ? PanelTopClose : PanelTopOpen;
	const link =
		'h-auto gap-1.5 px-0! py-0 text-sm font-medium text-teal-500 shadow-none has-[>svg]:px-0! hover:bg-transparent hover:text-teal-400 disabled:opacity-40 data-[state=open]:bg-transparent data-[state=open]:text-teal-400';
	return (
		<div className="flex items-center justify-end gap-4">
			{choices.length >= 2 ? (
				<DropdownMenu open={open} onOpenChange={setOpen}>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={regenerating}
							aria-expanded={open}
							className={link}
						>
							<TriggerIcon className="size-4 shrink-0 opacity-90" aria-hidden />
							<span className="max-w-28 truncate">
								{t(VERSION_LABEL[source])}
							</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						side="top"
						align="end"
						sideOffset={6}
						className="min-w-36"
					>
						{choices.map((item) => {
							const Icon = VERSION_ICON[item];
							return (
								<DropdownMenuItem
									key={item}
									className="gap-2"
									onSelect={() => onPick(item)}
								>
									<Icon
										className="size-4 shrink-0 text-textcolor"
										aria-hidden
									/>
									<span className="min-w-0 flex-1 truncate">
										{t(VERSION_LABEL[item])}
									</span>
									<Check
										className={cn(
											'size-3.5 shrink-0',
											item === source ? 'opacity-100' : 'opacity-0',
										)}
										aria-hidden
									/>
								</DropdownMenuItem>
							);
						})}
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}
			{regenerating ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={stopping}
					className={link}
					onClick={onStop}
				>
					<Square
						className="size-4 shrink-0 fill-current opacity-90"
						aria-hidden
					/>
					{stopping ? t('vocabDetail.stopping') : t('vocabDetail.stopGenerate')}
				</Button>
			) : (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className={link}
					onClick={onRegen}
				>
					<RefreshCw className="size-4 shrink-0 opacity-90" aria-hidden />
					{t('vocabDetail.regenerate')}
				</Button>
			)}
		</div>
	);
}

function StopGenerate({
	stopping,
	onStop,
}: {
	stopping: boolean;
	onStop: () => void;
}) {
	const { t } = useI18n();
	return (
		<Button
			type="button"
			size="sm"
			variant="link"
			disabled={stopping}
			className="text-teal-500 hover:text-teal-400 px-0! h-5"
			onClick={onStop}
		>
			<Square className="size-4 fill-current" />
			{t('vocabDetail.stopGenerate')}
		</Button>
	);
}

function PlayButton({
	playing,
	label,
	onClick,
}: {
	playing: boolean;
	label: string;
	onClick: () => void;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			aria-label={label}
			onClick={onClick}
			className={
				playing
					? 'mt-0.5 h-7 w-7 shrink-0 rounded-md border border-teal-500/40 bg-teal-500/15 p-0 text-teal-600 dark:text-teal-400'
					: 'border-theme/10 text-textcolor/60 hover:border-theme/20 hover:bg-theme/10 mt-0.5 h-7 w-7 shrink-0 rounded-md border p-0 hover:text-teal-600 dark:hover:text-teal-400'
			}
		>
			{playing ? (
				<Square className="size-3.5 fill-current" />
			) : (
				<Volume2 className="size-3.5" />
			)}
		</Button>
	);
}

function Lines({
	items,
	tag = false,
	playingKey,
	onPlay,
	playLabel,
	stopLabel,
}: {
	items: {
		key: string;
		main: string;
		aside?: string;
		detail: string;
		speak?: string;
	}[];
	/** 类型标在形式前面，用小标签标识 */
	tag?: boolean;
	playingKey?: string | null;
	onPlay?: (key: string, text: string) => void;
	playLabel?: string;
	stopLabel?: string;
}) {
	return (
		<div className="flex flex-col gap-2">
			{items.map((item) => {
				const playing = playingKey === item.key;
				const line = (
					<p className="min-w-0 flex-1 text-sm leading-6">
						{tag && item.aside ? <Tag>{item.aside}</Tag> : null}
						<span className="text-textcolor mr-1.5 font-medium">
							{item.main}
						</span>
						{!tag && item.aside ? (
							<span className="mr-1.5 text-xs text-teal-600/80 dark:text-teal-400/80">
								{item.aside}
							</span>
						) : null}
						<span className="text-textcolor/70">{item.detail}</span>
					</p>
				);
				if (!item.speak || !onPlay) {
					return <div key={item.key}>{line}</div>;
				}
				return (
					<div key={item.key} className="flex items-start gap-2">
						{line}
						<PlayButton
							playing={playing}
							label={(playing ? stopLabel : playLabel) ?? ''}
							onClick={() => onPlay(item.key, item.speak ?? '')}
						/>
					</div>
				);
			})}
		</div>
	);
}

function DetailSections({
	detail,
	onPlay,
	playingKey,
}: {
	detail: VocabDetail;
	onPlay?: (key: string, text: string) => void;
	playingKey: string | null;
}) {
	const { t } = useI18n();
	const playLabel = t('vocabDetail.play');
	const stopLabel = t('vocabDetail.stop');
	return (
		<div className="flex flex-col gap-7">
			<Section title={t('vocabDetail.morphology')}>
				<Lines
					tag
					items={detail.morphology.parts.map((part) => ({
						key: `${part.kind}-${part.form}`,
						main: part.form,
						aside: kindLabel(part.kind, t),
						detail: part.meaningZh,
					}))}
				/>
				{detail.morphology.storyZh ? (
					<p className="text-textcolor/70 text-sm leading-7">
						{detail.morphology.storyZh}
					</p>
				) : null}
			</Section>
			<Section title={t('vocabDetail.memory')}>
				<p className="text-textcolor text-sm leading-7">
					{detail.memory.hookZh}
				</p>
			</Section>
			<Section title={t('vocabDetail.senses')}>
				<div className="flex flex-col gap-3">
					{detail.senses.map((sense) => (
						<div
							key={`${sense.pos}-${sense.glossZh}`}
							className="flex flex-col gap-1"
						>
							<p className="text-sm leading-6">
								<Tag>{sense.pos}</Tag>
								<span className="text-textcolor font-medium">
									{sense.glossZh}
								</span>
							</p>
							{sense.nuanceZh ? (
								<p className="text-textcolor/55 text-xs leading-5">
									{sense.nuanceZh}
								</p>
							) : null}
						</div>
					))}
				</div>
			</Section>
			<Section title={t('vocabDetail.examples')}>
				<div className="flex flex-col gap-4">
					{detail.examples.map((example) => {
						const key = `example:${example.en}`;
						const playing = playingKey === key;
						return (
							<div key={example.en} className="flex items-start gap-2">
								<div className="min-w-0 flex-1">
									<p className="text-textcolor text-sm leading-7">
										{example.en}
									</p>
									<p className="text-textcolor/55 mt-1 text-sm leading-6">
										{example.zh}
									</p>
								</div>
								{onPlay ? (
									<PlayButton
										playing={playing}
										label={playing ? stopLabel : playLabel}
										onClick={() => onPlay(key, example.en)}
									/>
								) : null}
							</div>
						);
					})}
				</div>
			</Section>
			{(detail.family ?? []).length > 0 ? (
				<Section title={t('vocabDetail.family')}>
					<Lines
						playingKey={playingKey}
						onPlay={onPlay}
						playLabel={playLabel}
						stopLabel={stopLabel}
						items={(detail.family ?? []).map((row) => ({
							key: `family:${row.word}`,
							main: row.word,
							aside: row.pos,
							detail: row.glossZh,
							speak: row.word,
						}))}
					/>
				</Section>
			) : null}
			{(detail.collocations ?? []).length > 0 ? (
				<Section title={t('vocabDetail.collocations')}>
					<Lines
						playingKey={playingKey}
						onPlay={onPlay}
						playLabel={playLabel}
						stopLabel={stopLabel}
						items={(detail.collocations ?? []).map((row) => ({
							key: `collocation:${row.phrase}`,
							main: row.phrase,
							detail: row.glossZh,
							speak: row.phrase,
						}))}
					/>
				</Section>
			) : null}
			{(detail.synonyms ?? []).length > 0 ? (
				<Section title={t('vocabDetail.synonyms')}>
					<Lines
						playingKey={playingKey}
						onPlay={onPlay}
						playLabel={playLabel}
						stopLabel={stopLabel}
						items={(detail.synonyms ?? []).map((row) => ({
							key: `synonym:${row.word}`,
							main: row.word,
							aside: row.pos,
							detail: row.glossZh,
							speak: row.word,
						}))}
					/>
				</Section>
			) : null}
			{(detail.tags ?? []).length > 0 ? (
				<p className="text-textcolor/45 text-xs">
					{(detail.tags ?? []).join(' · ')}
				</p>
			) : null}
		</div>
	);
}

export default function VocabDetailPanel({ api }: { api: HostApi }) {
	const { t } = useI18n();
	useHostLocale(api);
	const point = api.modules?.point;
	const httpRef = useRef(api.http);
	httpRef.current = api.http;
	const [card, setCard] = useState<VocabCardSnapshot | null>(null);
	const [detail, setDetail] = useState<VocabDetail | null>(null);
	const [head, setHead] = useState<{ ipa: string; pos: string } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [playingKey, setPlayingKey] = useState<string | null>(null);
	const [stopping, setStopping] = useState(false);
	const [stopped, setStopped] = useState(false);
	const [versions, setVersions] = useState<VocabVersions | null>(null);
	const [source, setSource] = useState<VersionSource | null>(null);
	const [regenerating, setRegenerating] = useState(false);
	const [generating, setGenerating] = useState(false);
	const playRun = useRef(0);
	const regenRun = useRef(0);

	const togglePlay = (key: string, text: string) => {
		if (!text.trim() || !point) return;
		if (playingKey === key) {
			playRun.current += 1;
			point.command('stop', undefined);
			setPlayingKey(null);
			return;
		}
		playRun.current += 1;
		const run = playRun.current;
		point.command('stop', undefined);
		setPlayingKey(key);
		void Promise.resolve(point.command('play', text)).finally(() => {
			if (playRun.current === run) setPlayingKey(null);
		});
	};

	useEffect(() => {
		return () => {
			playRun.current += 1;
			point?.command('stop', undefined);
		};
	}, [point]);

	useEffect(() => {
		if (!point) return;
		const pull = () => setCard(cardFromPayload(point.getPayload('drawer')));
		pull();
		return point.subscribe(pull);
	}, [point]);

	useEffect(() => {
		const word = card?.word.trim();
		const http = httpRef.current;
		if (!word || !http) return;
		setDetail(null);
		setHead(null);
		setError(null);
		setStopped(false);
		setStopping(false);
		setVersions(null);
		setSource(null);
		setRegenerating(false);
		setGenerating(false);
		regenRun.current += 1;
		let cancelled = false;
		const setPending = (pending: boolean) =>
			point?.publishSignal('pending', {
				pluginId: 'vocabDetail',
				key: word,
				on: pending,
			});
		void loadVocabDetail(http, word, {
			setPending,
			setGenerating: (on) => {
				if (!cancelled) setGenerating(on);
			},
		})
			.then((next) => {
				if (cancelled) return;
				if (next.cancelled) {
					setStopped(true);
					setStopping(false);
					return;
				}
				setStopping(false);
				setDetail(next.detail);
				setVersions(next.versions);
				setSource(next.source);
				setHead({ ipa: next.ipa, pos: next.pos });
			})
			.catch((cause: unknown) => {
				if (!cancelled) {
					setStopping(false);
					setError(errorMessage(cause));
				}
			});
		return () => {
			cancelled = true;
			playRun.current += 1;
			point?.command('stop', undefined);
			setPlayingKey(null);
		};
	}, [attempt, point, card?.word]);

	const stopGenerate = () => {
		const word = card?.word.trim();
		const http = httpRef.current;
		if (!word || !http || stopping) return;
		setStopping(true);
		cancelVocabDetail(http, word, regenerating ? 'regen' : undefined);
	};

	const onPickVersion = (nextSource: VersionSource) => {
		const next = versions?.[nextSource];
		if (!next) return;
		setSource(nextSource);
		setDetail(next);
	};

	const regenerate = async () => {
		const word = card?.word.trim();
		const http = httpRef.current;
		if (!word || !http || regenerating) return;
		regenRun.current += 1;
		const run = regenRun.current;
		setRegenerating(true);
		setStopping(false);
		setError(null);
		try {
			const next = await regenerateVocabDetail(http, word);
			if (regenRun.current !== run) return;
			if (next.cancelled) return;
			setVersions((current) => ({
				manual: current?.manual ?? null,
				generated: current?.generated ?? null,
				regen: next.detail,
			}));
			setSource('regen');
			setDetail(next.detail);
		} catch (cause: unknown) {
			if (regenRun.current === run) setError(errorMessage(cause));
		} finally {
			if (regenRun.current === run) {
				setRegenerating(false);
				setStopping(false);
			}
		}
	};

	const pending = Boolean(card?.word) && !detail && !error && !stopped;
	const showStop = generating || stopping;
	const shownCard = card
		? {
				...card,
				ipa: card.ipa?.trim() || head?.ipa || '',
				pos: card.pos?.trim() || head?.pos || detail?.senses[0]?.pos || '',
			}
		: null;
	// 列表只有词条，整页 Loading；卡片打开时词头已经有了，不再换成 Loading
	if (pending && card?.source === 'list') {
		return (
			<div className="flex h-full min-h-0 flex-col">
				<Loading
					className="min-h-0 flex-1"
					text={stopping ? t('vocabDetail.stopping') : t('vocabDetail.loading')}
				/>
				{showStop ? (
					<div className="flex justify-center px-4 pb-4">
						<StopGenerate stopping={stopping} onStop={stopGenerate} />
					</div>
				) : null}
			</div>
		);
	}

	const versionChoices = presentVersions(versions);
	return (
		<div className="flex h-full min-h-0 flex-col py-3.5 pl-3.5">
			<ScrollArea
				className="min-h-0 flex-1"
				scrollbarClassName="right-0 w-1.5 border-l-0 p-0"
			>
				<div className="flex select-text flex-col gap-6 pr-3.5">
					<WordHead
						card={shownCard}
						playing={playingKey === `word:${card?.word ?? ''}`}
						onPlay={point ? togglePlay : undefined}
					/>
					{!card?.word ? (
						<p className="text-textcolor/55 text-sm">
							{t('vocabDetail.empty')}
						</p>
					) : null}
					{error ? (
						<div className="flex flex-col items-start gap-2">
							<p className="text-sm text-rose-500">{error}</p>
							<Button
								type="button"
								size="sm"
								onClick={() => setAttempt((n) => n + 1)}
							>
								{t('vocabDetail.retry')}
							</Button>
						</div>
					) : null}
					{stopped ? (
						<div className="flex flex-col items-start gap-2">
							<p className="text-textcolor/55 text-sm">
								{t('vocabDetail.stopped')}
							</p>
							<Button
								type="button"
								size="sm"
								onClick={() => setAttempt((n) => n + 1)}
							>
								{t('vocabDetail.retry')}
							</Button>
						</div>
					) : null}
					{pending ? (
						<div className="w-full text-textcolor/55 flex items-center justify-between gap-3 self-start text-sm">
							<span className="flex items-center gap-2">
								<Spinner
									className="size-4 shrink-0 text-textcolor/55"
									aria-hidden
								/>
								<span>
									{stopping
										? t('vocabDetail.stopping')
										: t('vocabDetail.loading')}
								</span>
							</span>
							{showStop ? (
								<StopGenerate stopping={stopping} onStop={stopGenerate} />
							) : null}
						</div>
					) : null}
					{detail ? (
						<DetailSections
							detail={detail}
							playingKey={playingKey}
							onPlay={point ? togglePlay : undefined}
						/>
					) : null}
					{detail && source ? (
						<DetailActions
							source={source}
							choices={versionChoices}
							regenerating={regenerating}
							stopping={stopping}
							onPick={onPickVersion}
							onRegen={() => void regenerate()}
							onStop={stopGenerate}
						/>
					) : null}
				</div>
			</ScrollArea>
		</div>
	);
}
```

#### 插件 `src/views/vocab-detail-list/index.ts`

vite 的 `./VocabDetailList` 指向这个文件。

```ts
import '@/styles.css';

export { default } from './list';
```

#### 插件 `src/views/vocab-detail-list/list.tsx`

单词解析列表的完整实现。库 id 来自 `getContext`，条数用 `publishSignal('stats')` 写回词库页标题，点词调用 `openCard`。

```tsx
import Loading from '@design/Loading';
import { Button, ScrollArea } from '@ui/index';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHostLocale, useI18n } from '@/hooks';
import {
	libraryIdFromContext,
	type PointModule,
} from '@/views/vocab-detail/point';

type ListItem = {
	lemma: string;
	glossZh: string;
	updatedAt: string;
};

type ListPage = {
	items: ListItem[];
	nextCursor: string | null;
	total: number;
};

type HostApi = {
	locale?: 'zh-CN' | 'en-US';
	http?: { get: (url: string) => Promise<unknown> };
	ui?: {
		showToast: (options: {
			message: string;
			type?: 'success' | 'error' | 'info';
		}) => void;
	};
	modules?: { point?: PointModule };
};

function unwrap(res: unknown): ListPage {
	const body =
		res && typeof res === 'object' && 'data' in res
			? (res as { data: unknown }).data
			: res;
	if (!body || typeof body !== 'object') {
		return { items: [], nextCursor: null, total: 0 };
	}
	const page = body as {
		items?: unknown;
		nextCursor?: unknown;
		total?: unknown;
	};
	const items = Array.isArray(page.items)
		? page.items.flatMap((row) => {
				if (!row || typeof row !== 'object') return [];
				const item = row as {
					lemma?: unknown;
					glossZh?: unknown;
					updatedAt?: unknown;
				};
				if (typeof item.lemma !== 'string' || !item.lemma) return [];
				return [
					{
						lemma: item.lemma,
						glossZh: typeof item.glossZh === 'string' ? item.glossZh : '',
						updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : '',
					},
				];
			})
		: [];
	const total = Number(page.total);
	return {
		items,
		nextCursor: typeof page.nextCursor === 'string' ? page.nextCursor : null,
		total: Number.isFinite(total) ? total : items.length,
	};
}

export default function VocabDetailList({ api }: { api: HostApi }) {
	const { t, locale } = useI18n();
	useHostLocale(api);
	const [items, setItems] = useState<ListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);
	const cursorRef = useRef<string | null | undefined>(undefined);
	const loadingRef = useRef(false);
	const holdRef = useRef(false);
	const viewportRef = useRef<HTMLDivElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const loadedRef = useRef(0);
	const libraryRef = useRef('');
	const genRef = useRef(0);

	const loadPage = useCallback(async () => {
		const libraryId = libraryRef.current;
		if (
			!libraryId ||
			loadingRef.current ||
			holdRef.current ||
			cursorRef.current === null
		) {
			return;
		}
		if (!api.http) {
			setLoading(false);
			setFailed(true);
			return;
		}
		loadingRef.current = true;
		setLoading(true);
		const gen = genRef.current;
		const cursor = cursorRef.current;
		const url = `/english-learning/vocab-detail/list?libraryId=${encodeURIComponent(libraryId)}${
			cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
		}`;
		try {
			const page = unwrap(await api.http.get(url));
			if (gen !== genRef.current) return;
			cursorRef.current = page.nextCursor;
			loadedRef.current += page.items.length;
			setItems((prev) => [...prev, ...page.items]);
			api.modules?.point?.publishSignal('stats', {
				total: page.total,
				loaded: loadedRef.current,
			});
			setFailed(false);
		} catch {
			if (gen !== genRef.current) return;
			holdRef.current = true;
			setFailed(true);
		} finally {
			if (gen === genRef.current) {
				loadingRef.current = false;
				setLoading(false);
			}
		}
	}, [api.http, api.modules]);

	useEffect(() => {
		const point = api.modules?.point;
		const apply = () => {
			const next = libraryIdFromContext(point?.getContext());
			if (next === libraryRef.current && cursorRef.current !== undefined)
				return;
			libraryRef.current = next;
			cursorRef.current = undefined;
			holdRef.current = false;
			loadingRef.current = false;
			loadedRef.current = 0;
			genRef.current += 1;
			setItems([]);
			setFailed(false);
			point?.publishSignal('stats', { total: 0, loaded: 0 });
			if (!next) return setLoading(false);
			void loadPage();
		};
		apply();
		return point?.subscribe(apply);
	}, [api.modules, loadPage]);

	useEffect(() => {
		const root = viewportRef.current;
		const target = sentinelRef.current;
		if (!root || !target || failed || cursorRef.current === null) return;
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries[0]?.isIntersecting) return;
				void loadPage();
			},
			{ root, rootMargin: '120px 0px', threshold: 0 },
		);
		io.observe(target);
		return () => io.disconnect();
	}, [failed, items.length, loadPage, loading]);

	const retry = () => {
		holdRef.current = false;
		setFailed(false);
		void loadPage();
	};

	const onPick = (lemma: string) => {
		const opened = api.modules?.point?.command('openCard', lemma) === true;
		if (!opened) {
			api.ui?.showToast({
				message: t('vocabDetailList.needDetail'),
				type: 'info',
			});
		}
	};

	const showEmpty =
		!loading && !failed && items.length === 0 && cursorRef.current === null;

	return (
		<div className="text-textcolor flex h-full min-h-0 flex-col py-3.5 pl-3.5 text-sm">
			{failed && items.length === 0 ? (
				<div className="flex flex-1 flex-col items-center justify-center gap-3 pr-3.5">
					<p className="text-textcolor/70">{t('vocabDetailList.failed')}</p>
					<Button type="button" variant="outline" size="sm" onClick={retry}>
						{t('vocabDetailList.retry')}
					</Button>
				</div>
			) : loading && items.length === 0 ? (
				<Loading className="h-full" />
			) : (
				<ScrollArea
					ref={viewportRef}
					className="box-border flex min-h-0 flex-1 flex-col"
					scrollbarClassName="right-0 w-1.5 border-l-0 p-0"
				>
					<div className="pr-3.5">
						{showEmpty ? (
							<p className="text-textcolor/55 px-2 py-4 text-center">
								{t('vocabDetailList.empty')}
							</p>
						) : (
							<>
								<div className="grid w-full grid-cols-2 gap-2">
									{items.map((row) => {
										const time = new Date(row.updatedAt);
										const stamp = Number.isNaN(time.getTime())
											? ''
											: time.toLocaleString(locale);
										return (
											<Button
												key={row.lemma}
												type="button"
												variant="ghost"
												onClick={() => onPick(row.lemma)}
												className="bg-theme/5 border-theme/5 hover:bg-theme/10 h-auto w-full min-w-0 flex-col items-stretch gap-0.5 rounded-md border px-2 py-1.5 text-left font-normal whitespace-normal"
											>
												<span className="truncate font-medium">
													{row.lemma}
												</span>
												{row.glossZh ? (
													<span className="text-textcolor/60 line-clamp-1 text-xs">
														{row.glossZh}
													</span>
												) : null}
												{stamp ? (
													<span className="text-textcolor/40 text-xs tabular-nums">
														{stamp}
													</span>
												) : null}
											</Button>
										);
									})}
								</div>
								<div ref={sentinelRef} className="h-px" aria-hidden />
								{failed ? (
									<div className="flex justify-center py-2">
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={retry}
										>
											{t('vocabDetailList.retry')}
										</Button>
									</div>
								) : null}
								{loading ? (
									<p className="text-textcolor/45 text-center text-xs mt-2">
										{t('common.loadingMore')}
									</p>
								) : null}
							</>
						)}
					</div>
				</ScrollArea>
			)}
		</div>
	);
}
```

#### 插件 `src/views/vocab-detail-import/index.ts`

vite 的 `./VocabDetailImport` 指向这个文件。

```ts
import '@/styles.css';

export { default } from './panel';
```

#### 插件 `src/views/vocab-detail-import/panel.tsx`

导入单词解析的完整实现。目标库来自 `import-drawer` 的载荷。选文件走 `pickJsonFile`，没有这条命令时才退回隐藏的文件输入。点已导入的词同样调用 `openCard`。

```tsx
import Confirm from '@design/Confirm';
import { Button, ScrollArea } from '@ui/index';
import { CheckCircle, Copy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHostLocale, useI18n } from '@/hooks';
import {
	importTargetFromPayload,
	type PointModule,
} from '@/views/vocab-detail/point';
import { IMPORT_PROMPT } from './prompt';

type Target = { libraryId: string; title: string };

type HostApi = {
	locale?: 'zh-CN' | 'en-US';
	http?: {
		get: (url: string) => Promise<unknown>;
		post: (url: string, body?: unknown) => Promise<unknown>;
		delete: (url: string) => Promise<unknown>;
	};
	ui?: {
		showToast: (options: {
			message: string;
			type?: 'success' | 'error' | 'info';
		}) => void;
	};
	modules?: { point?: PointModule };
};

type ImportResult = {
	imported: number;
	overwritten: number;
	skippedNotInLibrary: number;
	skippedInvalid: number;
	skippedNotInLibrarySample: string[];
	skippedInvalidSample: string[];
	overwrittenSample: string[];
};

type ImportedWord = {
	lemma: string;
	glossZh: string;
	updatedAt: string;
};

function unwrap(res: unknown): Record<string, unknown> {
	const body =
		res && typeof res === 'object' && 'data' in res
			? (res as { data: unknown }).data
			: res;
	return body && typeof body === 'object'
		? (body as Record<string, unknown>)
		: {};
}

function asCount(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asSample(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === 'string');
}

function readResult(res: unknown): ImportResult {
	const body = unwrap(res);
	return {
		imported: asCount(body.imported),
		overwritten: asCount(body.overwritten),
		skippedNotInLibrary: asCount(body.skippedNotInLibrary),
		skippedInvalid: asCount(body.skippedInvalid),
		skippedNotInLibrarySample: asSample(body.skippedNotInLibrarySample),
		skippedInvalidSample: asSample(body.skippedInvalidSample),
		overwrittenSample: asSample(body.overwrittenSample),
	};
}

function unwrapImported(res: unknown): {
	items: ImportedWord[];
	nextCursor: string | null;
	total: number;
} {
	const body = unwrap(res);
	const items = Array.isArray(body.items)
		? body.items.flatMap((row) => {
				if (!row || typeof row !== 'object') return [];
				const item = row as {
					lemma?: unknown;
					glossZh?: unknown;
					updatedAt?: unknown;
				};
				if (typeof item.lemma !== 'string' || !item.lemma) return [];
				return [
					{
						lemma: item.lemma,
						glossZh: typeof item.glossZh === 'string' ? item.glossZh : '',
						updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : '',
					},
				];
			})
		: [];
	if (
		!('nextCursor' in body) ||
		(body.nextCursor != null && typeof body.nextCursor !== 'string')
	) {
		throw new Error('');
	}
	const total = Number(body.total);
	const nextCursor =
		typeof body.nextCursor === 'string' && body.nextCursor
			? body.nextCursor
			: null;
	return {
		items,
		nextCursor,
		total: Number.isFinite(total) ? total : items.length,
	};
}

function errorText(cause: unknown, fallback: string): string {
	if (cause instanceof Error && cause.message.trim()) return cause.message;
	if (cause && typeof cause === 'object' && 'message' in cause) {
		const message = (cause as { message?: unknown }).message;
		if (typeof message === 'string' && message.trim()) return message;
	}
	return fallback;
}

export default function VocabImportPanel({ api }: { api: HostApi }) {
	const { t, locale } = useI18n();
	useHostLocale(api);
	const point = api.modules?.point;
	const httpRef = useRef(api.http);
	httpRef.current = api.http;
	const [target, setTarget] = useState<Target | null>(() =>
		importTargetFromPayload(point?.getPayload('import-drawer') ?? null),
	);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<ImportResult | null>(null);
	const [confirmClear, setConfirmClear] = useState(false);
	const [copied, setCopied] = useState(false);
	const [items, setItems] = useState<ImportedWord[]>([]);
	const [total, setTotal] = useState(0);
	const [listLoading, setListLoading] = useState(false);
	const [listError, setListError] = useState<string | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const genRef = useRef(0);
	const cursorRef = useRef<string | null | undefined>(undefined);
	const loadingRef = useRef(false);
	const holdRef = useRef(false);
	const libraryRef = useRef('');
	const copiedTimer = useRef<number | null>(null);
	const listViewportRef = useRef<HTMLDivElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!point) return;
		return point.subscribe(() =>
			setTarget(importTargetFromPayload(point.getPayload('import-drawer'))),
		);
	}, [point]);

	useEffect(
		() => () => {
			if (copiedTimer.current != null) window.clearTimeout(copiedTimer.current);
		},
		[],
	);

	const loadPage = useCallback(async () => {
		const libraryId = libraryRef.current;
		if (
			!libraryId ||
			loadingRef.current ||
			holdRef.current ||
			cursorRef.current === null
		) {
			return;
		}
		const http = httpRef.current;
		const gen = genRef.current;
		const cursor = cursorRef.current;
		if (!http?.get) {
			holdRef.current = true;
			setListError(t('vocabImport.listFailed'));
			setListLoading(false);
			return;
		}
		loadingRef.current = true;
		setListLoading(true);
		const url = `/english-learning/vocab-detail/import?libraryId=${encodeURIComponent(libraryId)}${
			cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
		}`;
		try {
			const page = unwrapImported(await http.get(url));
			if (gen !== genRef.current) return;
			cursorRef.current = page.nextCursor;
			setItems((prev) => (cursor ? [...prev, ...page.items] : page.items));
			setTotal(page.total);
			setListError(null);
		} catch (cause) {
			if (gen !== genRef.current) return;
			holdRef.current = true;
			setListError(errorText(cause, t('vocabImport.listFailed')));
		} finally {
			if (gen === genRef.current) {
				loadingRef.current = false;
				setListLoading(false);
			}
		}
	}, [t]);

	const reloadFirstPage = () => {
		genRef.current += 1;
		cursorRef.current = undefined;
		holdRef.current = false;
		loadingRef.current = false;
		setItems([]);
		setTotal(0);
		setListError(null);
		void loadPage();
	};

	useEffect(() => {
		libraryRef.current = target?.libraryId ?? '';
		genRef.current += 1;
		cursorRef.current = undefined;
		holdRef.current = false;
		loadingRef.current = false;
		setItems([]);
		setTotal(0);
		setListError(null);
		if (!libraryRef.current) {
			setListLoading(false);
			return;
		}
		void loadPage();
	}, [target?.libraryId, loadPage]);

	useEffect(() => {
		const root = listViewportRef.current;
		const sentinel = sentinelRef.current;
		if (!root || !sentinel || listError || cursorRef.current === null) return;
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries[0]?.isIntersecting) return;
				void loadPage();
			},
			{ root, rootMargin: '120px 0px', threshold: 0 },
		);
		io.observe(sentinel);
		return () => io.disconnect();
	}, [items.length, listError, listLoading, loadPage]);

	const copyPrompt = async () => {
		try {
			await navigator.clipboard.writeText(IMPORT_PROMPT);
			setCopied(true);
			setError(null);
			if (copiedTimer.current != null) window.clearTimeout(copiedTimer.current);
			copiedTimer.current = window.setTimeout(() => {
				copiedTimer.current = null;
				setCopied(false);
			}, 1000);
		} catch {
			setError(t('vocabImport.copyFailed'));
		}
	};

	const onFile = async (file: File | undefined) => {
		if (!file || !target) return;
		setError(null);
		setResult(null);
		let parsed: unknown;
		try {
			parsed = JSON.parse(await file.text());
		} catch {
			setError(t('vocabImport.badFile'));
			return;
		}
		const fileItems =
			parsed && typeof parsed === 'object' && 'items' in parsed
				? (parsed as { items?: unknown }).items
				: null;
		if (!Array.isArray(fileItems)) {
			setError(t('vocabImport.badFile'));
			return;
		}
		if (fileItems.length > 2000) {
			setError(t('vocabImport.tooMany'));
			return;
		}
		const http = httpRef.current;
		if (!http) return;
		setBusy(true);
		try {
			const res = await http.post('/english-learning/vocab-detail/import', {
				libraryId: target.libraryId,
				items: fileItems,
			});
			setResult(readResult(res));
			reloadFirstPage();
		} catch (cause) {
			setError(errorText(cause, t('vocabImport.failed')));
		} finally {
			setBusy(false);
		}
	};

	const clearManual = async () => {
		if (!target) return;
		const http = httpRef.current;
		if (!http) return;
		setBusy(true);
		setError(null);
		try {
			await http.delete(
				`/english-learning/vocab-detail/import?libraryId=${encodeURIComponent(target.libraryId)}`,
			);
			setResult(null);
			setConfirmClear(false);
			reloadFirstPage();
		} catch (cause) {
			setError(errorText(cause, t('vocabImport.failed')));
		} finally {
			setBusy(false);
		}
	};

	const chooseFile = async () => {
		const pick = point?.command;
		if (!pick) {
			fileRef.current?.click();
			return;
		}
		try {
			const file = await Promise.resolve(
				point.command('pickJsonFile', undefined) as Promise<File | null>,
			);
			if (file) await onFile(file);
		} catch (cause) {
			const message = cause instanceof Error ? cause.message : '';
			setError(
				message === 'accept'
					? t('vocabImport.badFile')
					: t('vocabImport.failed'),
			);
		}
	};

	const onPick = (lemma: string) => {
		const opened = point?.command('openCard', lemma) === true;
		if (!opened) {
			api.ui?.showToast({
				message: t('vocabImport.needDetail'),
				type: 'info',
			});
		}
	};

	const showEmpty =
		Boolean(target) && !listLoading && !listError && items.length === 0;
	const detailGroups = (
		[
			[
				t('vocabImport.statReplaced'),
				result?.overwrittenSample ?? [],
				'bg-teal-500/5 border border-teal-500/6',
			],
			[
				t('vocabImport.statMissing'),
				result?.skippedNotInLibrarySample ?? [],
				'bg-amber-500/5 border border-amber-500/6',
			],
			[
				t('vocabImport.statInvalid'),
				result?.skippedInvalidSample ?? [],
				'bg-rose-500/5 border border-rose-500/6',
			],
		] as const
	).filter(([, words]) => words.length > 0);

	return (
		<div className="text-textcolor flex h-full min-h-0 flex-col text-sm">
			<div className="shrink-0 space-y-1.5 px-3.5 pt-2.5">
				<p className="min-w-0 truncate font-medium">
					{target?.title ?? t('vocabImport.noLibrary')}
				</p>
				<div className="mt-1 flex items-center justify-between gap-2">
					<span className="text-textcolor text-[13px]">
						{t('vocabImport.promptTitle')}
					</span>
					<button
						type="button"
						className="text-textcolor/70 hover:text-textcolor flex cursor-pointer items-center gap-1 text-[13px]"
						onClick={() => void copyPrompt()}
					>
						{copied ? <CheckCircle size={13} /> : <Copy size={13} />}
						{copied ? t('vocabImport.copied') : t('vocabImport.copyPrompt')}
					</button>
				</div>
			</div>
			<div className="bg-theme/5 border-theme/5 mx-3.5 mt-1.5 flex min-h-0 flex-2 flex-col overflow-hidden rounded-md border py-2">
				<ScrollArea
					className="min-h-0 flex-1"
					scrollbarClassName="right-0 w-1.5 border-l-0 p-0"
				>
					<p className="text-textcolor/70 px-2 text-[13px] leading-relaxed whitespace-pre-wrap">
						{IMPORT_PROMPT}
					</p>
				</ScrollArea>
			</div>
			<p className="text-textcolor/70 shrink-0 px-3.5 pt-1.5 pb-2 text-xs leading-relaxed text-justify">
				{t('vocabImport.hint')}
			</p>
			<p className="flex min-w-0 shrink-0 items-baseline gap-2 px-3.5 pb-1.5 text-[13px]">
				<span className="text-textcolor shrink-0">
					{t('vocabImport.importedTitle')}
				</span>
				<span className="text-textcolor/50 truncate font-normal">
					{t('vocabImport.importedSummary', {
						total: String(total),
						loaded: String(items.length),
					})}
				</span>
			</p>
			<ScrollArea
				ref={listViewportRef}
				className="box-border flex min-h-0 flex-5 flex-col px-3.5"
			>
				{listLoading && items.length === 0 ? (
					<p className="text-textcolor/55 px-2 py-6 text-center text-xs">
						{t('common.loading')}
					</p>
				) : listError && items.length === 0 ? (
					<div className="flex flex-col items-center gap-3 px-2 py-6">
						<p className="text-textcolor/70 text-center">{listError}</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								holdRef.current = false;
								setListError(null);
								void loadPage();
							}}
						>
							{t('vocabImport.retry')}
						</Button>
					</div>
				) : showEmpty ? (
					<p className="text-textcolor/55 px-2 py-4 text-center">
						{t('vocabImport.importedEmpty')}
					</p>
				) : (
					<div className="grid w-full grid-cols-2 gap-2">
						{items.map((row) => {
							const time = new Date(row.updatedAt);
							const stamp = Number.isNaN(time.getTime())
								? ''
								: time.toLocaleString(locale);
							return (
								<Button
									key={row.lemma}
									type="button"
									variant="ghost"
									onClick={() => onPick(row.lemma)}
									className="bg-theme/5 border-theme/5 hover:bg-theme/10 h-auto w-full min-w-0 flex-col items-stretch gap-0.5 rounded-md border px-2 py-1.5 text-left font-normal whitespace-normal"
								>
									<span className="truncate font-medium">{row.lemma}</span>
									{row.glossZh ? (
										<span className="text-textcolor/60 line-clamp-1 text-xs">
											{row.glossZh}
										</span>
									) : null}
									{stamp ? (
										<span className="text-textcolor/40 text-xs tabular-nums">
											{stamp}
										</span>
									) : null}
								</Button>
							);
						})}
						{cursorRef.current !== null ? (
							<div
								ref={sentinelRef}
								className="col-span-2 h-1 w-full"
								aria-hidden
							/>
						) : null}
						{listError ? (
							<div className="col-span-2 flex justify-center py-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => {
										holdRef.current = false;
										setListError(null);
										void loadPage();
									}}
								>
									{t('vocabImport.retry')}
								</Button>
							</div>
						) : null}
						{listLoading ? (
							<p className="text-textcolor/45 col-span-2 mt-2 text-center text-xs">
								{t('common.loadingMore')}
							</p>
						) : null}
					</div>
				)}
			</ScrollArea>
			{error ? (
				<p className="shrink-0 px-3.5 pt-2.5 text-xs text-rose-500">{error}</p>
			) : null}
			{result ? (
				<p className="text-textcolor shrink-0 px-3.5 pt-2.5 text-[13px] leading-5">
					{t('vocabImport.statAdded')} {result.imported}
					<span className="text-textcolor/25 px-1.5">·</span>
					{t('vocabImport.statReplaced')} {result.overwritten}
					<span className="text-textcolor/25 px-1.5">·</span>
					{t('vocabImport.statMissing')} {result.skippedNotInLibrary}
					<span className="text-textcolor/25 px-1.5">·</span>
					{t('vocabImport.statInvalid')} {result.skippedInvalid}
				</p>
			) : null}
			{detailGroups.length > 0 ? (
				<ScrollArea
					className="mt-1 min-h-0 flex-3"
					scrollbarClassName="right-0 w-1.5 border-l-0 p-0"
				>
					<div className="space-y-2 px-3.5">
						{detailGroups.map(([label, words, tone]) => (
							<div key={label} className={`${tone} rounded-md px-2 py-2`}>
								<p className="text-textcolor text-[13px]">
									{label} {words.length}
								</p>
								<p className="text-textcolor/70 mt-1 text-xs leading-5">
									{words.join('、')}
								</p>
							</div>
						))}
					</div>
				</ScrollArea>
			) : null}
			<div className="bg-background flex shrink-0 items-center justify-end gap-2 px-3.5 pt-2.5 pb-3.5">
				<Button
					type="button"
					size="sm"
					disabled={!target || busy}
					className="flex-1"
					onClick={() => void chooseFile()}
				>
					{t('vocabImport.chooseFile')}
				</Button>
				<Button
					type="button"
					variant="default"
					size="sm"
					className="flex-1 bg-orange-400 hover:bg-orange-500"
					disabled={!target || busy || total === 0}
					onClick={() => setConfirmClear(true)}
				>
					{t('vocabImport.clear')}
				</Button>
			</div>
			<input
				ref={fileRef}
				type="file"
				accept="application/json,.json"
				className="hidden"
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = '';
					void onFile(file);
				}}
			/>
			<Confirm
				open={confirmClear}
				onOpenChange={setConfirmClear}
				title={t('vocabImport.clearTitle')}
				description={t('vocabImport.clearDesc')}
				confirmVariant="destructive"
				onConfirm={() => void clearManual()}
			/>
		</div>
	);
}
```
