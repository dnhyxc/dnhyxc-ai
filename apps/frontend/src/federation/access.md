# 页面插件接入

这篇说明怎么从零接上一个**嵌在主项目页面里**的插件。插件只拿到 `api.modules.point`。主项目事先在 `points/catalog.ts` 登记点和槽，页面把入口画出来。之后再增加挂在同一点、同一槽上的插件，主项目不用改。第 11 节是已经接上的三个插件：主项目接线的意图，以及插件仓库里的完整实现。

学习笔记、聊天会话入口仍是专属模块（`modules:learningNotes`、`modules:chat`）。新的页面内嵌插件不要再加 `modules/<pluginId>`。

## 1. 先判断要不要改主项目

| 你要做的事 | 主项目 |
| --- | --- |
| 插件挂到下面表格里**已经有的点**和**已经有的槽** | 不改。只写插件，并在注册表声明 `host.surface`、`host.slot`、`modules:point` |
| 某个页面上还没有可挂的位置 | 改 `points/catalog.ts` 的 `pointDefs`，并在那个页面放上 `HostPoint` |
| 插件要调用「当前这一页才能做」的事，例如跳到阅读位置、导出这一篇 | 目录里先声明命令名，页面用 `bindPointCommand` 注册实现，离开页面时解绑 |
| 插件要调用「不依赖当前页状态」的事，例如朗读、选 JSON、打开详解 | 目录里声明命令名，实现写在 `points/command.ts`，应用启动时注册一次 |

下面这些文件**不用**为新插件修改：`runtime/index.ts`、`points/api.ts`、`points/session.ts`、`packages/federation-kit`。`buildModules` 看到 `modules:point` 和 `host.surface` 后，会按目录把冻结好的 `api.modules.point` 交给这个插件。`host.surface` 对不上目录时，插件拿不到 `modules.point`。

## 2. 已经登记的点

点 id 在 `points/catalog.ts` 的 `POINT` 里。目录写的是四种角色，`compilePoint` 编译成槽。插件的 `host.surface` 必须等于点 id，`host.slot` 必须等于编译结果里的某个槽名。

| 点 id | 页面自己挂的槽 | 布局挂的抽屉 | 上下文 | 信号 | 命令 |
| --- | --- | --- | --- | --- | --- |
| `english.vocab.card` | `card-action` | `drawer`（`persist`，`order: 1`） | 无 | `pending` | `play`、`stop` |
| `english.vocab.library` | `toolbar`、`item-action`、`library-card-action`；列表抽屉 `drawer` 由页面挂（角色 `owner: 'page'`，非模态） | `item-drawer`、`import-drawer`（导入抽屉常驻、非模态、`order: 0`） | `libraryId` | `stats` | `pickJsonFile`、`openCard` |
| `english.classic.card` | `card-action` | `drawer` | 无 | 无 | 无 |
| `english.classic.library` | `toolbar`、`item-action`、`library-card-action` | `item-drawer`、`drawer`、`import-drawer` | `libraryId` | 无 | 无 |
| `english.mistakes` | `toolbar`、`item-action` | `drawer` | `kind` | 无 | 无 |
| `english.review` | `toolbar`、`item-action` | `drawer` | `kind` | 无 | 无 |
| `english.favorites` | `toolbar`、`item-action` | `drawer` | `kind` | 无 | 无 |
| `english.dailyReading` | `toolbar`、`item-action` | `drawer` | `origin` | 无 | 无 |
| `english.dailyReading.article` | 无槽。角色是 `command` | 无 | 无 | 无 | `openReading`、`exportWords` 由英语学习壳绑定；其余在启动时绑定 |
| `ebook.read` | 阅读页放 `HostPoint`：`toolbar`，以及 `drawer` 的 `part="trigger"` 和正文 | 不由英语学习布局挂（`owner: 'page'`） | `bookId`、`bookTitle` | 无 | `navigateToCfi`、`openThought` 由阅读页绑定；`closeIdeasList` 启动时绑定 |

词库、语句库的行按钮打开的是 `item-drawer`。错题、复习、收藏、每日阅读的行按钮打开的是同一个 `drawer`。语句库目录里还有一个名叫 `drawer` 的槽，当前页面没有按钮去打开它，新插件不要挂到这个槽。

词库列表抽屉打开时会盖住词卡详解。词卡详解重新露出来时，词库列表和导入抽屉都只隐藏、不关闭。这两条写在目录的 `stacks` 里，不写在某一个点上。隐藏是同一帧把面板透明度设为 0 并关掉滑入动画。载荷带 `source: 'list'`，或这次打开盖住了一个已经开着的抽屉时，新抽屉不从右侧滑入。

