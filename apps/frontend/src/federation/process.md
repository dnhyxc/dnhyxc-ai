# 每日阅读生词落地过程

按 `remote-docs/wiki/ideas/english/每日阅读生词.md` 落地。收集写在主站，列表是 `/english-learning/daily-reading/words` 上的独立插件页，不是抽屉。

同一用户同一词一行，多篇来源记在 `sources`。列表按 `updatedAt|id` 倒序，每页 100 条。选中标题用的是篇目 id。搜索只匹配单词或中文释义，并且和篇目条件同时生效。

插件页只展示收集时带上的中文释义，不在卡片上修改。`PUT /:id` 仍可改释义并把 `zhEdited` 设为真；`PATCH /:id` 语义相同。

本地注册表已加上 `dailyReadingWords`，默认未启用。到插件中心打开后，标题栏图标和三处书签才会出现。`host.slot` 写成 `command` 只是因为注册表类型要求有槽名；文章点没有这个槽，所以不会画出抽屉。`openReading` 靠 `host.surface` 拿到。

---

## 1. 词形

服务端是入库标准。主站 `collectTarget.ts` 复制同一套规则，只决定按钮文案和要不要发请求。

### `reading-word-key.ts`

```typescript
/** 与主站 `collectTarget.ts` 的预检必须一致。服务端仍是唯一入库标准。 */
const TOKEN = /^[a-z]+(?:'[a-z]+)?(?:-[a-z]+(?:'[a-z]+)?)?$/;

export function readingWordKey(raw: string): string | null {
	// 大小写和连续空格不参与去重，Gourmet 与 gourmet 是同一个键
	const text = raw.trim().replace(/\s+/g, " ").toLowerCase();
	// 只去掉首尾标点，词内撇号要留下，don't 仍是一个词
	const stripped = text.replace(/^[^a-z']+|[^a-z']+$/g, "");
	// 纯中文或标点选区没有可入库的字母
	if (!stripped || !/[a-z]/.test(stripped)) return null;
	// 和 word_key 列长一致，超长选区直接拒绝
	if (stripped.length > 80) return null;
	const tokens = stripped.split(" ");
	// 超过 4 个词视为句子，不收进生词本
	if (tokens.length > 4) return null;
	// 词中间夹中文或其它符号时，整段不合格
	if (tokens.some((token) => !TOKEN.test(token))) return null;
	return stripped;
}
```

### 检查

```typescript
import { readingWordKey } from "./reading-word-key";

describe("readingWordKey", () => {
	it("折叠大小写和首尾标点", () => {
		expect(readingWordKey(" Gourmet! ")).toBe("gourmet");
		expect(readingWordKey("Don't")).toBe("don't");
		expect(readingWordKey("well-known")).toBe("well-known");
	});

	it("拒绝整句、纯中文和超长词组", () => {
		expect(readingWordKey("美食")).toBeNull();
		expect(readingWordKey("one two three four five")).toBeNull();
		expect(readingWordKey("a".repeat(81))).toBeNull();
		expect(readingWordKey("wo中rd")).toBeNull();
	});
});
```

## 2. 表

一人一词一行。唯一键是 `(user_id, word_key)`。列表按 `(user_id, updated_at)` 倒序翻页。

```typescript
import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";

export type ReadingWordSurface = "selection" | "gloss" | "glossary";

export type ReadingWordSource = {
	readingId: string;
	titleEn: string;
	titleZh: string;
	sentence: string;
	surface: ReadingWordSurface;
	collectedAt: string;
};

/** 同一用户同一词一行。多篇来源放在 sources，不另建来源表。 */
@Entity("english_daily_reading_words")
@Index("UQ_edrw_user_word_key", ["userId", "wordKey"], { unique: true })
@Index("IDX_edrw_user_updated", ["userId", "updatedAt"])
export class EnglishDailyReadingWord {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ name: "user_id", type: "int" })
	userId!: number;

	@Column({ name: "word_key", type: "varchar", length: 80 })
	wordKey!: string;

	@Column({ type: "varchar", length: 200 })
	word!: string;

	@Column({ type: "varchar", length: 500, default: "" })
	zh!: string;

	@Column({ name: "zh_edited", type: "boolean", default: false })
	zhEdited!: boolean;

	@Column({ type: "json" })
	sources!: ReadingWordSource[];

	@CreateDateColumn({ name: "created_at", type: "datetime", precision: 6 })
	createdAt!: Date;

	@UpdateDateColumn({ name: "updated_at", type: "datetime", precision: 6 })
	updatedAt!: Date;
}
```

```typescript
import { MigrationInterface, QueryRunner } from "typeorm";

export class EnglishDailyReadingWords1794500000000 implements MigrationInterface {
	name = "EnglishDailyReadingWords1794500000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE \`english_daily_reading_words\` (
				\`id\` varchar(36) NOT NULL,
				\`user_id\` int NOT NULL,
				\`word_key\` varchar(80) NOT NULL,
				\`word\` varchar(200) NOT NULL,
				\`zh\` varchar(500) NOT NULL DEFAULT '',
				\`zh_edited\` tinyint NOT NULL DEFAULT 0,
				\`sources\` json NOT NULL,
				\`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
				\`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
				INDEX \`IDX_edrw_user_updated\` (\`user_id\`, \`updated_at\`),
				UNIQUE INDEX \`UQ_edrw_user_word_key\` (\`user_id\`, \`word_key\`),
				PRIMARY KEY (\`id\`)
			) ENGINE=InnoDB`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE \`english_daily_reading_words\``);
	}
}
```

## 3. 写入、取消、列表

`upsert` 把标题从阅读行抄进来源。`zhEdited` 为真时不再覆盖释义。按篇过滤用 `JSON_SEARCH`。个人词条过万后再拆来源表，服务上已注明这个上限。

`GET /words` 和 `GET /daily-reading-words` 是同一个列表。`limit` 在服务里固定 100，调用方传更大也会被截断。

```typescript
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { EnglishDailyReading } from "./entity/english-daily-reading.entity";
import {
	EnglishDailyReadingWord,
	type ReadingWordSource,
	type ReadingWordSurface,
} from "./entity/english-daily-reading-word.entity";
import { readingWordKey } from "./reading-word-key";

