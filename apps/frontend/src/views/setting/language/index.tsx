import { Button } from '@ui/button';
import { useMemo } from 'react';
import { useI18n } from '@/hooks';
import type { Locale } from '@/i18n';

const LanguageSetting = () => {
	const { locale, setLocale, t } = useI18n();

	const items = useMemo(
		() =>
			[
				{ locale: 'zh-CN' as const, label: t('setting.language.zh') },
				{ locale: 'en-US' as const, label: t('setting.language.en') },
			] satisfies Array<{ locale: Locale; label: string }>,
		[t],
	);

	return (
		<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-4">
			<div className="mb-4 text-base font-bold text-textcolor">
				{t('setting.language.title')}
			</div>

			<div className="mb-4 text-sm text-textcolor/70">
				{t('setting.language.current', { lang: locale })}
			</div>

			<div className="flex flex-wrap gap-2">
				{items.map((it) => {
					const active = locale === it.locale;
					return (
						<Button
							key={it.locale}
							variant={active ? 'dynamic' : 'secondary'}
							onClick={() => void setLocale(it.locale)}
							className={
								active
									? 'bg-linear-to-r from-teal-500 to-cyan-600 text-textcolor'
									: 'bg-theme-secondary border border-theme/10'
							}
						>
							{it.label}
						</Button>
					);
				})}
			</div>
		</div>
	);
};

export default LanguageSetting;