错题、复习、收藏、每日阅读用 `listPoint` 就够：顶栏加一条 `item-action` 打开 `drawer`。词库、语句库、文章点和阅读页角色不同，按下一节抄，不要只改 `contextKeys`。

### 2.1 先按现象选一段目录

| 你要的效果 | 抄哪一段 |
| --- | --- |
| 顶栏 + 每行一枚按钮 + 一个共用抽屉 | `listPoint`，见第 10 节 |
| 卡片角落一枚按钮，抽屉关掉时要播退场，按钮在生成时转圈，插件能朗读 | `english.vocab.card` |
| 卡片角落一枚按钮，普通抽屉，没有转圈、没有命令 | `english.classic.card` |
| 同一页上有「行详情」和「整页列表」两个抽屉，行按钮不能把列表抽屉顶掉 | `english.vocab.library` 的 `item-action` / `item-drawer`，列表抽屉另用 `drawer` |
| 列表抽屉的标题要放统计数字 | 抽屉角色 `owner: 'page'`，页面按钮调用 `openPoint` / `closePoint`，正文用 `<HostPoint slot="drawer" title={…} />` |
| 打开列表抽屉时，另一张已经打开的抽屉先藏起来，关掉列表后再出现 | `stacks` 里的 `cover` |
| 卡片上还有第二枚按钮，打开另一层抽屉，并且不锁住下面那层 | `library-card-action` 打开 `import-drawer`，抽屉 `modal: false`；让位写在 `stacks` 的 `yield` |
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
	// play / stop 在 points/command.ts 注册，启动后任何页面都能调用
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
| `drawer` | 角色 `page`，`owner: 'page'`，`modal: false` | 整库列表。布局不渲染它。词库页按钮 `openPoint` / `closePoint`，正文是 `<HostPoint slot="drawer" title={统计} />`。离开英语学习时布局仍会 `closePoint` |
| `library-card-action` | `kind: 'action'`，`opens: 'import-drawer'` | 词库卡片上的导入按钮，和行按钮不是同一个槽。点击把 `{ libraryId, title }` 写入 `import-drawer` |
| `import-drawer.persist` | `true` | 关掉导入后组件还留着，抽屉能播退场。插件若已停用而槽还开着，会把槽关掉 |
| `import-drawer.modal` | `false` | 不锁焦点，遮罩不挡住下层。词卡详解才能叠在导入上面继续操作 |
| `import-drawer.order` | `0` | 布局挂载顺序。词卡抽屉是 `order: 1`，数字更大，后挂，盖在导入上面 |
| `import-drawer` 的让位 | `stacks` 里 `yield`，上层是词卡 `drawer` | 词卡详解 `open` 且没有被盖住时，导入抽屉只隐藏，不执行关闭。词库列表抽屉也有一条同样的让位 |
| `contextKeys` | `['libraryId']` | 整页只有当前词库 id。页面 `usePointContext(POINT.vocabLibrary, { libraryId })`。空串会被丢掉。列表插件读 `getContext().libraryId`，不从点击载荷里拿 |
| `signals` | `['stats']` | 只允许列表插件回写 `{ total, loaded }`。没写 `pending`，这个点上的按钮不会因 `publishSignal('pending')` 转圈 |
| `commands` | `pickJsonFile`、`openCard` | 这两个不依赖词库页里的 React state，实现在 `points/command.ts`。`openCard` 打开的是**词卡点**的抽屉，所以列表可以保持打开 |
| 盖住词卡 | `stacks` 的 `cover`：打开词库 `drawer` 时盖住词卡 `drawer` | 列表打开时词卡详解保持 `open: true` 和原来的词，只多一个 `covered`。列表 `closePoint` 后揭开，详解在原处出现 |

对应代码写在 `pointDefs` 里，不手写编译后的 `slots`：

```ts
{
  id: POINT.vocabLibrary,
  roles: [
    { kind: 'toolbar' },
    { kind: 'toggle', slot: 'item-action', opens: 'item-drawer', payload: 'record' },
    {
      kind: 'page',
      slot: 'drawer',
      payload: 'record',
      trigger: 'custom',
      drawer: { owner: 'page', modal: false },
    },
    {
      kind: 'toggle',
      slot: 'library-card-action',
      opens: 'import-drawer',
      payload: 'record',
      drawer: { persist: true, modal: false, order: 0 },
    },
  ],
  contextKeys: ['libraryId'],
  signals: ['stats'],
  commands: ['pickJsonFile', 'openCard'],
}
```

