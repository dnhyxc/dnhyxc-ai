import ParserMarkdownPreviewPane from '@design/Markdown';
import { Button, ScrollArea } from '@ui/index';
import { Languages, Puzzle } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n, useStandalonePageLocaleFromSearch, useTheme } from '@/hooks';
import type { PluginGuideCode } from './pluginDevGuideSections';
import {
	getPluginGuideIntro,
	getPluginGuideSections,
} from './pluginDevGuideSections';

/**
 * 单个代码块：
 * 把 { lang, code } 包成一段只含一个 fenced code block 的 Markdown，
 * 交给 ParserMarkdownPreviewPane 渲染 —— 享受到宿主统一的语法高亮、复制按钮、滚动行为。
 */
const FencedCodeBlock = memo(function FencedCodeBlock({
	id,
	code,
}: {
	id: string;
	code: PluginGuideCode;
}) {
	// 用空行 + ``` 包裹，其他内容完全没有 —— 只渲染这一个代码块
	const fenced = useMemo(() => {
		return `\`\`\`${code.lang}\n${code.code}\n\`\`\``;
	}, [code.lang, code.code]);

	return (
		<div className="my-4 rounded-lg overflow-hidden border border-theme-white/10">
			<ParserMarkdownPreviewPane
				markdown={fenced}
				documentIdentity={id}
				enableMermaid={false}
				enableCodeFloatingToolbar={false}
				withScrollArea={false}
			/>
		</div>
	);
});

const PluginDevGuidePage = memo(function PluginDevGuidePage() {
	useStandalonePageLocaleFromSearch();
	const { t, locale } = useI18n();
	useTheme();
	const navigate = useNavigate();

	const intro = useMemo(() => getPluginGuideIntro(locale), [locale]);
	const sections = useMemo(() => getPluginGuideSections(locale), [locale]);
	const [_forceCopyKey, setForceCopyKey] = useState(0); // 预留：语言切换后强制刷新代码块

	const onToggleLanguage = useCallback(() => {
		const next = locale === 'en-US' ? 'zh-CN' : 'en-US';
		setForceCopyKey((k) => k + 1);
		navigate(`/plugin-dev-guide/?lang=${next}`);
	}, [locale, navigate]);

	return (
		<div className="relative flex h-dvh w-full flex-col overflow-hidden bg-theme-background text-textcolor">
			{/*
			  Header：左右对齐
			  - 左侧：Puzzle 图标 + h1（flex items-center gap-2，flex-1 占满可用空间，文字超出省略号）
			  - 右侧：语言切换按钮（ml-auto 推到最右端，保证 header 内部分成左右两块）
			*/}
			<header className="flex h-12.5 shrink-0 items-center border-b border-theme/5 pl-4 pr-2">
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<Puzzle className="size-5 shrink-0 text-violet-400" />
					<h1 className="min-w-0 truncate text-base font-semibold">
						{t('route.pluginDevGuide.title')}
					</h1>
				</div>

				{/* 语言切换：放到 header 右侧最末 */}
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="ml-4 shrink-0 text-textcolor/70 hover:text-textcolor"
					title={t('header.toggleLanguage')}
					aria-label={t('header.toggleLanguage')}
					onClick={onToggleLanguage}
				>
					<Languages className="size-4" strokeWidth={2} />
				</Button>
			</header>

			<ScrollArea className="min-h-0 flex-1" viewportClassName="pb-1">
				<main className="mx-auto w-full max-w-3xl px-4 py-6">
					<p className="mb-10 whitespace-pre-line text-[15px] leading-7 text-textcolor/72">
						{intro}
					</p>

					{sections.map((section) => (
						<section
							key={`${section.id}-${locale}`}
							className="pb-14 last:pb-4"
						>
							<h2 className="mb-6 text-base font-semibold text-textcolor sm:text-lg">
								{section.title}
							</h2>
							<div className="flex flex-col gap-8">
								{section.items.map((item) => {
									const codeBlockId = `codeblock-${section.id}-${item.id}-${locale}`;
									return (
										<article
											key={`${section.id}-${item.id}-${locale}`}
											className="scroll-mt-4"
										>
											<h3 className="text-[15px] font-medium leading-snug text-textcolor">
												{item.title}
											</h3>
											{item.description ? (
												<p className="mt-2.5 whitespace-pre-line text-[14px] leading-7 text-textcolor/68">
													{item.description}
												</p>
											) : null}
											{item.code ? (
												<FencedCodeBlock id={codeBlockId} code={item.code} />
											) : null}
										</article>
									);
								})}
							</div>
						</section>
					))}
				</main>
			</ScrollArea>
		</div>
	);
});

export default PluginDevGuidePage;
