import { Button, ScrollArea } from '@ui/index';
import { Languages } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useI18n, useStandalonePageLocaleFromSearch, useTheme } from '@/hooks';
import { getProjectGuideSections } from './projectGuideSections';

/**
 * 产品指南：独立全屏页（顶栏 + 滚动区），排版与更新信息页一致，非 Markdown 文档卡片样式。
 */
const ProjectGuidePage = () => {
	useStandalonePageLocaleFromSearch();
	const { t, locale } = useI18n();
	useTheme();
	const navigate = useNavigate();
	const sections = useMemo(() => getProjectGuideSections(locale), [locale]);

	const onToggleLanguage = useCallback(() => {
		navigate(`/project-guide/?lang=${locale === 'en-US' ? 'zh-CN' : 'en-US'}`);
	}, [locale, navigate]);

	return (
		<div className="relative flex h-dvh w-full flex-col overflow-hidden bg-theme-background text-textcolor">
			<header className="flex h-12.5 shrink-0 items-center gap-3 border-b border-theme/5 pl-4 pr-2">
				<h1 className="min-w-0 flex-1 truncate text-base font-semibold">
					{t('route.projectGuide.title')}
				</h1>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="shrink-0 text-textcolor/70 hover:text-textcolor"
					title={t('header.toggleLanguage')}
					aria-label={t('header.toggleLanguage')}
					onClick={onToggleLanguage}
				>
					<Languages className="size-4" strokeWidth={2} />
				</Button>
			</header>

			<ScrollArea className="min-h-0 flex-1" viewportClassName="pb-1">
				<main className="mx-auto w-full max-w-3xl px-4 py-6">
					{sections.map((section) => (
						<section key={section.id} className="pb-14 last:pb-4">
							<h2 className="mb-6 text-base font-semibold text-textcolor sm:text-lg">
								{section.title}
							</h2>
							<div className="flex flex-col gap-8">
								{section.items.map((item) => (
									<article key={item.id} className="scroll-mt-4">
										<h3 className="text-[15px] font-medium leading-snug text-textcolor">
											{item.title}
										</h3>
										<p className="mt-2.5 whitespace-pre-line text-[14px] leading-7 text-textcolor/68">
											{item.description}
										</p>
									</article>
								))}
							</div>
						</section>
					))}
				</main>
			</ScrollArea>
		</div>
	);
};

export default ProjectGuidePage;