盖住和让位不写在这个点上，写在同文件的 `stacks`：

```ts
{ op: 'cover', whenOpen: { point: POINT.vocabLibrary, slot: 'drawer' }, target: { point: POINT.vocabCard, slot: 'drawer' } }
{ op: 'yield', whileVisible: { point: POINT.vocabCard, slot: 'drawer' }, self: { point: POINT.vocabLibrary, slot: 'import-drawer' } }
{ op: 'yield', whileVisible: { point: POINT.vocabCard, slot: 'drawer' }, self: { point: POINT.vocabLibrary, slot: 'drawer' } }
```

页面对三个入口各放一个 `HostPoint`，列表抽屉也是 `HostPoint`：

```tsx
usePointContext(POINT.vocabLibrary, libraryKey ? { libraryId: libraryKey } : null);

<HostPoint pointId={POINT.vocabLibrary} slot="toolbar" />
<HostPoint pointId={POINT.vocabLibrary} slot="item-action" payload={{ word, pos, ipa, translationZh, example }} />
<HostPoint pointId={POINT.vocabLibrary} slot="library-card-action" payload={{ libraryId: lib.id, title }} />
<HostPoint pointId={POINT.vocabLibrary} slot="drawer" title={statsHeading} />
```

「单词解析」按钮在页面上。已经开着就 `closePoint`，否则 `openPoint(POINT.vocabLibrary, listPlugin.id, 'drawer', {})`。词库 id 在上下文里。开关只在槽位会话里，页面不再保存 `openPluginId`。

插件按槽登记，不要混用：

| 插件做什么 | `host.slot` | 读什么 |
| --- | --- | --- |
| 顶栏 | `toolbar` | `getContext().libraryId`，或 `publishSignal('stats', { total, loaded })` |
| 每一行的详解 | `item-action` | `getPayload('item-drawer')` |
| 整库列表 | `drawer` | `getContext().libraryId`。打开时载荷是 `{}` |
| 卡片上的导入 | `library-card-action` | `getPayload('import-drawer')`，字段是 `libraryId`、`title` |

`pickJsonFile` 和 `openCard` 在 `points/command.ts` 里，启动时绑定。导入插件调用 `command('pickJsonFile', undefined)`。列表里点开某个词调用 `command('openCard', word)`，它打开词卡抽屉，载荷固定带 `source: 'list'`，不会关掉单词库的列表抽屉。这一次打开详解不滑入。列表和导入面板在词卡重新露出来的同一帧隐藏。从词卡按钮打开不带这个字段，仍会滑入。

### 2.5 语句库：槽和单词库同名，叠层规则没有抄过去

语句库在 `pointDefs` 里单独写角色：顶栏、行按钮打开 `item-drawer`、卡片按钮打开 `import-drawer`，另有一个 `page` 角色的 `drawer`，`owner` 是 `layout`。`contextKeys` 是 `libraryId`。没有信号，没有命令。

和单词库的差别：

- 三个抽屉都用默认外壳：英语学习布局挂普通模态抽屉，不常驻。
- `stacks` 里没有语句库，打开任何抽屉都不会藏起语句卡，导入也不会让位。
- 没有 `stats`，`publishSignal('stats', …)` 会被丢掉。
- 没有 `pickJsonFile` / `openCard`。
- 名叫 `drawer` 的槽目前没有页面按钮打开。新插件不要把 `host.slot` 写成 `drawer`，应写 `toolbar`、`item-action` 或 `library-card-action`。确认注册表没有插件挂这个槽之后再删。

行插件读 `getPayload('item-drawer')`，载荷字段是 `english`、`translationZh`、`source`、`noteZh`。

如果语句库以后也要「列表盖住语句卡、导入层让位」，按单词库补 `drawer` 外壳、`stacks`、`signals` 和 `commands`，并让页面自己挂 `drawer`。只改槽名不会得到那些行为。

### 2.6 阅读页：页面挂 `HostPoint`，只有两条命令绑在页面上

阅读页不在英语学习布局里。抽屉角色是 `page`，`trigger: 'icons'`，`owner: 'page'`。布局不挂它。图标和抽屉都在 `views/ebook/read.tsx` 里用 `HostPoint`。

```tsx
<HostPoint pointId={POINT.ebookRead} slot="toolbar" />
<HostPoint pointId={POINT.ebookRead} slot="drawer" part="trigger" />
<HostPoint pointId={POINT.ebookRead} slot="drawer" drawerStyle={chromeStyle} />
```

