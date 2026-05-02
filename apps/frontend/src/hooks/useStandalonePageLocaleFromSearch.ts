import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { parseLocaleFromSearch, useI18n } from './i18n';

/**
 * 独立全屏页（法律、更新信息等）：URL 中带 `lang` / `locale` 时与界面语言同步（与 share 通过 search 传参一致）。
 */
export function useStandalonePageLocaleFromSearch() {
	const { search } = useLocation();
	const { locale, setLocale } = useI18n();

	useEffect(() => {
		const fromUrl = parseLocaleFromSearch(search);
		if (!fromUrl || fromUrl === locale) return;
		void setLocale(fromUrl, { syncUrl: false, emitEvent: false });
	}, [search, locale, setLocale]);
}
