import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuList,
	navigationMenuTriggerStyle,
} from '@ui/navigation-menu';
import { Link } from 'react-router';

const NavigationMenus = () => {
	return (
		<div className="w-fullbg-background rounded-md">
			<NavigationMenu className="">
				<NavigationMenuList className="flex-wrap">
					<NavigationMenuItem className={navigationMenuTriggerStyle()}>
						<Link to="/setting">系统设置</Link>
					</NavigationMenuItem>
					<NavigationMenuItem className={navigationMenuTriggerStyle()}>
						<Link to="/setting/about">关于应用</Link>
					</NavigationMenuItem>
				</NavigationMenuList>
			</NavigationMenu>
		</div>
	);
};

export default NavigationMenus;