const PAGE = 100;
const TEXT_MAX = 500;
const SURFACES = new Set<ReadingWordSurface>([
	"selection",
	"gloss",
	"glossary",
]);

export type CollectReadingWordInput = {
	word?: unknown;
	readingId?: unknown;
	zh?: unknown;
	sentence?: unknown;
	surface?: unknown;
};

@Injectable()
export class EnglishDailyReadingWordService {
	constructor(
		@InjectRepository(EnglishDailyReadingWord)
		private readonly words: Repository<EnglishDailyReadingWord>,
		@InjectRepository(EnglishDailyReading)
		private readonly readings: Repository<EnglishDailyReading>,
	) {}

	async upsert(userId: number, input: CollectReadingWordInput) {
		const key = this.requireKey(input.word);
		// 标题以这篇阅读行为准。不存在，或手动篇属于别人，都按找不到处理
		const reading = await this.visibleReading(userId, input.readingId);
		const source = this.sourceOf(reading, input);
		// 两次机会：第一次插入若撞上唯一键，再读已有行合并，避免并发收成两行
		for (let attempt = 0; attempt < 2; attempt++) {
			let row = await this.words.findOne({ where: { userId, wordKey: key } });
			if (!row) {
				row = this.words.create({
					userId,
					wordKey: key,
					word: String(input.word).trim().slice(0, 200),
					zh: this.clip(input.zh),
					zhEdited: false,
					sources: [source],
				});
			} else {
				const rest = this.sourcesOf(row).filter(
					(item) => item.readingId !== reading.id,
				);
				// 同一篇再收一次只替换来源，不追加第二份
				row.sources = [...rest, source];
				const zh = this.clip(input.zh);
				// 手改过的释义保持不动；只在原来为空时填上新释义
				if (!row.zhEdited && !row.zh && zh) row.zh = zh;
			}
			try {
				const saved = await this.words.save(row);
				return { id: saved.id, wordKey: key, collected: true, zh: saved.zh };
			} catch (error) {
				if (attempt === 0 && this.isDup(error)) continue;
				throw error;
			}
		}
		throw new BadRequestException("收集失败");
	}

	async removeSource(userId: number, input: CollectReadingWordInput) {
		const key = this.requireKey(input.word);
		const readingId = this.requireId(input.readingId);
		const row = await this.words.findOne({ where: { userId, wordKey: key } });
		if (!row) return { collected: false };
		const next = this.sourcesOf(row).filter(
			(item) => item.readingId !== readingId,
		);
		if (!next.length) {
			await this.words.remove(row);
			return { collected: false };
		}
		row.sources = next;
		await this.words.save(row);
		return { collected: false };
	}

	async keys(userId: number, readingId: string) {
		const id = readingId.trim();
		if (!id) throw new BadRequestException("缺少篇目");
		const rows = await this.words
			.createQueryBuilder("w")
			.select(["w.id", "w.wordKey"])
			.where("w.userId = :userId", { userId })
			.andWhere(this.readingMatch(), { readingId: id })
			.getMany();
		return { keys: rows.map((row) => row.wordKey) };
	}

	/**
	 * ponytail: 一次取出该用户全部行再按篇聚合。个人词条过万后 JSON_SEARCH 和这次全量读取都要拆成来源表。
	 */
	async sources(userId: number) {
		const rows = await this.words.find({
			where: { userId },
			select: { id: true, sources: true },
		});
		const grouped = new Map<
			string,
			{
				readingId: string;
				titleEn: string;
				titleZh: string;
				count: number;
				collectedAt: string;
			}
		>();
		for (const row of rows) {
			for (const source of this.sourcesOf(row)) {
				const current = grouped.get(source.readingId);
				if (!current) {
					grouped.set(source.readingId, {
						readingId: source.readingId,
						titleEn: source.titleEn,
						titleZh: source.titleZh,
						count: 1,
						collectedAt: source.collectedAt,
					});
					continue;
				}
				current.count += 1;
				if (source.collectedAt > current.collectedAt) {
					current.collectedAt = source.collectedAt;
					current.titleEn = source.titleEn;
					current.titleZh = source.titleZh;
				}
			}
		}
		return [...grouped.values()].sort((a, b) =>
			b.collectedAt.localeCompare(a.collectedAt),
		);
	}

