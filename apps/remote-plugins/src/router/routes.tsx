import { Link, type RouteObject } from 'react-router';
import Layout from '@/layout';
import { mockApi, mockPlugin } from '@/utils/mockHost';
import { EmbedIdeasList, EmbedLearningNotes } from '@/views/embed';
import Home from '@/views/home';
import IdeasListApp from '@/views/ideas-list';
import LearningNotesApp from '@/views/learning-notes';

/** 独立预览路由；path 与主站 registry / 业务树对齐 */
export const routes: RouteObject[] = [
	{
		path: '/',
		element: <Layout />,
		children: [
			{ index: true, element: <Home /> },
			{
				path: 'english-learning/notes',
				element: (
					<LearningNotesApp
						api={mockApi()}
						plugin={mockPlugin('learningNotes', '/english-learning/notes')}
					/>
				),
			},
			{
				path: 'ebook/plugins/ideas-list',
				element: (
					<IdeasListApp
						api={mockApi({
							modules: {
								ebook: {
									getBookId: () => null,
									getBookTitle: () => '独立预览（无书籍）',
									navigateToCfi: () => undefined,
									openThought: () => undefined,
								},
							},
						})}
						plugin={mockPlugin('ebookIdeasList', '/ebook/plugins/ideas-list')}
					/>
				),
			},
			{
				path: '*',
				element: (
					<p className="text-textcolor/55 text-sm">
						页面不存在，回{' '}
						<Link className="text-theme underline" to="/">
							首页
						</Link>
					</p>
				),
			},
		],
	},
	/** Host untrusted iframe：无预览壳，经 postMessage 接 Host bridge */
	{
		path: '/embed/ebook/plugins/ideas-list',
		element: <EmbedIdeasList />,
	},
	{
		path: '/embed/english-learning/notes',
		element: <EmbedLearningNotes />,
	},
];
