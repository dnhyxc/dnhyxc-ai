import { ScrollArea } from '@ui/scroll-area';
import { Outlet } from 'react-router';
import NavigationMenus from './menu';

const Setting = () => {
	return (
		<div className="m-0 flex h-full min-h-0 w-full min-w-0 flex-col">
			<div className="flex w-full shrink-0 items-center px-5 pb-5">
				<NavigationMenus />
			</div>
			<ScrollArea className="h-full min-h-0 min-w-0 w-full flex-1 rounded-none">
				<Outlet />
			</ScrollArea>
		</div>
	);
};

export default Setting;
