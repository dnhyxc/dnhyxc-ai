import { Button } from '@ui/button';
import { useEffect } from 'react';
import { type ThemeName, useGetVersion, useI18n, useTheme } from '@/hooks';
import type { Locale } from '@/i18n';
import { onListen, openExternalUrl } from '@/utils';
import {
	getLegalPageAbsoluteUrl,
	LEGAL_PAGE_PATHS,
} from '@/views/legal/legalPageUrls';
import { getUpdateInfoAbsoluteUrl } from '@/views/updateInfo/paths';

const About = () => {
	const { version } = useGetVersion();
	const { t, setLocale, locale } = useI18n();

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

	return (
		<div className="flex flex-col justify-center items-center w-full h-full">
			<div className="mb-10">{t('about.appVersion', { version })}</div>
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
					<Button
						variant="link"
						onClick={() => {
							void openExternalUrl(getUpdateInfoAbsoluteUrl(locale));
						}}
						className="text-blue-500 hover:text-blue-400 text-md bg-transparent border-none cursor-pointer p-0"
					>
						{t('about.links.updateInfo')}
					</Button>
				</div>
			</div>
		</div>
	);
};

export default About;
