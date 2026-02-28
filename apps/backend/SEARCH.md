# 使用 LangChain v1 + NestJS + Serper.dev 实现联网搜索功能

下面是使用 LangChain v1 最新 API 实现的完整解决方案，使用 `@langchain/community`、`@langchain/openai` 和 `@langchain/core/messages` 包。

## 项目结构

```
src/
├── app.controller.ts
├── app.module.ts
├── main.ts
├── search/
│   ├── search.controller.ts
│   ├── search.service.ts
│   └── search.module.ts
├── config/
│   └── config.module.ts
└── utils/
    └── search.utils.ts
```

## 1. 安装依赖

```bash
npm install @nestjs/config @nestjs/platform-express @langchain/community @langchain/openai @langchain/core
npm install -D @types/node @types/express
```

## 2. 配置环境变量

在项目根目录创建 `.env` 文件：

```env
# API Keys
SERPER_API_KEY=your_serper_api_key
OPENAI_API_KEY=your_openai_api_key

# Application settings
PORT=3000
SEARCH_RESULTS_LIMIT=5
MAX_CONTEXT_LENGTH=3000
```

## 3. 配置模块

### src/config/config.module.ts

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";

@Module({
	imports: [
		NestConfigModule.forRoot({
			isGlobal: true,
			envFilePath: [".env.local", ".env"],
		}),
	],
})
export class ConfigModule {}
```

## 4. 搜索服务实现

### src/utils/search.utils.ts

```typescript
import { Logger } from "@nestjs/common";

export const formatSearchResults = (results: any): string => {
	if (!results || !results.organic) return "No search results found.";

	return results.organic
		.map(
			(result: any, index: number) =>
				`Result ${index + 1}:\n` +
				`Title: ${result.title || "No title"}\n` +
				`URL: ${result.link || "No URL"}\n` +
				`Snippet: ${result.snippet || "No snippet"}\n`
		)
		.join("\n");
};

export const truncateContext = (context: string, maxLength: number): string => {
	if (context.length <= maxLength) return context;

	// 保留完整句子
	const truncated = context.substring(0, maxLength);
	const lastSentenceEnd = Math.max(
		truncated.lastIndexOf("."),
		truncated.lastIndexOf("!"),
		truncated.lastIndexOf("?")
	);

	return lastSentenceEnd > 0
		? truncated.substring(0, lastSentenceEnd + 1)
		: truncated;
};

export const validateSearchQuery = (query: string): string => {
	if (!query || query.trim().length < 3) {
		throw new Error("Query must be at least 3 characters long");
	}

	// 防止潜在的恶意查询
	const blockedPatterns = [
		/javascript:/i,
		/data:/i,
		/<script>/i,
		/onerror=/i,
		/src=/i,
	];

	if (blockedPatterns.some((pattern) => pattern.test(query))) {
		throw new Error("Invalid query format detected");
	}

	return query.trim();
};
```

### src/search/search.service.ts

```typescript
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChatOpenAI, OpenAIChatInput } from "@langchain/openai";
import {
	ChatPromptTemplate,
	MessagesPlaceholder,
} from "@langchain/core/prompts";
import {
	RunnableSequence,
	RunnablePassthrough,
} from "@langchain/core/runnables";
import { Serper, SerperInput } from "@langchain/community/tools/serper";
import {
	formatSearchResults,
	truncateContext,
	validateSearchQuery,
} from "../utils/search.utils";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

@Injectable()
export class SearchService implements OnModuleInit {
	private readonly logger = new Logger(SearchService.name);
	private serper: Serper;
	private qaChain: RunnableSequence;
	private readonly maxContextLength: number;

	constructor(private configService: ConfigService) {
		this.maxContextLength = parseInt(
			configService.get("MAX_CONTEXT_LENGTH") || "3000",
			10
		);
	}

	onModuleInit() {
		this.logger.log("Initializing search service...");
		this.initializeServices();
	}

