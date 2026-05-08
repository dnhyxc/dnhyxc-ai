import { Global, Module } from '@nestjs/common';
import { SerperSearchService } from './serper-search.service';
import { TavilySearchService } from './tavily-search.service';
import { WebSearchService } from './web-search.service';

/**
 * 全局联网检索：任意模块均可注入 WebSearchService，无需再 import/exports 传递
 */
@Global()
@Module({
	providers: [SerperSearchService, TavilySearchService, WebSearchService],
	exports: [WebSearchService],
})
export class WebSearchModule {}