	async list(
		userId: number,
		query: { readingId?: string; q?: string; cursor?: string },
	) {
		const readingId = query.readingId?.trim() ?? "";
		const q = query.q?.trim() ?? "";
		const qb = this.words
			.createQueryBuilder("w")
			.where("w.userId = :userId", { userId });
		if (readingId) qb.andWhere(this.readingMatch(), { readingId });
		if (q) {
			qb.andWhere("(w.word LIKE :like OR w.zh LIKE :like)", {
				like: `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`,
			});
		}
		const total = await qb.clone().getCount();
		const cursor = this.cursorOf(query.cursor);
		if (cursor) {
			// 倒序往下翻：时间更早，或同一时间里 id 更小，避免收集新词后 offset 漏行
			qb.andWhere(
				"(w.updatedAt < :cursorAt OR (w.updatedAt = :cursorAt AND w.id < :cursorId))",
				cursor,
			);
		}
		const rows = await qb
			.orderBy("w.updatedAt", "DESC")
			.addOrderBy("w.id", "DESC")
			// 多取 1 条只为判断还有没有下一页，返回给页面的仍是 100 条
			.take(PAGE + 1)
			.getMany();
		const hasMore = rows.length > PAGE;
		const items = rows.slice(0, PAGE).map((row) => this.toItem(row));
		const last = items.at(-1);
		return {
			items,
			total,
			nextCursor: hasMore && last ? `${last.updatedAt}|${last.id}` : null,
		};
	}

	async editZh(userId: number, id: string, zh: unknown) {
		if (typeof zh !== "string") throw new BadRequestException("释义不正确");
		const row = await this.words.findOne({ where: { id, userId } });
		if (!row) throw new NotFoundException("生词不存在");
		row.zh = zh.trim().slice(0, TEXT_MAX);
		row.zhEdited = true;
		const saved = await this.words.save(row);
		return this.toItem(saved);
	}

	async remove(userId: number, id: string) {
		const row = await this.words.findOne({ where: { id, userId } });
		if (!row) throw new NotFoundException("生词不存在");
		await this.words.remove(row);
		return { removed: true };
	}

	private requireKey(word: unknown): string {
		const key = typeof word === "string" ? readingWordKey(word) : null;
		if (!key) throw new BadRequestException("不是可收集的英文单词");
		return key;
	}

	private requireId(value: unknown): string {
		if (typeof value !== "string" || !value.trim()) {
			throw new BadRequestException("缺少篇目");
		}
		return value.trim();
	}

	private async visibleReading(userId: number, readingId: unknown) {
		const id = this.requireId(readingId);
		const reading = await this.readings.findOne({ where: { id } });
		if (!reading || (reading.userId != null && reading.userId !== userId)) {
			// 404 不区分「没有这篇」和「这篇是别人的」
			throw new NotFoundException("阅读不存在");
		}
		return reading;
	}

	private sourceOf(
		reading: EnglishDailyReading,
		input: CollectReadingWordInput,
	): ReadingWordSource {
		if (
			typeof input.surface !== "string" ||
			!SURFACES.has(input.surface as ReadingWordSurface)
		) {
			throw new BadRequestException("收集入口不正确");
		}
		return {
			readingId: reading.id,
			titleEn: reading.titleEn,
			titleZh: reading.titleZh,
			sentence:
				typeof input.sentence === "string"
					? input.sentence.trim().slice(0, TEXT_MAX)
					: "",
			surface: input.surface as ReadingWordSurface,
			collectedAt: new Date().toISOString(),
		};
	}

	private clip(value: unknown): string {
		return typeof value === "string" ? value.trim().slice(0, TEXT_MAX) : "";
	}

	private sourcesOf(row: EnglishDailyReadingWord): ReadingWordSource[] {
		return Array.isArray(row.sources) ? row.sources : [];
	}

	private readingMatch(): string {
		return `JSON_SEARCH(w.sources, 'one', :readingId, NULL, '$[*].readingId') IS NOT NULL`;
	}

	private cursorOf(cursor?: string) {
		if (!cursor?.trim()) return null;
		const splitAt = cursor.lastIndexOf("|");
		if (splitAt <= 0) throw new BadRequestException("游标不正确");
		const at = new Date(cursor.slice(0, splitAt));
		const id = cursor.slice(splitAt + 1);
		if (Number.isNaN(at.getTime()) || !id) {
			throw new BadRequestException("游标不正确");
		}
		return { cursorAt: at, cursorId: id };
	}

	private toItem(row: EnglishDailyReadingWord) {
		return {
			id: row.id,
			word: row.word,
			wordKey: row.wordKey,
			zh: row.zh,
			zhEdited: row.zhEdited,
			sources: this.sourcesOf(row),
			updatedAt: row.updatedAt.toISOString(),
		};
	}

	private isDup(error: unknown): boolean {
		if (!(error instanceof QueryFailedError)) return false;
		const driver = error.driverError as { errno?: number; code?: string };
		return driver?.errno === 1062 || driver?.code === "ER_DUP_ENTRY";
	}
}
```

```typescript
import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Put,
	Query,
	Req,
	UnauthorizedException,
	UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { JwtGuard } from "src/guards/jwt.guard";
import {
	type CollectReadingWordInput,
	EnglishDailyReadingWordService,
} from "./english-daily-reading-word.service";

type AuthedRequest = Request & { user?: { userId: number } };

@Controller("english-learning/daily-reading-words")
@UseGuards(JwtGuard)
export class EnglishDailyReadingWordController {
	constructor(private readonly words: EnglishDailyReadingWordService) {}

	@Get("status")
	status(@Req() req: AuthedRequest, @Query("readingId") readingId = "") {
		return this.words.keys(this.userId(req), readingId);
	}

