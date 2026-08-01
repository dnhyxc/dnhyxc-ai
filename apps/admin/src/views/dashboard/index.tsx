import {
	Activity,
	BookOpen,
	Database,
	DollarSign,
	MessageSquare,
	Sparkles,
	TrendingUp,
	Users,
} from 'lucide-react';
import { observer } from 'mobx-react';
import { useEffect, useState } from 'react';
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui';
import { formatNumber } from '@/lib/utils';
import { dashboardApi } from '@/service';
import type { DashboardStats } from '@/types';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

const emptyStats: DashboardStats = {
	totalUsers: 0,
	activeUsersToday: 0,
	totalEbooks: 0,
	totalChats: 0,
	totalRevenue: 0,
	newUsersThisWeek: 0,
	usersGrowth: [],
	moduleUsage: [],
	membershipDistribution: [],
};

const statCards: {
	title: string;
	value: keyof DashboardStats;
	icon: typeof Users;
	color: string;
	format?: (v: number) => string;
}[] = [
	{
		title: '总用户数',
		value: 'totalUsers',
		icon: Users,
		color: 'from-indigo-500 to-indigo-600',
	},
	{
		title: '今日活跃',
		value: 'activeUsersToday',
		icon: Activity,
		color: 'from-emerald-500 to-emerald-600',
	},
	{
		title: '书籍总数',
		value: 'totalEbooks',
		icon: BookOpen,
		color: 'from-amber-500 to-amber-600',
	},
	{
		title: '对话总数',
		value: 'totalChats',
		icon: MessageSquare,
		color: 'from-purple-500 to-purple-600',
	},
	{
		title: '总收入',
		value: 'totalRevenue',
		icon: DollarSign,
		format: (v: number) => `¥${formatNumber(v)}`,
		color: 'from-rose-500 to-rose-600',
	},
	{
		title: '本周新增',
		value: 'newUsersThisWeek',
		icon: Sparkles,
		color: 'from-cyan-500 to-cyan-600',
	},
];

const DashboardPage = observer(() => {
	const [stats, setStats] = useState<DashboardStats>(emptyStats);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		dashboardApi
			.getStats()
			.then((data) => setStats(data))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	return (
		<div className="space-y-6">
			{/* Stats Grid */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
				{statCards.map((card) => {
					const Icon = card.icon;
					const rawValue = stats[card.value] as number;
					const displayValue = card.format
						? card.format(rawValue)
						: formatNumber(rawValue);
					return (
						<Card key={card.title} className="border-0 shadow-sm">
							<CardContent className="p-5">
								<div className="flex items-start justify-between">
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											{card.title}
										</p>
										<p className="mt-2 text-2xl font-bold">
											{loading ? '—' : displayValue}
										</p>
									</div>
									<div
										className={`flex size-10 items-center justify-center rounded-lg bg-gradient-to-br ${card.color} text-white shadow-sm`}
									>
										<Icon size={20} />
									</div>
								</div>
								<div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
									<TrendingUp size={12} />
									<span>实时统计</span>
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>

			{/* Charts Row 1 */}
			<div className="grid gap-4 lg:grid-cols-2">
				<Card className="border-0 shadow-sm">
					<CardHeader>
						<CardTitle className="text-base">用户增长趋势</CardTitle>
						<CardDescription>最近 7 天新增用户</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="h-72">
							{stats.usersGrowth.length ? (
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={stats.usersGrowth}>
										<CartesianGrid
											strokeDasharray="3 3"
											stroke="var(--color-border)"
										/>
										<XAxis
											dataKey="date"
											tick={{ fontSize: 12 }}
											stroke="var(--color-muted-foreground)"
										/>
										<YAxis
											tick={{ fontSize: 12 }}
											stroke="var(--color-muted-foreground)"
										/>
										<Tooltip
											contentStyle={{
												background: 'var(--color-card)',
												border: '1px solid var(--color-border)',
												borderRadius: '8px',
											}}
										/>
										<Line
											type="monotone"
											dataKey="count"
											name="新增用户"
											stroke="#6366f1"
											strokeWidth={2.5}
											dot={{ r: 4, fill: '#6366f1' }}
											activeDot={{ r: 6 }}
										/>
									</LineChart>
								</ResponsiveContainer>
							) : (
								<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
									暂无数据
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				<Card className="border-0 shadow-sm">
					<CardHeader>
						<CardTitle className="text-base">会员分布</CardTitle>
						<CardDescription>各等级会员占比</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="h-72">
							{stats.membershipDistribution.length ? (
								<ResponsiveContainer width="100%" height="100%">
									<PieChart>
										<Pie
											data={stats.membershipDistribution}
											cx="50%"
											cy="50%"
											innerRadius={60}
											outerRadius={90}
											paddingAngle={2}
											dataKey="value"
										>
											{stats.membershipDistribution.map((_, index) => (
												<Cell
													key={`cell-${index}`}
													fill={COLORS[index % COLORS.length]}
												/>
											))}
										</Pie>
										<Tooltip
											contentStyle={{
												background: 'var(--color-card)',
												border: '1px solid var(--color-border)',
												borderRadius: '8px',
											}}
										/>
										<Legend />
									</PieChart>
								</ResponsiveContainer>
							) : (
								<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
									暂无数据
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Charts Row 2 */}
			<div className="grid gap-4 lg:grid-cols-1">
				<Card className="border-0 shadow-sm">
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<Database size={16} className="text-primary" />
							模块使用统计
						</CardTitle>
						<CardDescription>各功能模块的使用次数</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="h-72">
							{stats.moduleUsage.length ? (
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={stats.moduleUsage}>
										<CartesianGrid
											strokeDasharray="3 3"
											stroke="var(--color-border)"
										/>
										<XAxis
											dataKey="name"
											tick={{ fontSize: 12 }}
											stroke="var(--color-muted-foreground)"
										/>
										<YAxis
											tick={{ fontSize: 12 }}
											stroke="var(--color-muted-foreground)"
										/>
										<Tooltip
											contentStyle={{
												background: 'var(--color-card)',
												border: '1px solid var(--color-border)',
												borderRadius: '8px',
											}}
										/>
										<Bar dataKey="count" name="使用次数" radius={[6, 6, 0, 0]}>
											{stats.moduleUsage.map((_, index) => (
												<Cell
													key={`bar-${index}`}
													fill={COLORS[index % COLORS.length]}
												/>
											))}
										</Bar>
									</BarChart>
								</ResponsiveContainer>
							) : (
								<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
									暂无数据
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
});

export default DashboardPage;
