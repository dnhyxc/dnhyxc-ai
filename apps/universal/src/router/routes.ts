import React from 'react';
import Layout from '@/layout';
import Home from '@/views/home';
import Share from '@/views/share';

export interface RouteMeta {
	title?: string;
}

export interface RouteConfig {
	path?: string;
	index?: boolean;
	Component?: React.ComponentType;
	meta?: RouteMeta;
	children?: RouteConfig[];
}

const routes: RouteConfig[] = [
	{
		Component: Layout,
		children: [
			{
				path: '/',
				Component: Home,
				meta: {
					title: 'dnhyxc-ai',
				},
			},
			{
				path: '/share/:shareId',
				Component: Share,
				meta: {
					title: '会话分享',
				},
			},
		],
	},
];

export default routes;
