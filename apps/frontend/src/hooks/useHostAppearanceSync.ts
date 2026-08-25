import { useEffect } from 'react';
import { useI18n } from '@/hooks/i18n';
import { onListen } from '@/utils';
import {
	type HostAppearancePayload,
	subscribeHostAppearance,
} from '@/utils/hostAppearanceSync';
import { type AccentId, type ThemeName, useTheme } from './theme';

/** Popout 等独立窗：跟随主窗主题 / 强调色 / 语言 */
export function useHostAppearanceSync() {
	const { changeTheme, changeAccent } = useTheme();
	const { setLocale } = useI18n();

	useEffect(() => {
		const apply = (payload: HostAppearancePayload) => {
			if (payload.kind === 'theme') {
				void changeTheme(payload.value as ThemeName, false);
			} else if (payload.kind === 'accent') {
				void changeAccent(payload.value as AccentId, false);
			} else if (payload.kind === 'locale') {
				void setLocale(payload.value, { emitEvent: false });
			}
		};

		const unsubs: Array<() => void> = [];
		unsubs.push(subscribeHostAppearance(apply));

		void (async () => {
			const themeUn = await onListen<ThemeName>('theme', (value) => {
				if (typeof value === 'string') apply({ kind: 'theme', value });
			});
			const accentUn = await onListen<AccentId>('accent', (value) => {
				if (typeof value === 'string') apply({ kind: 'accent', value });
			});
			const localeUn = await onListen('locale', (value) => {
				if (value === 'zh-CN' || value === 'en-US') {
					apply({ kind: 'locale', value });
				}
			});
			unsubs.push(themeUn, accentUn, localeUn);
		})();

		return () => {
			for (const u of unsubs) u();
		};
	}, [changeAccent, changeTheme, setLocale]);
}