	private initializeServices() {
		try {
			// 初始化 Serper 工具
			this.serper = new Serper({
				apiKey: this.configService.get("SERPER_API_KEY"),
				k: parseInt(this.configService.get("SEARCH_RESULTS_LIMIT") || "5", 10),
			} as SerperInput);

			// 初始化 OpenAI 模型
			const llm = new ChatOpenAI({
				apiKey: this.configService.get("OPENAI_API_KEY"),
				model: "gpt-3.5-turbo",
				temperature: 0.2,
				maxTokens: 1000,
			} as OpenAIChatInput);

			// 创建提示模板
			const prompt = ChatPromptTemplate.fromMessages([
				new SystemMessage(
					`You are a helpful assistant that provides accurate information based on search results. 
          Answer the user's question using ONLY the information provided in the search results below.
          If the search results don't contain relevant information, state that you cannot answer the question.
          Be concise and factual. Do not make up information.`
				),
				new MessagesPlaceholder("chat_history"),
				new HumanMessage(
					`Search Results:
          {context}
          
          Question: {question}`
				),
			]);

			// 创建问答链
			this.qaChain = RunnableSequence.from([
				{
					context: (input) => input.context,
					question: (input) => input.question,
				},
				prompt,
				llm,
				(output) => output.content,
			]);

			this.logger.log("Search service initialized successfully");
		} catch (error) {
			this.logger.error("Failed to initialize search service", error);
			throw new Error("Search service initialization failed");
		}
	}

	async searchAndAnswer(question: string): Promise<string> {
		try {
			// 验证查询
			const validatedQuery = validateSearchQuery(question);

			// 执行搜索
			this.logger.log(`Searching for: ${validatedQuery}`);
			const rawResults = await this.serper.invoke(validatedQuery);

			// 格式化结果
			const formattedResults = formatSearchResults(rawResults);
			const truncatedContext = truncateContext(
				formattedResults,
				this.maxContextLength
			);

			// 生成回答
			this.logger.log("Generating answer from search results");
			const response = await this.qaChain.invoke({
				context: truncatedContext,
				question: validatedQuery,
			});

			return response.trim();
		} catch (error) {
			this.logger.error("Search failed", error);

			if (error.message.includes("quota")) {
				throw new Error(
					"Search service quota exceeded. Please try again later."
				);
			}

			throw new Error("Failed to process search request");
		}
	}
}
```

## 5. 控制器实现

### src/search/search.controller.ts

```typescript
import {
	Controller,
	Post,
	Body,
	HttpException,
	HttpStatus,
	Logger,
} from "@nestjs/common";
import { SearchService } from "./search.service";

@Controller("api/search")
export class SearchController {
	private readonly logger = new Logger(SearchController.name);

	constructor(private readonly searchService: SearchService) {}