	@Get("sources")
	sources(@Req() req: AuthedRequest) {
		return this.words.sources(this.userId(req));
	}

	@Get("words")
	listWords(
		@Req() req: AuthedRequest,
		@Query("readingId") readingId?: string,
		@Query("q") q?: string,
		@Query("cursor") cursor?: string,
	) {
		return this.list(req, readingId, q, cursor);
	}

	@Get()
	list(
		@Req() req: AuthedRequest,
		@Query("readingId") readingId?: string,
		@Query("q") q?: string,
		@Query("cursor") cursor?: string,
	) {
		return this.words.list(this.userId(req), { readingId, q, cursor });
	}

	@Post()
	collect(@Req() req: AuthedRequest, @Body() body: CollectReadingWordInput) {
		return this.words.upsert(this.userId(req), body);
	}

	@Delete()
	uncollect(@Req() req: AuthedRequest, @Body() body: CollectReadingWordInput) {
		return this.words.removeSource(this.userId(req), body);
	}

	@Patch(":id")
	edit(
		@Req() req: AuthedRequest,
		@Param("id") id: string,
		@Body() body: { zh?: unknown },
	) {
		return this.words.editZh(this.userId(req), id, body?.zh);
	}

	@Put(":id")
	editByPut(
		@Req() req: AuthedRequest,
		@Param("id") id: string,
		@Body() body: { zh?: unknown },
	) {
		return this.edit(req, id, body);
	}

	@Delete(":id")
	remove(@Req() req: AuthedRequest, @Param("id") id: string) {
		return this.words.remove(this.userId(req), id);
	}

	private userId(req: AuthedRequest): number {
		const userId = req.user?.userId;
		if (userId == null) throw new UnauthorizedException("未授权");
		return userId;
	}
}
```

## 4. 挂到英语学习模块

实体、service、controller 登记在 `english-learning.module.ts`，不写进原来的大 controller。

```typescript
// 阅读行和生词行都要注入，收集时要读标题
TypeOrmModule.forFeature([EnglishDailyReading, EnglishDailyReadingWord]);

controllers: [
	EnglishLearningController,
	DailyReadingInternalController,
	EnglishDailyReadingWordController,
];
providers: [EnglishDailyReadingService, EnglishDailyReadingWordService];
```

## 5. 文章扩展点只保留跳回命令

不登记抽屉槽。英语学习布局在挂载期间绑定 `openReading`，生词页和详情都在这一层下面。

```typescript
// catalog.ts
dailyReadingArticle: 'english.dailyReading.article',

[POINT.dailyReadingArticle]: {
  id: POINT.dailyReadingArticle,
  // 空槽：这个点不画按钮，也不挂抽屉
  slots: [],
  contextKeys: [],
  signals: [],
  commands: ['openReading'],
},
```

```typescript
// Layout.tsx。离开英语学习时解绑，避免别的页面收到这条命令
useEffect(() => {
	return bindPointCommand(POINT.dailyReadingArticle, "openReading", (arg) => {
		if (typeof arg !== "string" || !arg.trim()) return false;
		navigate(
			`/english-learning/daily-reading/${encodeURIComponent(arg.trim())}`,
		);
		return true;
	});
}, [navigate]);
```

## 6. 路由必须写在 `:id` 前面

`daily-reading/words` 若写在 `daily-reading/:id` 后面，`words` 会被当成文章 id。

```typescript
{
  path: 'daily-reading/words',
  Component: EnglishDailyReadingWordsPage,
  meta: { titleKey: 'englishLearning.dailyReading.words' },
},
{
  path: 'daily-reading/:id',
  Component: EnglishDailyReadingDetailPage,
},
```

页本身只挂插件整页：

```tsx
import { PluginHostPage } from "@/federation";

export default function DailyReadingWordsPage() {
	return (
		<PluginHostPage
			pluginId="dailyReadingWords"
			pageShell
			className="h-full min-h-0"
		/>
	);
}
```

## 7. 标题栏

图标在「继续生成」右侧、列表开关左侧。偏好还没拉到时不渲染，避免先闪一下再消失。点击把当前篇 id 放进查询串，生词页用它预选标题。

```tsx
const wordsPlugin = usePluginEnabledState("dailyReadingWords");
const wordsOn = wordsPlugin.ready && wordsPlugin.enabled;

{
	wordsOn ? (
		<Button
			aria-label={t("englishLearning.dailyReading.words")}
			className={HEADER_ICON_BTN}
			onClick={() => {
				navigate(
					`/english-learning/daily-reading/words?readingId=${encodeURIComponent(row.id)}`,
				);
			}}
		>
			<Bookmark className="size-4" aria-hidden />
		</Button>
	) : null;
}
```

## 8. 主站预检

多词只在它正好是文末词汇卡时才允许。选区释义优先用词卡，其次用逐词释义。

```typescript
import type { EnglishDailyReadingExtras } from "@/service";

const TOKEN = /^[a-z]+(?:'[a-z]+)?(?:-[a-z]+(?:'[a-z]+)?)?$/;

/** 与后端 `readingWordKey` 同一套规则，只用来决定按钮文案和要不要发请求。 */
export function wordKey(raw: string): string | null {
	const text = raw.trim().replace(/\s+/g, " ").toLowerCase();
	const stripped = text.replace(/^[^a-z']+|[^a-z']+$/g, "");
	if (!stripped || !/[a-z]/.test(stripped)) return null;
	if (stripped.length > 80) return null;
	const tokens = stripped.split(" ");
	if (tokens.length > 4) return null;
	if (tokens.some((token) => !TOKEN.test(token))) return null;
	return stripped;
}

