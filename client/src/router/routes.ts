import Layout from '@/layout';
import About from '@/views/about';
import Detail from '@/views/detail';
import Home from '@/views/home';
import ChildWindow from '@/views/win';

const routes = [
	{
		Component: Layout,
		children: [
			{
				index: true,
				Component: Home,
			},
			{
				path: 'detail',
				Component: Detail,
			},
		],
	},
	{
		path: 'win',
		Component: ChildWindow,
	},
	{
		path: 'about',
		Component: About,
	},
];

export default routes;