	@Post()
	async search(@Body() body: { question: string }) {
		try {
			this.logger.log(`Received search request: ${body.question}`);

			if (!body.question || body.question.trim().length < 3) {
				throw new HttpException(
					"Question must be at least 3 characters long",
					HttpStatus.BAD_REQUEST
				);
			}

			const answer = await this.searchService.searchAndAnswer(body.question);

			this.logger.log("Search completed successfully");
			return {
				status: "success",
				data: {
					question: body.question,
					answer,
					timestamp: new Date().toISOString(),
				},
			};
		} catch (error) {
			this.logger.error("Search request failed", error);

			if (error instanceof HttpException) {
				throw error;
			}

			throw new HttpException(
				error.message || "Internal server error",
				error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
```

## 6. 模块定义

### src/search/search.module.ts

```typescript
import { Module } from "@nestjs/common";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

@Module({
	controllers: [SearchController],
	providers: [SearchService],
})
export class SearchModule {}
```

## 7. 主应用模块

### src/app.module.ts

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { SearchModule } from "./search/search.module";

@Module({
	imports: [ConfigModule, SearchModule],
})
export class AppModule {}
```

## 8. 主入口文件

### src/main.ts

```typescript
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { Logger } from "@nestjs/common";

async function bootstrap() {
	const logger = new Logger("Bootstrap");
	const app = await NestFactory.create(AppModule);

	// 设置全局管道验证
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
		})
	);

	// 启用 CORS
	app.enableCors({
		origin: ["http://localhost:3001", "https://your-frontend.com"],
		methods: "GET,POST",
		credentials: true,
	});

	// 设置端口
	const port = process.env.PORT || 3000;
	await app.listen(port);

	logger.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
```

## 9. 运行应用

```bash
npm run start:dev
```

## 10. 测试 API

使用 curl 测试：

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the latest news about AI development in 2023?"}'
```

## 关键实现细节（LangChain v1 特点）

### 1. 使用 LangChain v1 的核心 API

- **`RunnableSequence`**：替代了 v0.x 中的 `LLMChain`，提供更灵活的链式调用
- **`ChatPromptTemplate`**：使用消息模板代替字符串模板
- **`MessagesPlaceholder`**：处理对话历史
- **`RunnablePassthrough`**：在链中传递数据

### 2. Serper 工具使用

```typescript
// 初始化 Serper 工具
this.serper = new Serper({
	apiKey: this.configService.get("SERPER_API_KEY"),
	k: parseInt(this.configService.get("SEARCH_RESULTS_LIMIT") || "5", 10),
} as SerperInput);

// 调用搜索
const rawResults = await this.serper.invoke(validatedQuery);
```

### 3. 问答链构建

```typescript
// 创建问答链
this.qaChain = RunnableSequence.from([
	{
		context: (input) => input.context,
		question: (input) => input.question,
	},
	prompt,
	llm,
	(output) => output.content,
]);
```

### 4. 消息模板设计

```typescript
const prompt = ChatPromptTemplate.fromMessages([
	new SystemMessage(
		`You are a helpful assistant that provides accurate information based on search results. 
    Answer the user's question using ONLY the information provided in the search results below.
    If the search results don't contain relevant information, state that you cannot answer the question.
    Be concise and factual. Do not make up information.`
	),
	new MessagesPlaceholder("chat_history"),
	new HumanMessage(
		`Search Results:
    {context}
    
    Question: {question}`
	),
]);
```

## 部署前的重要检查

1. **安装正确的 LangChain v1 包**：

   ```bash
   npm install @langchain/community@latest @langchain/openai@latest @langchain/core@latest
   ```

2. **API Key 验证**：
   - 确保 Serper API Key 有效
   - 确保 OpenAI API Key 有效

3. **环境变量检查**：
   - `.env` 文件必须包含所有必需的变量
   - 检查 `SEARCH_RESULTS_LIMIT` 和 `MAX_CONTEXT_LENGTH` 设置

## 常见问题解决方案

### 1. Serper API 调用失败

**问题**：`Error: Failed to fetch` 或 `401 Unauthorized`

**解决方案**：

- 检查 Serper API Key 是否正确
- 确保在 Serper.dev 账户中已启用 API 访问
- 检查网络连接

### 2. LangChain v1 导入错误

**问题**：`Cannot find module '@langchain/community/tools/serper'`

**解决方案**：

```bash
# 确保安装了最新版本
npm install @langchain/community@latest
```

### 3. 搜索结果格式问题

**问题**：`results.organic is undefined`

**解决方案**：

```typescript
// 在 formatSearchResults 中添加健壮性检查
export const formatSearchResults = (results: any): string => {
	if (!results || !results.organic || results.organic.length === 0) {
		return "No relevant search results found.";
	}

	// ...其余代码
};
```

### 4. 模型调用超时

**问题**：`Error: Request timed out`

**解决方案**：

```typescript
// 在 ChatOpenAI 初始化中添加超时设置
const llm = new ChatOpenAI({
	apiKey: this.configService.get("OPENAI_API_KEY"),
	model: "gpt-3.5-turbo",
	temperature: 0.2,
	maxTokens: 1000,
	timeout: 30000, // 30秒超时
} as OpenAIChatInput);
```

## 优势总结

1. **现代化架构**：
   - 使用 LangChain v1 的最新 API 设计
   - 基于 Runnable 的链式调用模式
   - 消息式提示模板设计

2. **生产就绪**：
   - 完整的错误处理和日志记录
   - 输入验证和安全过滤
   - 配置驱动的参数管理

3. **可扩展性**：
   - 模块化设计便于添加新功能
   - 支持轻松替换为其他搜索引擎
   - 可扩展为多模型支持

4. **性能优化**：
   - 上下文截断防止 token 超限
   - 结果格式化优化 LLM 输入
   - 高效的链式处理流程

这个实现完全符合 LangChain v1 的最佳实践，同时保持了 NestJS 的企业级架构标准，可以轻松集成到任何需要联网搜索功能的生产系统中。