function lookupGloss(
	extras: EnglishDailyReadingExtras | null,
	key: string,
): string {
	for (const sentence of extras?.wordGloss ?? []) {
		const hit = sentence.words.find((item) => wordKey(item.w) === key);
		if (hit?.zh) return hit.zh;
	}
	return "";
}

export type CollectSurface = "selection" | "gloss" | "glossary";

export type CollectTarget =
	| { ok: false; reason: "pick-word" }
	| {
			ok: true;
			key: string;
			word: string;
			zh: string;
			sentence: string;
			surface: CollectSurface;
	  };

export function resolveCollectTarget(
	text: string,
	givenZh: string,
	extras: EnglishDailyReadingExtras | null,
	surface: CollectSurface,
	sentence: string,
): CollectTarget {
	const key = wordKey(text);
	if (!key) return { ok: false, reason: "pick-word" };
	const card = (extras?.glossary ?? []).find(
		(item) => wordKey(item.word) === key,
	);
	// 多个词必须正好是一张词汇卡，避免把随意短语收成生词
	if (key.split(" ").length > 1 && !card)
		return { ok: false, reason: "pick-word" };
	const word = surface === "selection" && card ? card.word : text.trim();
	// 选区没有自带释义，先用词卡，再用句中逐词释义；气泡和词汇卡用界面上已经显示的
	const zh =
		surface === "selection"
			? (card?.zh ?? lookupGloss(extras, key))
			: givenZh.trim();
	return { ok: true, key, word, zh, sentence, surface };
}
```

## 9. 三处书签

右键菜单加在朗读和复制之后，只挂在英文正文那一层，中文译文没有这项。气泡书签放进 `WordLine` 的 `extra`。词汇卡右上角绝对定位，卡片加了右内边距，图标不挡字。

`SelectionContextMenuItemsFn` 有两个参数。第二个是右键前的选区快照，朗读和复制靠它找回当时选中的文字。追加「收集单词」时必须把这个快照原样交回去，只传文本会报「应有 2 个参数，但获得 1 个」。

```tsx
const selectionMenuItems = useMemo(() => {
	const base = createSelectionSpeakMenu(t, startSelectionSpeak);
	if (!wordsOn) return base;
	return (selectedText: string, ctx: SelectionContextMenuCtx) => {
		// 快照要交给原来的朗读、复制，否则右键后选区被系统改写就读不到正文
		const items = base(selectedText, ctx);
		if (!items) return items;
		const key = readingWordKey(selectedText);
		const saved = key ? collectedKeys.has(key) : false;
		return [
			...items,
			{
				type: "item" as const,
				id: "collect",
				disabled: key ? pendingKeys.has(key) : false,
				label: t(
					saved
						? "englishLearning.dailyReading.uncollect"
						: "englishLearning.dailyReading.collect",
				),
				onSelect: () => {
					void toggleCollect({
						word: selectedText,
						zh: "",
						sentence: "",
						surface: "selection",
					});
				},
			},
		];
	};
}, [
	collectedKeys,
	pendingKeys,
	startSelectionSpeak,
	t,
	toggleCollect,
	wordsOn,
]);
```

请求成功后才改实心。失败不改集合。

```tsx
// 进行中的词形放在 ref 里。只靠 state 的话，两次点击会在重绘前都通过检查
if (inflightRef.current.has(target.key)) return;
inflightRef.current.add(target.key);
const had = collectedKeys.has(target.key);
try {
	if (had) {
		await uncollectEnglishDailyReadingWord({
			word: target.word,
			readingId: row.id,
		});
	} else {
		await collectEnglishDailyReadingWord({
			word: target.word,
			readingId: row.id,
			zh: target.zh,
			sentence: target.sentence,
			surface: target.surface,
		});
	}
	setCollectedKeys((prev) => {
		const next = new Set(prev);
		if (had) next.delete(target.key);
		else next.add(target.key);
		return next;
	});
} catch {
	// 图标保持点击前
} finally {
	inflightRef.current.delete(target.key);
	setPendingKeys(new Set(inflightRef.current));
}
```

主站请求：

```typescript
export const collectEnglishDailyReadingWord = async (body: {
	word: string;
	readingId: string;
	zh: string;
	sentence: string;
	surface: "selection" | "gloss" | "glossary";
}) => {
	return await http.post(ENGLISH_LEARNING_DAILY_READING_WORDS, body);
};

export const uncollectEnglishDailyReadingWord = async (body: {
	word: string;
	readingId: string;
}) => {
	// DELETE 带正文，只拿掉这一篇来源，来源空了才删整行
	return await http.delete(ENGLISH_LEARNING_DAILY_READING_WORDS, {
		data: body,
	});
};

export const getEnglishDailyReadingWordKeys = async (readingId: string) => {
	return await http.get(`${ENGLISH_LEARNING_DAILY_READING_WORDS}/status`, {
		querys: { readingId },
		silent: true,
	});
};
```

`WordLine` 在朗读和复制后面留 `extra`。`GlossSentence` 把 `mark(word, zh)` 传进去。卡片上的按钮是 `CollectMark`。

```tsx
import { Button } from "@ui/index";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

