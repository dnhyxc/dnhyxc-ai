import Layout from '@/layout';
import About from '@/views/about';
import Detail from '@/views/detail';
import Home from '@/views/home';
import Login from '@/views/login';
import Profile from '@/views/profile';
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
			{
				path: 'profile',
				Component: Profile,
			},
		],
	},
	{
		path: 'login',
		Component: Login,
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
