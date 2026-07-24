import { Link } from 'react-router';

const pages = [
	{
		to: '/english-learning/notes',
		title: '学习笔记',
		desc: 'expose ./LearningNotes · registry learningNotes',
	},
	{
		to: '/ebook/plugins/ideas-list',
		title: 'EPUB 想法列表',
		desc: 'expose ./IdeasList · registry ebookIdeasList',
	},
] as const;

export default function Home() {
	return (
		<div className="w-full h-full p-4 mx-auto flex max-w-lg flex-col gap-4">
			<div>
				<h1 className="text-lg font-medium">插件独立预览</h1>
				<p className="text-textcolor/55 mt-1 text-sm">
					路径与主站业务路由对齐，便于本地看页面；嵌入 Host 仍走 MF loadRemote。
				</p>
			</div>
			<ul className="m-0 flex list-none flex-col gap-2 p-0">
				{pages.map((p) => (
					<li key={p.to}>
						<Link
							to={p.to}
							className="border-theme-border bg-theme/5 hover:bg-theme/10 block rounded-md border px-3 py-2.5 transition-colors"
						>
							<div className="text-sm font-medium">{p.title}</div>
							<div className="text-textcolor/45 mt-0.5 text-xs">{p.desc}</div>
							<div className="text-textcolor/35 mt-1 font-mono text-[11px]">
								{p.to}
							</div>
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}
