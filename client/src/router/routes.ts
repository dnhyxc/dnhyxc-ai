import Layout from '@/layout';
import Detail from '@/views/detail';
import Home from '@/views/home';
import About from '@/views/about';

const routes = [
	{
		Component: Layout,
		children: [
			{
				index: true,
				Component: Home,
			},
		],
	},
	{
		path: 'detail',
		Component: Detail,
	},
	{
		path: 'about',
		Component: About,
	},
];

export default routes;
