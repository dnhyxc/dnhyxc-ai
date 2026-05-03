import { Button } from '@ui/index';
import { Languages } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useI18n, useStandalonePageLocaleFromSearch, useTheme } from '@/hooks';
import type { Locale } from '@/i18n';
import type { LegalSection } from './legalDocuments';

type LegalDocPageProps = {
	titleKey: string;
	getSections: (locale: Locale) => LegalSection[];
	/** 与路由 path 一致，用于语言切换时 navigate（与 projectGuide 顶栏行为一致） */
	pathname: string;
};

/**
 * 独立全屏法律页（与分享页相同：不经 Layout，整页 h-dvh）。
 */
export function LegalDocPage({
	titleKey,
	getSections,
	pathname,
}: LegalDocPageProps) {
	useStandalonePageLocaleFromSearch();
	const { t, locale } = useI18n();
	useTheme();
	const navigate = useNavigate();
	const sections = useMemo(() => getSections(locale), [getSections, locale]);

	const onToggleLanguage = useCallback(() => {
		const base = pathname.replace(/\/$/, '');
		navigate(`${base}/?lang=${locale === 'en-US' ? 'zh-CN' : 'en-US'}`);
	}, [locale, navigate, pathname]);

	return (
		<div className="relative flex h-dvh w-full flex-col overflow-hidden bg-theme-background text-textcolor">
			<header className="flex h-12.5 shrink-0 items-center gap-3 border-b border-theme/5 pl-4 pr-2">
				<h1 className="min-w-0 flex-1 truncate text-base font-semibold">
					{t(titleKey)}
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
			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
				<div className="mx-auto max-w-2xl space-y-8 pb-10 text-sm leading-relaxed">
					{sections.map((section) => (
						<section key={section.title}>
							<h2 className="mb-3 text-sm font-semibold text-textcolor">
								{section.title}
							</h2>
							<div className="space-y-3 text-textcolor/80">
								{section.paragraphs.map((p, i) => (
									<p key={`${section.title}-${i}`} className="text-justify">
										{p}
									</p>
								))}
							</div>
						</section>
					))}
				</div>
			</div>
		</div>
	);
}