export function CollectMark({
	pressed,
	disabled,
	label,
	className,
	onClick,
}: {
	pressed: boolean;
	disabled: boolean;
	label: string;
	className?: string;
	onClick: () => void;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			disabled={disabled}
			aria-pressed={pressed}
			aria-label={label}
			className={cn(
				"size-6 shrink-0 rounded-md p-0 shadow-none",
				pressed ? "text-teal-500" : "text-textcolor/55 hover:text-teal-400",
				className,
			)}
			onClick={(event) => {
				event.preventDefault();
				event.stopPropagation();
				onClick();
			}}
		>
			<Bookmark
				className={cn("size-3.5", pressed && "fill-current")}
				aria-hidden
			/>
		</Button>
	);
}
```

## 10. 插件生词页

先拉全部篇目，再按 `readingId` 和 `q` 取第一页。滚近底部 320px 且 `nextCursor` 有值时追加。换篇或搜索词变化时递增 ticket，慢回来的响应直接丢掉。首屏没有词条时用 `Loading`；追加只用一行「加载更多」。列表按单词库同样的网格排布：列宽至少 16rem，放得下就两列，更宽再增加，窄到放不下就退回一列。卡片不用 `ul`/`li`。搜索在回车时提交；输入框右侧的清空按钮，以及把内容删空，都会立刻用空关键词重拉。草稿留在 `SearchInput` 里，不随每次按键重拉列表。篇目筛选用 `DropdownMenu`，交互与划词朗读条的语速菜单相同：点开选项，当前项用 `bg-theme/10 text-teal-500` 标出。

同名英文标题在选项上加上最近收集日期，值仍然是 `readingId`。点来源标题调用 `command('openReading', readingId)`，不使用 `nav:subtree`。

工具栏上「单词解析」「导入解析」用插件中心的图标。插件从 `dnhyxc.plugin.registry.dev.v1`（生产是 `prod`）读出目标插件的 `menu.icon ?? host.icon`，再调用 `api.ui.readIconSvg`。返回的是已经上色的整段 `<svg>`。下载、桌面端直链和 `currentColor` 都在主项目的 `loadPluginIconMarkup` 里，插件不再自己请求 COS。

```typescript
export type ReadingWordSource = {
	readingId: string;
	titleEn: string;
	titleZh: string;
	sentence: string;
	surface: "selection" | "gloss" | "glossary";
	collectedAt: string;
};

export type ReadingWord = {
	id: string;
	word: string;
	wordKey: string;
	zh: string;
	zhEdited: boolean;
	sources: ReadingWordSource[];
	updatedAt: string;
};

export type ReadingSource = {
	readingId: string;
	titleEn: string;
	titleZh: string;
	count: number;
	collectedAt: string;
};

export type WordPage = {
	items: ReadingWord[];
	total: number;
	nextCursor: string | null;
};

type HostHttp = {
	get: (url: string) => Promise<unknown>;
	put?: (url: string, body?: unknown) => Promise<unknown>;
};

const ROOT = "/english-learning/daily-reading-words";

function unwrap<T>(res: unknown): T {
	if (res && typeof res === "object" && "data" in res) {
		return (res as { data: T }).data;
	}
	return res as T;
}

export async function listSources(http: HostHttp): Promise<ReadingSource[]> {
	const data = unwrap<ReadingSource[] | null>(
		await http.get(`${ROOT}/sources`),
	);
	return Array.isArray(data) ? data : [];
}

export async function listWords(
	http: HostHttp,
	query: { readingId: string; q: string; cursor: string },
): Promise<WordPage> {
	const params = new URLSearchParams();
	if (query.readingId) params.set("readingId", query.readingId);
	if (query.q) params.set("q", query.q);
	if (query.cursor) params.set("cursor", query.cursor);
	const suffix = params.toString();
	const data = unwrap<WordPage | null>(
		await http.get(`${ROOT}/words${suffix ? `?${suffix}` : ""}`),
	);
	return {
		items: Array.isArray(data?.items) ? data.items : [],
		total: typeof data?.total === "number" ? data.total : 0,
		nextCursor: data?.nextCursor ?? null,
	};
}

export async function saveZh(http: HostHttp, id: string, zh: string) {
	if (!http.put) throw new Error("PUT_UNAVAILABLE");
	return unwrap<ReadingWord>(
		await http.put(`${ROOT}/${encodeURIComponent(id)}`, { zh }),
	);
}
```

```tsx
import "@/styles.css";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@ui/dropdown-menu";
import { Button, ScrollArea } from "@ui/index";
import { ChevronsUpDown } from "lucide-react";
import { type UIEvent, useEffect, useRef, useState } from "react";
import Loading from "@design/Loading";
import SearchInput from "@design/SearchInput";
import { useI18n } from "@/hooks";
import { cn } from "@/lib/utils";
import {
	listSources,
	listWords,
	type ReadingSource,
	type ReadingWord,
	saveZh,
} from "./api";

type HostApi = {
	http?: {
		get: (url: string) => Promise<unknown>;
		put?: (url: string, body?: unknown) => Promise<unknown>;
	};
	ui?: {
		showToast: (options: {
			message: string;
			type?: "success" | "error" | "info";
		}) => void;
	};
	modules?: {
		point?: { command: (name: string, arg?: unknown) => unknown };
	};
};

function readingIdFromUrl(): string {
	return new URLSearchParams(window.location.search).get("readingId") ?? "";
}