顶栏插件 `host.slot` 写 `toolbar`，只读 `getContext()`。抽屉插件 `host.slot` 写 `drawer`。点图标时 `HostPoint` 自己 `openPoint`，载荷是空对象。离开阅读页或切到 PDF 时页面 `closePoint(POINT.ebookRead, 'drawer')`。

`navigateToCfi` 和 `openThought` 要当前这本书的渲染器，在阅读页 effect 里 `bindPointCommand`。EPUB 就绪时 `publishPointContext(POINT.ebookRead, { bookId, bookTitle })`，PDF 或卸载时发布 `null` 并解绑。`closeIdeasList` 在 `command.ts` 启动时绑定，只调用 `closePoint`，不读页面 state。

插件调用：

```ts
point.command('navigateToCfi', cfi);
point.command('openThought', thought);
point.command('closeIdeasList', undefined);
```

离开阅读页后，前两条变成 `POINT_COMMAND_UNBOUND`。`closeIdeasList` 仍然可用，关掉的是阅读页那只抽屉。

### 2.7 自己加一种特殊页时改哪些字段

1. 在 `POINT` 和 `pointDefs` 里加一项。标准列表用 `listPoint`。多种抽屉就写多条 `toggle` 或 `page` 角色，不要手写编译后的 `slots`。
2. 每个 `toggle` 用 `opens` 指向它自己的抽屉名。两个按钮若打开同一个槽，后一次点击会盖住前一个插件的载荷。
3. 抽屉交给英语学习布局时不写 `drawer`，或只覆盖 `persist`、`modal`、`order`。页面要自己放标题或图标时，角色写成 `page` 且 `owner: 'page'`，页面放 `HostPoint`。
4. 打开 A 应该把 B 藏起来而不是关掉时，在 `stacks` 里加一条 `cover`。B 可见时 A 只隐藏，加一条 `yield`。
5. 整页都会变的数据放进 `contextKeys`，点某一行才有的数据放进 `HostPoint` 的 `payload`。
6. 按钮要转圈就加 `signals: ['pending']`，并且要有 `payload: 'word'` 的 `toggle`。顶栏要数字就加 `signals: ['stats']`，页面用 `readStats` 配 `subscribeSignals`，不要把 `readStats` 直接交给 `useSyncExternalStore`。
7. 命令若闭包了某一页的 state，写进 `commands`，并在该页 `bindPointCommand`。不依赖页面闭包的命令写到 `points/command.ts`。

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

在 `POINT` 里增加常量，并在 `pointDefs` 里增加一项。槽位形状与错题集相同，可以直接套 `listPoint`：

