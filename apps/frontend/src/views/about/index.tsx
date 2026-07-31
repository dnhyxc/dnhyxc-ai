import { Button } from '@ui/button';
import { useEffect, useState } from 'react';
import { useI18n } from '@/hooks/i18n';
import { type ThemeName, useTheme } from '@/hooks/theme';
import type { Locale } from '@/i18n';
import { onListen } from '@/utils/event';
import { openExternalUrl } from '@/utils/open-external';
import { isTauriRuntime } from '@/utils/runtime';
import {
	getLegalPageAbsoluteUrl,
	LEGAL_PAGE_PATHS,
} from '@/views/legal/legalPageUrls';

function readVersionFromSearch(): string {
	try {
		return new URLSearchParams(window.location.search).get('version') ?? '';
	} catch {
		return '';
	}
}

const About = () => {
	const [version, setVersion] = useState(readVersionFromSearch);
	const { t, setLocale, locale } = useI18n();
	const { changeTheme } = useTheme();

	useEffect(() => {
		if (version) return;
		let cancelled = false;
		(async () => {
			if (!isTauriRuntime()) {
				if (!cancelled) {
					setVersion(import.meta.env.VITE_APP_VERSION ?? '浏览器预览');
				}
				return;
			}
			const { getVersion } = await import('@tauri-apps/api/app');
			const v = await getVersion();
			if (!cancelled) setVersion(v);
		})();
		return () => {
			cancelled = true;
		};
	}, [version]);

	useEffect(() => {
		const unlistenThemePromise = onListen('theme', (value: string) => {
			changeTheme(value as ThemeName, false);
		});

		const unlistenLocalePromise = onListen('locale', (value: Locale) => {
			void setLocale(value, { syncUrl: false, emitEvent: false });
		});

		return () => {
			unlistenThemePromise.then((unlisten) => unlisten());
			unlistenLocalePromise.then((unlisten) => unlisten());
		};
	}, [changeTheme, setLocale]);

	return (
		<div className="flex flex-col justify-center items-center w-full h-full">
			<div className="mb-10">
				{t('about.appVersion', { version: version || '…' })}
			</div>
			<div className="flex flex-col justify-center items-center">
				<div className="mb-2.5">{t('about.copyright')}</div>
				<div className="mb-2">{t('about.copyrightYears')}</div>
				<div className="mb-2">{t('about.rightsReserved')}</div>
				<div className="flex flex-col items-center gap-2">
					<div className="flex flex-wrap justify-center gap-x-6 gap-y-1">
						<Button
							variant="link"
							onClick={() => {
								void openExternalUrl(
									getLegalPageAbsoluteUrl(
										LEGAL_PAGE_PATHS.servicePolicy,
										locale,
									),
								);
							}}
							className="text-blue-500 hover:text-blue-400 text-md bg-transparent border-none cursor-pointer p-0"
						>
							{t('about.links.policy')}
						</Button>
						<Button
							variant="link"
							onClick={() => {
								void openExternalUrl(
									getLegalPageAbsoluteUrl(
										LEGAL_PAGE_PATHS.userAgreement,
										locale,
									),
								);
							}}
							className="text-blue-500 hover:text-blue-400 text-md bg-transparent border-none cursor-pointer p-0"
						>
							{t('about.links.terms')}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default About;
