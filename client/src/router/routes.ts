import Layout from '@/layout';
import About from '@/views/about';
import Home from '@/views/home';

const routes = [
	{
		Component: Layout,
		children: [
			{
				index: true,
				Component: Home,
			},
			{
				path: 'about',
				Component: About,
			},
		],
	},
];

export default routes;
