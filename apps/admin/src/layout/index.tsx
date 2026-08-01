import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	LogOut,
	Moon,
	PanelLeft,
	Sun,
	User as UserIcon,
} from 'lucide-react';
import { observer } from 'mobx-react';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	ScrollArea,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { menuItems } from '@/router/menu';
import { authStore } from '@/store';

const AdminLayout = observer(() => {
	const [collapsed, setCollapsed] = useState(false);
	const location = useLocation();
	const navigate = useNavigate();
	const { theme, setTheme } = useTheme();

	const handleLogout = () => {
		authStore.logout();
		navigate('/login', { replace: true });
	};

	return (
		<div className="flex h-screen w-full bg-background">
			{/* Sidebar */}
			<aside
				className={cn(
					'flex h-full flex-col bg-sidebar text-sidebar-foreground transition-all duration-300',
					collapsed ? 'w-16' : 'w-64',
				)}
			>
				{/* Logo */}
				<div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
					{!collapsed && (
						<div className="flex items-center gap-2">
							<div className="flex size-8 items-center justify-center rounded-lg bg-primary text-white font-bold">
								AI
							</div>
							<span className="font-semibold">Dnhyxc 管理</span>
						</div>
					)}
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setCollapsed(!collapsed)}
						className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
					>
						{collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
					</Button>
				</div>

				{/* Menu */}
				<ScrollArea className="flex-1 py-2">
					<nav className="space-y-1 px-2">
						{menuItems.map((item) => {
							const Icon = item.icon;
							const isActive = location.pathname.startsWith(item.path);
							return (
								<button
									key={item.path}
									onClick={() => navigate(item.path)}
									className={cn(
										'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
										isActive
											? 'bg-sidebar-accent text-sidebar-accent-foreground'
											: 'hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
										collapsed && 'justify-center px-2',
									)}
									title={collapsed ? item.label : undefined}
								>
									<Icon size={18} className="shrink-0" />
									{!collapsed && <span>{item.label}</span>}
								</button>
							);
						})}
					</nav>
				</ScrollArea>

				{/* Footer */}
				{!collapsed && (
					<div className="border-t border-sidebar-border p-4">
						<div className="flex items-center gap-3">
							<div className="flex size-8 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium">
								{authStore.user?.username?.[0] || 'U'}
							</div>
							<div className="min-w-0 flex-1">
								<div className="truncate text-sm font-medium">
									{authStore.user?.username || '管理员'}
								</div>
								<div className="truncate text-xs text-sidebar-foreground/60">
									{authStore.user?.email}
								</div>
							</div>
						</div>
					</div>
				)}
			</aside>

			{/* Main */}
			<div className="flex flex-1 flex-col overflow-hidden">
				{/* Header */}
				<header className="flex h-16 items-center justify-between border-b px-6">
					<div className="flex items-center gap-4">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setCollapsed(!collapsed)}
							className="md:hidden"
						>
							<PanelLeft size={20} />
						</Button>
						<div>
							<h1 className="text-lg font-semibold">
								{menuItems.find((m) => location.pathname.startsWith(m.path))
									?.label || '仪表盘'}
							</h1>
							<p className="text-xs text-muted-foreground">
								欢迎使用 Dnhyxc AI 后台管理系统
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
						>
							{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
						</Button>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" className="gap-2">
									<div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
										{authStore.user?.username?.[0] || 'U'}
									</div>
									<span className="hidden sm:inline">
										{authStore.user?.username}
									</span>
									<ChevronDown size={16} />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								<DropdownMenuLabel>
									<div className="font-normal">
										<div className="font-medium">
											{authStore.user?.username}
										</div>
										<div className="text-xs text-muted-foreground">
											{authStore.user?.email}
										</div>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem>
									<UserIcon size={16} className="mr-2" />
									个人信息
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={handleLogout}
									className="text-destructive"
								>
									<LogOut size={16} className="mr-2" />
									退出登录
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</header>

				{/* Content */}
				<main className="flex-1 overflow-auto p-6">
					<Outlet />
				</main>
			</div>
		</div>
	);
});

export default AdminLayout;
