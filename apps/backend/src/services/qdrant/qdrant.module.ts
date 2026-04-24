import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { QdrantEnum } from '../../enum/config.enum';
import { QdrantService } from './qdrant.service';

@Global()
@Module({
	providers: [
		{
			provide: QdrantClient,
			useFactory: (config: ConfigService) => {
				const url =
					config.get<string>(QdrantEnum.QDRANT_URL) || 'http://localhost:6333';
				const parsed = new URL(url);
				const host = parsed.hostname || 'localhost';
				const port = Number(parsed.port || 6333);
				// 显式指定协议，避免在某些环境下默认走 https 导致
				// SSL routines: wrong version number（用 TLS 连接到明文 HTTP 服务）
				const https = parsed.protocol === 'https:';

				// const apiKey =
				// 	config.get<string>(QdrantEnum.QDRANT_API_KEY) || undefined;

				return new QdrantClient({
					host,
					port,
					https,
					// ...(apiKey ? { apiKey } : {}),
					checkCompatibility: false,
				});
			},
			inject: [ConfigService],
		},
		QdrantService,
	],
	exports: [QdrantService, QdrantClient],
})
export class QdrantModule {}
