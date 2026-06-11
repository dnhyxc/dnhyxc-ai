import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuList,
} from '@ui/navigation-menu';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useI18n } from '@/hooks';

const NavigationMenus = () => {
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const { t } = useI18n();

	const menus = useMemo(
		() => [
			{
				name: t('setting.menu.system'),
				key: 'system',
				path: '/setting',
				icon: 'icon-setting',
			},
			{
				name: t('setting.menu.theme'),
				key: 'theme',
				path: '/setting/theme',
				icon: 'icon-theme',
			},
			{
				name: t('setting.menu.llm'),
				key: 'llm',
				path: '/setting/llm',
				icon: 'icon-setting',
			},
			{
				name: t('setting.menu.cloudTts'),
				key: 'cloud-tts',
				path: '/setting/cloud-tts',
				icon: 'icon-setting',
			},
			{
				name: t('setting.menu.about'),
				key: 'about',
				path: '/setting/about',
				icon: 'icon-about',
			},
		],
		[t],
	);

	return (
		<nav className="w-full relative border-b border-theme/35 after:content-[''] after:absolute after:bottom-0 after:right-0 after:w-full after:h-[8px] after:rounded-tr-[25px] after:bg-linear-to-r after:from-transparent after:to-theme after:max-w-[42vw]">
			<NavigationMenu className="w-full">
				<NavigationMenuList className="flex-wrap">
					{menus.map((i) => {
						return (
							<NavigationMenuItem
								key={i.key}
								className={`${pathname === i.path ? 'bg-theme' : 'bg-theme/60'} text-default group inline-flex h-8 w-max items-center justify-center rounded-t-md text-sm font-medium focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=open]:hover:bg-accent data-[state=open]:text-accent-foreground data-[state=open]:focus:bg-accent data-[state=open]:bg-accent/50 focus-visible:ring-ring/50 outline-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1`}
							>
								<div
									className="w-full h-full flex justify-center items-center rounded-t-md px-4 cursor-pointer"
									onClick={() => navigate(i.path)}
								>
									{i.name}
								</div>
							</NavigationMenuItem>
						);
					})}
				</NavigationMenuList>
			</NavigationMenu>
		</nav>
	);
};

export default NavigationMenus;