function labelOf(source: ReadingSource, duplicated: boolean): string {
	const title = source.titleEn || source.titleZh || source.readingId;
	if (!duplicated) return title;
	return `${title} · ${source.collectedAt.slice(0, 10)}`;
}

export default function DailyReadingWords({ api }: { api: HostApi }) {
	const { t } = useI18n();
	const http = api.http;
	const [sources, setSources] = useState<ReadingSource[]>([]);
	const [readingId, setReadingId] = useState(readingIdFromUrl);
	const [q, setQ] = useState("");
	const [items, setItems] = useState<ReadingWord[]>([]);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingZh, setEditingZh] = useState("");
	const ticketRef = useRef(0);
	const loadingRef = useRef(false);
	const pageRef = useRef({ readingId, q, nextCursor });
	pageRef.current = { readingId, q, nextCursor };

	const commitQuery = (value: string) => {
		const next = value.trim();
		// 关键词没变就不改 q，避免回车或清空时把已经看过的列表清掉重拉
		setQ((current) => (current === next ? current : next));
	};

	useEffect(() => {
		if (!http) return;
		let cancelled = false;
		void listSources(http)
			.then((rows) => {
				if (!cancelled) setSources(rows);
			})
			.catch(() => {
				if (!cancelled) {
					api.ui?.showToast({
						message: t("dailyReadingWords.loadFailed"),
						type: "error",
					});
				}
			});
		return () => {
			cancelled = true;
		};
	}, [api.ui, http, t]);

	useEffect(() => {
		if (!http) return;
		const ticket = ++ticketRef.current;
		setItems([]);
		setNextCursor(null);
		loadingRef.current = true;
		setLoading(true);
		void listWords(http, { readingId, q, cursor: "" })
			.then((page) => {
				if (ticket !== ticketRef.current) return;
				setItems(page.items);
				setNextCursor(page.nextCursor);
			})
			.catch(() => {
				if (ticket !== ticketRef.current) return;
				api.ui?.showToast({
					message: t("dailyReadingWords.loadFailed"),
					type: "error",
				});
			})
			.finally(() => {
				if (ticket !== ticketRef.current) return;
				loadingRef.current = false;
				setLoading(false);
			});
	}, [api.ui, http, q, readingId, t]);

	const onScroll = (event: UIEvent<HTMLDivElement>) => {
		const el = event.currentTarget;
		const nearEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 320;
		const page = pageRef.current;
		// 没有下一页，或上一页还没回来，这次滚动不发请求
		if (!nearEnd || !page.nextCursor || loadingRef.current || !http) return;
		const ticket = ticketRef.current;
		loadingRef.current = true;
		setLoading(true);
		void listWords(http, {
			readingId: page.readingId,
			q: page.q,
			cursor: page.nextCursor,
		})
			.then((next) => {
				// 换了篇或改了搜索词后，这次追加作废，避免旧词拼进新结果
				if (ticket !== ticketRef.current) return;
				setItems((prev) => [...prev, ...next.items]);
				setNextCursor(next.nextCursor);
			})
			.finally(() => {
				if (ticket !== ticketRef.current) return;
				loadingRef.current = false;
				setLoading(false);
			});
	};

	const chooseReading = (id: string) => {
		const params = new URLSearchParams(window.location.search);
		if (id) params.set("readingId", id);
		else params.delete("readingId");
		const query = params.toString();
		window.history.replaceState(
			null,
			"",
			`${window.location.pathname}${query ? `?${query}` : ""}`,
		);
		setReadingId(id);
	};

	const commitZh = async (item: ReadingWord) => {
		if (!http || editingId !== item.id) return;
		try {
			const saved = await saveZh(http, item.id, editingZh);
			setItems((prev) =>
				prev.map((row) =>
					row.id === item.id ? { ...row, zh: saved.zh, zhEdited: true } : row,
				),
			);
			setEditingId(null);
		} catch {
			api.ui?.showToast({
				message: t("dailyReadingWords.saveFailed"),
				type: "error",
			});
		}
	};

	const openReading = (id: string) => {
		const opened = api.modules?.point?.command("openReading", id) === true;
		if (!opened) {
			api.ui?.showToast({
				message: t("dailyReadingWords.openFailed"),
				type: "error",
			});
		}
	};

	const titleCount = new Map<string, number>();
	for (const source of sources) {
		titleCount.set(source.titleEn, (titleCount.get(source.titleEn) ?? 0) + 1);
	}
	const known = sources.some((source) => source.readingId === readingId);
	const readingLabel = (source: ReadingSource) => {
		const title = labelOf(source, (titleCount.get(source.titleEn) ?? 0) > 1);
		return source.titleZh ? `${title} / ${source.titleZh}` : title;
	};
	const selected = sources.find((source) => source.readingId === readingId);
	// 这篇还没收集过词时不在 sources 里。标题来自地址栏，没有就显示「未命名篇目」，不展示 id。
	const pinnedLabel =
		!selected && pinned.id === readingId
			? passageLabel(pinned.titleEn, pinned.titleZh)
			: "";
	const filterLabel = selected
		? readingLabel(selected)
		: pinnedLabel ||
			(readingId && pinned.missing && pinned.id === readingId
				? t("dailyReadingWords.untitled")
				: readingId
					? ""
					: t("dailyReadingWords.all"));

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 gap-2 px-4 pt-4">
				<DropdownMenu modal={false}>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							className="border-theme/15 h-9 min-w-0 flex-1 justify-between rounded-md border bg-transparent px-2 font-normal shadow-none hover:bg-transparent"
							aria-label={`${t("dailyReadingWords.filterTitle")} ${filterLabel}`}
						>
							<span className="truncate">{filterLabel}</span>
							<ChevronsUpDown className="size-4 shrink-0 opacity-50" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						className="z-50 w-(--radix-dropdown-menu-trigger-width)"
					>
						<div className="flex flex-col gap-1.5">
							<DropdownMenuItem
								className={cn(!readingId && "bg-theme/10 text-teal-500")}
								onSelect={() => chooseReading("")}
							>
								{t("dailyReadingWords.all")}
							</DropdownMenuItem>
							{readingId && !known && filterLabel ? (
								<DropdownMenuItem
									className="bg-theme/10 text-teal-500"
									onSelect={() => chooseReading(readingId)}
								>
									{filterLabel}
								</DropdownMenuItem>
							) : null}
							{sources.map((source) => (
								<DropdownMenuItem
									key={source.readingId}
									className={cn(
										source.readingId === readingId &&
											"bg-theme/10 text-teal-500",
									)}
									onSelect={() => chooseReading(source.readingId)}
								>
									{readingLabel(source)}
								</DropdownMenuItem>
							))}
						</div>
					</DropdownMenuContent>
				</DropdownMenu>
				<SearchInput
					committedQuery={q}
					onCommit={commitQuery}
					placeholder={t("dailyReadingWords.search")}
					className="border-theme/15 bg-transparent px-2 text-sm shadow-none"
				/>
			</div>
			{loading && items.length === 0 ? (
				<Loading className="min-h-0 flex-1" />
			) : (
				<div className="flex min-h-0 flex-1 flex-col py-4">
					<ScrollArea
						className="min-h-0 flex-1"
						scrollbarClassName="!right-px w-1.5 border-l-0 p-0"
						onScroll={onScroll}
					>
						<div className="flex flex-col gap-3 px-4">
							{!items.length ? (
								<p className="text-textcolor/60 py-8 text-center text-sm">
									{t("dailyReadingWords.empty")}
								</p>
							) : null}
							<div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4">
								{items.map((item) => (
									<div
										key={item.id}
										className="bg-theme/5 border-theme/5 flex h-full min-w-0 flex-col gap-1 overflow-hidden rounded-md border p-2"
									>
										<div className="flex items-center gap-1.5">
											<div className="text-lg leading-7">{item.word}</div>
											<PlayButton
												playing={playingKey === `word:${item.id}`}
												label={
													playingKey === `word:${item.id}`
														? t("dailyReadingWords.stop")
														: t("dailyReadingWords.playWord")
												}
												onClick={() => togglePlay(`word:${item.id}`, item.word)}
											/>
										</div>
										{item.zh ? (
											<p className="text-textcolor/80 mt-1 text-sm">
												{item.zh}
											</p>
										) : null}
										{item.sources.some((source) => source.sentence) ? (
											<div className="mt-1 flex flex-col gap-1">
												{item.sources.map((source) =>
													source.sentence ? (
														<p
															key={source.readingId}
															className="text-textcolor/70 text-sm leading-6"
														>
															{source.sentence}
															<PlayButton
																className="ml-1.5 inline-flex align-middle"
																playing={
																	playingKey ===
																	`sentence:${item.id}:${source.readingId}`
																}
																label={
																	playingKey ===
																	`sentence:${item.id}:${source.readingId}`
																		? t("dailyReadingWords.stop")
																		: t("dailyReadingWords.playSentence")
																}
																onClick={() =>
																	togglePlay(
																		`sentence:${item.id}:${source.readingId}`,
																		source.sentence,
																	)
																}
															/>
														</p>
													) : null,
												)}
											</div>
										) : null}
										<div className="mt-auto flex flex-col gap-1 pt-1">
											{item.sources.map((source) => (
												<button
													key={source.readingId}
													type="button"
													className="text-teal-500 text-left text-sm underline"
													onClick={() => openReading(source.readingId)}
												>
													{source.titleEn || source.readingId}
												</button>
											))}
										</div>
									</div>
								))}
							</div>
							{loading ? (
								<p className="text-textcolor/60 py-3 text-center text-sm">
									{t("common.loadingMore")}
								</p>
							) : null}
						</div>
					</ScrollArea>
				</div>
			)}
		</div>
	);
}
```

## 11. 暴露和注册

`vite.config.ts` 增加 `'./DailyReadingWords': './src/views/daily-reading-words/index.tsx'`。

插件预览路由是 `/english-learning/daily-reading/words`。

注册表条目：

```json
{
	"id": "dailyReadingWords",
	"remoteName": "dnhyxc-ai-daily-reading-words",
	"expose": "./DailyReadingWords",
	"routePath": "/english-learning/daily-reading/words",
	"entry": "http://127.0.0.1:9008/mf-manifest.json",
	"version": "1.0.0",
	"hostApiRange": "^1.0.0",
	"injectRoute": false,
	"host": {
		"surface": "english.dailyReading.article",
		"slot": "command"
	},
	"permissions": ["ui:toast", "http:plugin-api", "modules:point"],
	"preload": "idle",
	"enabled": false,
	"trust": "first-party"
}
```

不写 `menu`，不写 `nav:subtree`。线上注册表在 COS，不进 git。本地开发用的是 `apps/backend/uploads/remotes/plugins-registry.json`，已经加上这一条。