```ts
export const POINT = {
	// 短名字只在主项目代码里用。注册表 host.surface 要写后面的字符串 english.practice
	practice: 'english.practice',
} as const;

// pointDefs 的一项。第一个参数是点 id，第二个参数是上下文白名单，只允许字段 kind
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

阅读页在 EPUB 就绪后发布 `bookId`、`bookTitle`，并绑定 `navigateToCfi`、`openThought`。`closeIdeasList` 在启动时绑定，不跟阅读页走。PDF 或离开页面时发布 `null` 并解绑前两条。写法在 `apps/frontend/src/views/ebook/read.tsx`。英语学习壳同样只绑定 `openReading` 和 `exportWords`。

`bindPointCommand` 返回解绑函数。后一次注册盖住前一次；旧的解绑函数只会删掉自己那次注册的函数，不会把新的删掉。

### 4.4 全站命令

实现不闭包页面 state 时，写在 `points/command.ts`。`runtime/index.ts` 已经导入这个文件，不用为新命令再改 runtime。现成例子：

- `english.vocab.card` 的 `play` / `stop`
- `english.vocab.library` 的 `pickJsonFile` / `openCard`
- `english.dailyReading.article` 的 `play` / `stop` / `detailEntries` / `openDetail` / `openDetailList` / `openDetailImport`
- `ebook.read` 的 `closeIdeasList`

`openCard` 只打开词卡抽屉，不负责再点一次关闭。词是空的，或详解插件没启用，返回 `false`。

### 4.5 页面不在英语学习布局下

阅读页就是这样。抽屉角色写 `owner: 'page'`，页面自己放 `HostPoint`（图标用 `part="trigger"`，正文用默认 `part`），并用 `publishPointContext`、`bindPointCommand` 接上上下文和那两条页面命令。离开页面时要 `closePoint`。英语学习布局卸载时仍会顺带关掉阅读页抽屉，没打开过时这是空操作。

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
- 页面自己打开的抽屉（词库列表、阅读页）：`slot` 写成那个抽屉槽，例如 `drawer`。词库列表由页面按钮 `openPoint`；阅读页由图标 `HostPoint` 打开。

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
| `page: true` | 角色 `owner: 'page'` 编译出来的。页面自己放 `HostPoint`。布局只在离开英语学习时关闭 |
| `persist: true` | 抽屉组件保持挂载，关闭时能播退场。插件停用后若槽还开着，会把槽关掉 |
| `modal: false` | 不锁焦点，遮罩不挡下面的操作。抽屉开着就锁定页面滚动，让位时也不先解开 |
| `order` | 小的先挂，在下层。不写按 `2` |
| `stacks` | 不在 `layout` 上。`cover` 把另一只抽屉标成被盖住，仍算打开。`yield` 在上层可见时把本抽屉画成透明，不关闭 |

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

`pointDefs` 编译之后的结果，运行时放在 `hostPoints` 里。角色没写上的能力，插件就没有。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | `string` | 点的唯一名字，同时也是注册表 `host.surface`。建议 `业务.页面`，例如 `english.practice`。插件不能把这个 id 传进五个方法里，闭包已经固定 |
| `slots` | `HostPointSlot[]` | 这个点允许出现的位置。名字不在这里的槽，`HostPoint` 渲染空，`openPoint` 返回 `false` |
| `contextKeys` | `readonly string[]` | 页面可以交给插件的键。`publishPointContext` 会丢掉名单以外的键。空数组表示这个点没有页面上下文，`getContext()` 在发布过非空对象后仍可能是 `null` |
| `signals` | `('pending' \| 'stats')[]` | 插件允许回写的信号。只能是这两项。空数组时任何 `publishSignal` 都被丢掉 |
| `commands` | `readonly string[]` | 插件允许调用的命令名。未列入的名字抛 `UNKNOWN_POINT_COMMAND`，不会去查有没有绑定 |

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
| `order` | `number` | `2` | 布局挂载顺序。数字小的先挂，在下层 |

盖住和让位不在 `layout` 上，见目录里的 `stacks`。`concealOf` 为真时抽屉仍是打开的，只是这一帧透明。

### 9.3 页面组件 `HostPoint`

```tsx
<HostPoint
  pointId={string}
  slot={string}
  payload?: Record<string, unknown>
  part?: 'trigger' | 'body'
  title?: ReactNode
  className?: string
  drawerClassName?: string
  drawerStyle?: CSSProperties
