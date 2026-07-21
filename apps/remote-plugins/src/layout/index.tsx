import { NavLink, Outlet } from 'react-router';
import { cn } from '@/lib/utils';

const links: { to: string; label: string; end?: boolean }[] = [
	{ to: '/', label: '首页', end: true },
	{ to: '/english-learning/notes', label: '学习笔记' },
	{ to: '/ebook/plugins/ideas-list', label: 'EPUB 想法列表' },
];

export default function Layout() {
	return (
		<div className="bg-theme-background text-textcolor flex h-screen flex-col">
			<header className="border-theme-border flex shrink-0 items-center gap-4 border-b px-4 py-2.5">
				<span className="text-sm font-medium">remote-plugins</span>
				<nav className="flex flex-wrap gap-1">
					{links.map(({ to, label, end }) => (
						<NavLink
							key={to}
							to={to}
							end={end}
							className={({ isActive }) =>
								cn(
									'rounded-md px-2.5 py-1 text-sm transition-colors',
									isActive
										? 'bg-theme/20 text-textcolor'
										: 'text-textcolor/60 hover:bg-theme/10 hover:text-textcolor',
								)
							}
						>
							{label}
						</NavLink>
					))}
				</nav>
				<span className="text-textcolor/40 ml-auto text-xs">
					独立预览 · :9008
				</span>
			</header>
			<main className="min-h-0 flex-1 overflow-auto p-4">
				<Outlet />
			</main>
		</div>
	);
}
