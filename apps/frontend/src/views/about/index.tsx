import { Button } from '@ui/button';
import { useEffect } from 'react';
import { type ThemeName, useGetVersion, useI18n, useTheme } from '@/hooks';
import type { Locale } from '@/i18n';
import { onListen, openExternalUrl } from '@/utils';

const About = () => {
	const { version } = useGetVersion();
	const { t, setLocale } = useI18n();

	const { changeTheme } = useTheme();

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

	const handleOpenLink = (url: string) => {
		void openExternalUrl(url);
	};

	return (
		<div className="flex flex-col justify-center items-center w-full h-full">
			<div className="mb-10">{t('about.appVersion', { version })}</div>
			<div className="flex flex-col justify-center items-center">
				<div className="mb-2.5">{t('about.copyright')}</div>
				<div className="mb-2">{t('about.copyrightYears')}</div>
				<div className="mb-2">{t('about.rightsReserved')}</div>
				<div className="flex justify-center">
					<Button
						variant="link"
						onClick={() =>
							handleOpenLink(
								'https://github.com/dnhyxc/dnhyxc-ai/blob/master/client/README.md',
							)
						}
						className="mr-6 text-blue-500 hover:text-blue-400 text-md bg-transparent border-none cursor-pointer p-0"
					>
						{t('about.links.policy')}
					</Button>
					<Button
						variant="link"
						onClick={() => handleOpenLink('https://dnhyxc.cn')}
						className="text-blue-500 hover:text-blue-400 text-md bg-transparent border-none cursor-pointer p-0"
					>
						{t('about.links.terms')}
					</Button>
				</div>
			</div>
		</div>
	);
};

export default About;