/>
```

| 参数 | 何时生效 | 含义 |
| --- | --- | --- |
| `pointId` | 必填 | `POINT` 里的 id。目录没有这个点时组件返回 `null` |
| `slot` | 必填 | 目录里的槽名。槽不存在时返回 `null`。按钮传按钮槽，顶栏传 `toolbar`。普通抽屉由布局传抽屉槽，页面不用再传一次 |
| `payload` | 仅 `action` | 点击打开时整份浅拷贝写入 `opens` 指向的抽屉槽。顶栏和抽屉正文忽略它 |
| `part` | 仅抽屉槽 | 缺省 `body`，画抽屉正文。`trigger` 画图标按钮，点一下 `openPoint`，再点 `closePoint`。阅读页用这个，不再自管打开的插件 id |
| `title` | 仅抽屉正文 | 盖过插件标题。词库列表用来放统计数字 |
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

`closePoint` 把该槽收成 `pluginId: null`、`open: false`、`payload: null`、`covered: false`。本来就是这个状态时不再通知。若 `stacks` 里这条打开时盖着别的抽屉，只揭开那一层。

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
| `english.vocab.library` | `openCard` | 与 `play` 相同 | `boolean`。空词，或词卡详解插件未启用，为 `false`。只打开，不切换关闭。载荷固定带 `source: 'list'` |
| `english.dailyReading.article` | `play` | 要朗读的字符串 | 空串：已完成的 `Promise`。有字：朗读的 `Promise`，缓存目录是每日阅读 |
| `english.dailyReading.article` | `stop` | `undefined` | `undefined` |
| `english.dailyReading.article` | `detailEntries` | `undefined` | `{ detail, list, import }`，三项是对应插件是否启用 |
| `english.dailyReading.article` | `openDetail` | 带 `word` 的对象。可选抄 `translationZh`、`example`；`source` 只有值恰好是 `'list'` 才写入 | `boolean`。没有词时是 `false` |
| `english.dailyReading.article` | `openDetailList` | 忽略 | 打开词库 `drawer`，插件 `vocabDetailList`，载荷 `{ scope: 'dailyReading' }` |
| `english.dailyReading.article` | `openDetailImport` | 忽略 | 打开词库 `import-drawer`，插件 `vocabDetailImport`，载荷同上 |
| `english.dailyReading.article` | `openReading` | 文章 id 字符串 | 英语学习壳在挂载期间绑定，跳到该篇。空 id 返回 `false` |
| `english.dailyReading.article` | `exportWords` | 由导出函数解释 | 英语学习壳在挂载期间绑定 |
| `ebook.read` | `navigateToCfi` | CFI 字符串。不是字符串时按空串处理 | 由阅读页实现决定。只在 EPUB 且页面还挂着时有绑定 |
| `ebook.read` | `openThought` | 想法对象。不是对象时直接返回 | 由阅读页实现决定。只在 EPUB 且页面还挂着时有绑定 |
| `ebook.read` | `closeIdeasList` | `undefined` | `true`。启动时绑定，关掉阅读页抽屉 |

这些命令只在对应的点上存在。在别的点调用会抛 `UNKNOWN_POINT_COMMAND`。`navigateToCfi`、`openThought`、`openReading`、`exportWords` 只在对应页面挂载时有绑定，离开后抛 `POINT_COMMAND_UNBOUND`。其余命令在应用启动后就有绑定。

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
| `host.icon` | `string` 可选 | 槽位按钮用的 SVG 地址。`HostPoint` 把它交给 `PluginIcon`。没有时按钮仍在，图标是拼图。插件页面要画中心图标时，取 `menu.icon ?? host.icon`，再调 `api.ui.readIconSvg`。做法见 `packages/federation-kit/docs/implements-guide/插件图标.md` §4.7 |
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

在 `pointDefs` 里加一项。`listPoint` 会生成顶栏、行按钮和抽屉，第二个参数是上下文白名单：

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

`Layout.tsx` 不认识 `vocabDetail` 这三个 id。源码在 `apps/frontend/src/views/englishLearning/Layout.tsx`。

- `Outlet` 是英语学习下面的各个页面。词卡、词库列表都画在这里。
- `layoutDrawerSlots` 把目录里每只抽屉摊平，按 `layout.order` 排序，没写的按 2。`layout.page === true` 的槽布局不渲染 `HostPoint`。词库的列表抽屉就是这种，所以「单词解析」按钮和抽屉标题在词库页里。词卡抽屉、行详情 `item-drawer`、导入抽屉没有 `page`，由布局挂上。`order: 0` 的导入先挂，在下层；`order: 1` 的词卡后挂，在上层。
- 离开英语学习时，对每一只布局抽屉 `closePoint`，包括标了 `page` 的列表抽屉。子页之间切换不跑这段清理，已经打开的词还在。
- 同一段清理旁边还有停朗读。那是英语页自己的行为，不是扩展点协议。

### 11.2 主项目：不依赖某一页 state 的命令

`points/command.ts` 在应用启动时绑定。这里只讲这三个插件为什么走这里，而不是页面里的 `bindPointCommand`。

朗读、选文件、从列表打开详解，都不闭包某一页的 React state。应用启动时注册一次，插件随时能调。

- `play` / `stop` 挂在 `english.vocab.card`。详解插件不能自己调主站 TTS。`play` 接受一段要朗读的字符串，或带 `word` 字段的对象。详解里点单词、点例句，传的都是字符串，所以例句也能读。空白字符串返回一个已完成的 Promise，插件不会把它当成播放失败。音频进 `TTS_CACHE_FOLDER.vocabDetail`，不和语句、练习混在一起。`stop` 停掉当前正在播的所有声音。再点同一段、换词、组件卸载时，插件都会调它。
- `pickJsonFile` 挂在 `english.vocab.library`。导入插件在联邦沙箱里弹不出主站的系统文件框。取消得到 `null`。选了非 `.json` 会抛 `accept`，插件自己把这句话显示成「文件不对」。
- `openCard` 也挂在词库点，但 `openPoint` 的目标是 **词卡点** 的 `drawer`，插件 id 写死 `vocabDetail`。列表插件和导入插件都调这一个命令，所以都会带上 `source: 'list'`。详解看到这个来源就不从右侧滑入。空词，或详解插件没启用、槽位对不上，返回 `false`。插件用 `=== true` 判断。这条命令只打开，不会再点一次关掉。

页面生命周期才有的命令不要学它们写进这个文件。阅读页的 `navigateToCfi` 就是反例：必须在阅读页 effect 里 `bindPointCommand`，离开页面解绑。

### 11.3 主项目：词卡上的两枚插件按钮

词卡组件把当前词收成一份载荷，再交给 `CardActionButtons`：

- `word` 必有。主项目用它判断「同一个词再点一次是关闭」，也用它匹配 `pending` 转圈。
- `pos`、`ipa`、`translationZh`、`example` 给详解头部。插件缺了这些字段会再请求，但载荷里有就可以先画。
- 这里不写 `source`。从词卡按钮打开时，插件把来源收成 `card`。只有 `openCard` 会写成 `list`。

两枚 `HostPoint` 的差别：

- `pointId={POINT.vocabCard}`、`slot="card-action"`。目录规定这个按钮打开词卡自己的 `drawer`。已启用且 `host.slot` 为 `card-action` 的插件会出现，现在就是 `vocabDetail`。点击由 `HostPoint` 写会话，插件组件不负责画这枚按钮。
- `pagePointId` 有值时再挂一枚 `slot="item-action"`。词库页把 `pagePointId` 设成 `POINT.vocabLibrary`。这枚按钮打开的是词库的 `item-drawer`，不是整库列表那个 `drawer`。所以词条上的插件不会把「单词解析」列表顶掉。语句卡用的是另一份 `Card`，点 id 是语句库，和这三个插件无关。

### 11.4 主项目：词库卡片上的导入按钮

`LibraryListPanel` 里和导入有关的是这两处：

- `useHostSurfacePlugins` 取当前是单词库还是语句库，再滤出 `host.slot === 'library-card-action'` 的插件。一个都没有，`showImport` 为 false，卡片上不留空位。
- `showImport = showEdit && cardActionPlugins.length > 0`。`showEdit` 表示这张库可以改。不能改的库不给导入入口。
- 渲染时 `pointId` 按 `kind` 选词库或语句库，`slot` 固定 `library-card-action`，`payload` 是 `{ libraryId, title }`。点击后这份载荷写进该点的 `import-drawer`。单词库上对上的插件是 `vocabDetailImport`。语句库目前没有插件登记在这个槽，按钮不会出现。
- 外层 `span` 把点击和按下停掉，避免点导入按钮时把整张库卡片选中。

导入抽屉本身不在这个文件里画。它由 `Layout` 里的 `HostPoint` 按目录挂上。`modal: false` 所以不锁焦点。`stacks` 里词卡抽屉可见时，导入面板同一帧透明，会话还在。

### 11.5 主项目：词库页自己打开单词解析列表

列表抽屉角色是 `owner: 'page'`，布局不画它。词库页在 `apps/frontend/src/views/englishLearning/library/vocabulary/index.tsx`。词条怎么分页、怎么收藏，不是扩展点，不收进这一节。

- `usePointContext(POINT.vocabLibrary, { libraryId })`。`libraryId` 先 trim，空字符串就传 `null`。列表插件的 `getContext().libraryId` 只可能来自这里。换库或离开这段时，上下文会更新或变成 `null`。
- 词卡抽屉被盖住时列表保持可见。从列表点词后 `openCard` 把词卡重新设为打开且未覆盖，`stacks` 的让位才把列表藏起来。页面不再自己订阅词卡来改透明度。
- `listPlugin` 在词库点上找 `host.slot === 'drawer'` 的插件。没有启用 `vocabDetailList` 就不画顶栏那个「单词解析」按钮。
- 统计不用 `useSyncExternalStore(readStats)`。`readStats` 每次返回新对象，那样会循环渲染。这里是 `useState` 加上 `subscribeSignals`，插件 `publishSignal('stats', …)` 之后标题上的「共 N / 已加载 M」才会变。
- 点「单词解析」：用 `readSlot` 看列表抽屉是否开着。开着就 `closePoint`，否则 `openPoint(POINT.vocabLibrary, listPlugin.id, 'drawer', {})`。载荷是空对象，库 id 走上下文。词卡详解已经开着时，`stacks` 的 `cover` 判定会让这次打开不滑入。
- 抽屉正文是 `<HostPoint pointId={POINT.vocabLibrary} slot="drawer" title={统计标题} />`。开关在槽位会话里。词卡重新露出来时，`stacks` 的 `yield` 把列表画成透明，不关闭、不播退场。用户点遮罩时 `HostPoint` 自己 `closePoint`。让位期间点外面不能关列表。
- 每一张词卡上传 `pagePointId={POINT.vocabLibrary}`，从而出现 11.3 里的第二枚按钮。

### 11.6 插件：单词详解怎么用这五个方法

插件面板不在本仓库。和扩展点有关的只有下面这些，其余是请求详解、切换来源、停止生成和排版。

- `const point = api.modules?.point`。没拿到就说明注册表没有 `modules:point`，或 `host.surface` 对不上 `english.vocab.card`。朗读和转圈会直接跳过，抽屉里也不知道当前词。
- `useEffect` 里 `getPayload('drawer')` 再 `subscribe`。槽名是 `drawer`，不是注册表里的 `card-action`。按钮槽只负责打开，词在抽屉槽的载荷里。换词、从列表打开、会话被盖住后揭开，都会再读。`cardFromPayload` 要求 `word` 是非空字符串，否则当成没打开。
- `publishSignal('pending', { pluginId: 'vocabDetail', key: word, on })`。`pluginId` 必须等于注册表 id，`key` 是当前词。主项目只让这一枚、这一个词的按钮转圈。别的插件写同一个词不会让这枚按钮转。
- `command('play', text)` 和 `command('stop', undefined)`。第二个参数不能省。`play` 的返回值可能是 Promise，用 `Promise.resolve` 包一层。同一段再点一次，或组件卸载、换词，都先 `stop`，避免抽屉关了声音还在。
- 组件不调用 `getContext`。词卡点的 `contextKeys` 是空的，词只在载荷里。

### 11.7 插件：单词解析列表怎么用这五个方法

这个插件的 `host.slot` 是 `drawer`，因为它就是那只由页面 `openPoint` 打开的抽屉正文，不是一枚行按钮。

- `getContext()` 经 `libraryIdFromContext` 取 `libraryId`。`subscribe` 在上下文变化时再取。库 id 变了就清空已加载行、游标和失败状态，并把 `stats` 写成 `{ total: 0, loaded: 0 }`，然后拉第一页。空库 id 只停在不加载，不发请求。
- 每一页成功后 `publishSignal('stats', { total, loaded })`。`total` 是这一库的详解总数，`loaded` 是已经拼进列表的行数。主项目词库页标题读的就是这个信号。非数字会被主项目丢掉，上一份数字还在。
- 点一行 `command('openCard', lemma)`。这里的 `lemma` 是字符串，主项目 `wordOf` 会 trim。返回值不是 `true` 就 Toast「需要先启用详解」，列表自己保持打开。
- 不读 `getPayload`。这只抽屉打开时载荷是 `{}`，库 id 只在上下文里。

### 11.8 插件：导入怎么用这五个方法

注册表槽是 `library-card-action`，但读载荷的槽名是 `import-drawer`。按钮和抽屉是同一个插件，主项目点按钮时把载荷写到 `opens` 指向的那个槽。

- 首屏和 `subscribe` 都用 `getPayload('import-drawer')`，再经 `importTargetFromPayload` 收成 `{ libraryId, title }`。没有 `libraryId` 就是还没点开某张库，标题显示未选中，列表不请求。换一张库卡片再点，载荷变，已导入列表换库重拉。
- `command('pickJsonFile', undefined)`。没有 `point` 时才退回一个藏起来的 `<input>`。有命令时取消得到 `null`，不导入。抛出的 `accept` 显示成文件类型不对，其它错误显示成导入失败。
- 已导入列表里点一个词，同样是 `command('openCard', lemma) === true`。打不开就 Toast，导入抽屉不关。详解出现后，主项目按 `stacks` 的 `yield` 把导入面板藏起来，这份列表状态还在。

三个插件共用的读取函数里，`command` 的第二个参数在插件侧类型上可能写成可选。主项目实现要求调用时仍然传，没有参数就传 `undefined`。

### 11.9 对照源码

上面各节按当前行为写。主项目接线以这些文件为准，不再在本文粘贴全文：

| 行为 | 文件 |
| --- | --- |
| 角色、`listPoint`、`stacks` | `apps/frontend/src/federation/points/catalog.ts` |
| 启动时绑定的命令 | `apps/frontend/src/federation/points/command.ts` |
| 槽位会话和叠放显隐 | `apps/frontend/src/federation/points/session.ts` |
| 顶栏、按钮、图标、抽屉 | `apps/frontend/src/federation/host/HostPoint.tsx` |
| 英语学习壳：`openReading`、`exportWords`、离开时关抽屉 | `apps/frontend/src/views/englishLearning/Layout.tsx` |
| 词库列表抽屉 | `apps/frontend/src/views/englishLearning/library/vocabulary/index.tsx` |
| 阅读页图标和抽屉 | `apps/frontend/src/views/ebook/read.tsx` |

`PluginHostSurface` 和 `points/commands.ts` 已删除。抽屉开关只在槽位会话里。
