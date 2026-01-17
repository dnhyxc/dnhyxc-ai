import { ScrollArea } from '@ui/scroll-area';
import { Outlet } from 'react-router';
import NavigationMenus from './menu';

const Setting = () => {
	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<div className="px-3 pb-7 pt-2.5 w-full flex items-center">
				<NavigationMenus />
			</div>
			<ScrollArea className="w-full h-full overflow-y-auto rounded-none">
				<Outlet />
			</ScrollArea>
		</div>
	);
};

export default Setting;
