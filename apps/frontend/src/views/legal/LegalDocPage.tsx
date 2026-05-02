import { useMemo } from 'react';
import { useI18n, useStandalonePageLocaleFromSearch, useTheme } from '@/hooks';
import type { Locale } from '@/i18n';
import type { LegalSection } from './legalDocuments';

type LegalDocPageProps = {
	titleKey: string;
	getSections: (locale: Locale) => LegalSection[];
};

/**
 * 独立全屏法律页（与分享页相同：不经 Layout，整页 h-dvh）。
 */
export function LegalDocPage({ titleKey, getSections }: LegalDocPageProps) {
	useStandalonePageLocaleFromSearch();
	const { t, locale } = useI18n();
	useTheme();
	const sections = useMemo(() => getSections(locale), [getSections, locale]);

	return (
		<div className="relative flex h-dvh w-full flex-col overflow-hidden bg-theme-background text-textcolor">
			<header className="flex h-12.5 shrink-0 items-center gap-3 border-b border-theme/5 px-4">
				<h1 className="min-w-0 truncate text-base font-semibold">
					{t(titleKey)}
				</h1>
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
