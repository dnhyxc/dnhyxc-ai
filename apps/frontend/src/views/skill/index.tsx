import { motion, useScroll, useSpring } from 'framer-motion';
import {
	ChevronRight,
	Clock,
	Command,
	Cpu,
	Database,
	FileCode,
	FolderOpen,
	Globe,
	Lock,
	MessageSquare,
	Play,
	Settings,
	Terminal,
	TrendingUp,
	Zap,
} from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const orbits = Array.from({ length: 8 }, (_, i) => ({
	angle: (i * 45 + Math.random() * 20) % 360,
	radius: 120 + Math.random() * 80,
	speed: 20 + Math.random() * 30,
	delay: Math.random() * 5,
}));

function OrbitParticle({ angle, radius, speed, delay }: (typeof orbits)[0]) {
	return (
		<motion.div
			className="absolute w-2 h-2 rounded-full bg-theme/40"
			style={{
				left: '50%',
				top: '50%',
			}}
			animate={{
				rotate: [angle, angle + 360],
			}}
			transition={{
				duration: speed,
				repeat: Infinity,
				ease: 'linear',
				delay,
			}}
		>
			<motion.div
				className="absolute w-1 h-1 rounded-full bg-theme/60"
				style={{
					x: radius,
				}}
			/>
		</motion.div>
	);
}

function GlitchText({ text, className }: { text: string; className?: string }) {
	return (
		<div className={cn('relative inline-block', className)}>
			<span className="relative z-10">{text}</span>
			<span className="absolute top-0 left-0 -z-10 text-theme/30 opacity-0 animate-glitch-1">
				{text}
			</span>
			<span className="absolute top-0 left-0 -z-10 text-cyan-400/20 opacity-0 animate-glitch-2">
				{text}
			</span>
		</div>
	);
}

function StatRing({
	value,
	label,
	progress,
}: {
	value: string;
	label: string;
	progress: number;
}) {
	const circumference = 2 * Math.PI * 40;
	const strokeDashoffset = circumference - (progress / 100) * circumference;

	return (
		<div className="relative w-28 h-28">
			<svg
				aria-label="统计圆环图表"
				className="w-full h-full transform -rotate-90"
				viewBox="0 0 100 100"
			>
				<title>统计圆环图表</title>
				<circle
					cx="50"
					cy="50"
					r="40"
					fill="none"
					stroke="currentColor"
					strokeWidth="3"
					className="text-theme/10"
				/>
				<motion.circle
					cx="50"
					cy="50"
					r="40"
					fill="none"
					stroke="currentColor"
					strokeWidth="3"
					strokeDasharray={circumference}
					initial={{ strokeDashoffset: circumference }}
					animate={{ strokeDashoffset }}
					transition={{ duration: 1.5, ease: 'easeOut' }}
					className="text-theme"
					strokeLinecap="round"
				/>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span className="text-xl font-bold">{value}</span>
				<span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
					{label}
				</span>
			</div>
		</div>
	);
}

function MenuItem({
	icon: Icon,
	label,
	shortcut,
	badge,
	onClick,
}: {
	icon: React.ElementType;
	label: string;
	shortcut?: string;
	badge?: string;
	onClick?: () => void;
}) {
	return (
		<motion.button
			whileHover={{ x: 4 }}
			whileTap={{ scale: 0.98 }}
			onClick={onClick}
			className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-theme/5 transition-colors group text-left"
		>
			<div className="w-8 h-8 rounded-lg bg-theme/10 flex items-center justify-center group-hover:bg-theme/20 transition-colors">
				<Icon className="w-4 h-4 text-theme" />
			</div>
			<div className="flex-1">
				<span className="text-sm font-medium">{label}</span>
				{shortcut && (
					<span className="text-xs text-muted-foreground/40 ml-2 font-mono">
						{shortcut}
					</span>
				)}
			</div>
			{badge && (
				<span className="text-xs px-2 py-0.5 rounded-full bg-theme/10 text-theme/80">
					{badge}
				</span>
			)}
			<ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-theme/50 transition-colors" />
		</motion.button>
	);
}

function ActivityFeed() {
	const activities = [
		{
			icon: FileCode,
			text: '创建了新文件',
			time: '2m',
			color: 'text-blue-400',
		},
		{ icon: Database, text: '同步知识库', time: '5m', color: 'text-green-400' },
		{
			icon: MessageSquare,
			text: '新对话已生成',
			time: '12m',
			color: 'text-purple-400',
		},
		{ icon: Globe, text: 'API 请求完成', time: '25m', color: 'text-amber-400' },
	];

	return (
		<div className="space-y-3">
			{activities.map((item, i) => (
				<motion.div
					key={i}
					initial={{ opacity: 0, x: -20 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ delay: i * 0.1 }}
					className="flex items-center gap-3 p-2 rounded-lg hover:bg-theme/5 transition-colors"
				>
					<div
						className={cn(
							'w-2 h-2 rounded-full',
							item.color.replace('text-', 'bg-'),
						)}
					/>
					<div className="flex-1 min-w-0">
						<span className="text-sm truncate">{item.text}</span>
					</div>
					<span className="text-xs text-muted-foreground/40 font-mono">
						{item.time}
					</span>
				</motion.div>
			))}
		</div>
	);
}

function HeroSection() {
	return (
		<div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-theme/10 via-theme-background to-orange-500/5">
			<div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(139,92,246,0.05)_50%,transparent_75%,transparent_100%)]" />
			<div className="absolute inset-0">
				{orbits.map((orbit, i) => (
					<OrbitParticle key={i} {...orbit} />
				))}
			</div>

			<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-theme/10 via-transparent to-transparent rounded-full blur-3xl" />

			<div className="relative p-8 md:p-12">
				<div className="flex flex-col lg:flex-row items-center gap-12">
					<div className="flex-1 space-y-6">
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-theme/10 border border-theme/20 text-sm"
						>
							<span className="relative flex h-2 w-2">
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-theme opacity-75" />
								<span className="relative inline-flex rounded-full h-2 w-2 bg-theme" />
							</span>
							<span className="text-theme/80 font-mono text-xs">
								SYSTEM ONLINE
							</span>
						</motion.div>

						<motion.h1
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.1 }}
							className="text-5xl md:text-7xl font-bold tracking-tight"
						>
							<span className="block text-theme">创作空间</span>
							<GlitchText text="无限可能" className="block mt-2" />
						</motion.h1>

						<motion.p
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.2 }}
							className="text-lg text-muted-foreground/60 max-w-md"
						>
							集 AI 智能、设计创新、代码开发于一体的未来创作平台
						</motion.p>

						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.3 }}
							className="flex items-center gap-4"
						>
							<Button
								size="lg"
								className="h-12 px-8 rounded-xl bg-theme hover:bg-theme/90"
							>
								<Zap className="w-5 h-5 mr-2" />
								开始创作
							</Button>
							<Button
								size="lg"
								variant="outline"
								className="h-12 px-8 rounded-xl border-theme/30"
							>
								<Play className="w-5 h-5 mr-2" />
								演示模式
							</Button>
						</motion.div>

						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.5 }}
							className="flex items-center gap-6 pt-4"
						>
							<div className="flex -space-x-2">
								{['U', 'S', 'J', 'A'].map((letter, i) => (
									<div
										key={i}
										className="w-8 h-8 rounded-full bg-theme/20 border border-theme/30 flex items-center justify-center text-xs font-mono"
									>
										{letter}
									</div>
								))}
							</div>
							<div className="text-xs text-muted-foreground/50">
								<span className="font-mono text-theme">128</span> 位创作者在线
							</div>
						</motion.div>
					</div>

					<div className="relative w-64 h-64 md:w-80 md:h-80">
						<motion.div
							className="absolute inset-0"
							animate={{
								rotate: 360,
							}}
							transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
						>
							<div className="absolute inset-0 border border-dashed border-theme/20 rounded-full" />
							<div className="absolute inset-4 border border-dashed border-theme/30 rounded-full" />
							<div className="absolute inset-8 border border-dashed border-theme/40 rounded-full" />
						</motion.div>

						<motion.div
							className="absolute inset-16 bg-linear-to-br from-theme/20 to-purple-500/20 rounded-2xl border border-theme/30 backdrop-blur-xl flex items-center justify-center"
							animate={{
								scale: [1, 1.02, 1],
							}}
							transition={{ duration: 4, repeat: Infinity }}
						>
							<Terminal className="w-12 h-12 text-theme/60" />
						</motion.div>

						{[0, 90, 180, 270].map((angle, i) => (
							<motion.div
								key={i}
								className="absolute w-10 h-10 rounded-xl bg-background/80 backdrop-blur border border-theme/30 flex items-center justify-center"
								style={{
									top: '50%',
									left: '50%',
									marginTop: '-20px',
									marginLeft: '-20px',
									transform: `rotate(${angle}deg) translateY(-120px) rotate(${-angle}deg)`,
								}}
								animate={{
									scale: [1, 1.1, 1],
								}}
								transition={{
									duration: 2,
									repeat: Infinity,
									delay: i * 0.3,
								}}
							>
								{
									[
										<Cpu key="cpu" />,
										<Database key="db" />,
										<Globe key="globe" />,
										<Lock key="lock" />,
									][i]
								}
							</motion.div>
						))}
					</div>
				</div>
			</div>

			<div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-theme/50 to-transparent" />
		</div>
	);
}

function QuickActions() {
	const actions = [
		{
			icon: FileCode,
			label: '新建项目',
			shortcut: '⌘N',
			color: 'from-blue-500 to-cyan-500',
		},
		{
			icon: FolderOpen,
			label: '打开文件',
			shortcut: '⌘O',
			color: 'from-purple-500 to-pink-500',
		},
		{
			icon: MessageSquare,
			label: 'AI 对话',
			shortcut: '⌘J',
			color: 'from-amber-500 to-orange-500',
		},
		{
			icon: Database,
			label: '知识库',
			shortcut: '⌘K',
			color: 'from-green-500 to-emerald-500',
		},
	];

	return (
		<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
			{actions.map((action, i) => (
				<motion.button
					key={action.label}
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.3 + i * 0.1 }}
					whileHover={{ scale: 1.02 }}
					whileTap={{ scale: 0.98 }}
					className="group relative p-4 rounded-2xl bg-theme/5 border border-theme/10 hover:border-theme/30 transition-all overflow-hidden"
				>
					<div
						className={cn(
							'absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-linear-to-br',
							action.color,
						)}
					/>
					<div className="relative flex flex-col items-center gap-2">
						<div
							className={cn(
								'w-12 h-12 rounded-xl flex items-center justify-center bg-linear-to-br',
								action.color,
								'opacity-20 group-hover:opacity-30 transition-opacity',
							)}
						>
							<action.icon className="w-6 h-6" />
						</div>
						<span className="text-sm font-medium">{action.label}</span>
						<span className="text-xs font-mono text-muted-foreground/40">
							{action.shortcut}
						</span>
					</div>
				</motion.button>
			))}
		</div>
	);
}

function RecentProjects() {
	const projects = [
		{ name: 'Neural Nexus', type: 'AI 项目', progress: 78, status: 'active' },
		{ name: 'Quantum UI', type: '组件库', progress: 45, status: 'pending' },
		{
			name: 'Cyber Forge',
			type: '设计系统',
			progress: 92,
			status: 'completed',
		},
	];

	return (
		<div className="space-y-3">
			{projects.map((project, i) => (
				<motion.div
					key={project.name}
					initial={{ opacity: 0, x: -20 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ delay: 0.5 + i * 0.1 }}
					className="group p-4 rounded-xl bg-theme/5 border border-theme/10 hover:border-theme/30 transition-all cursor-pointer"
				>
					<div className="flex items-center gap-3 mb-3">
						<div
							className={cn(
								'w-2 h-2 rounded-full',
								project.status === 'active' && 'bg-green-400 animate-pulse',
								project.status === 'pending' && 'bg-amber-400',
								project.status === 'completed' && 'bg-blue-400',
							)}
						/>
						<span className="text-xs text-muted-foreground/50 font-mono uppercase">
							{project.type}
						</span>
					</div>
					<h4 className="font-semibold mb-2">{project.name}</h4>
					<div className="flex items-center gap-2">
						<div className="flex-1 h-1 rounded-full bg-theme/10 overflow-hidden">
							<motion.div
								initial={{ width: 0 }}
								animate={{ width: `${project.progress}%` }}
								transition={{ duration: 1, delay: 0.8 + i * 0.2 }}
								className="h-full bg-linear-to-r from-theme to-purple-500"
							/>
						</div>
						<span className="text-xs font-mono text-muted-foreground/50">
							{project.progress}%
						</span>
					</div>
				</motion.div>
			))}
		</div>
	);
}

const Skill = () => {
	const containerRef = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({ container: containerRef });
	const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

	return (
		<div
			ref={containerRef}
			className="w-full h-full overflow-y-auto p-6 relative"
		>
			<style>{`
				@keyframes glitch-1 {
					0%, 100% { opacity: 0; }
					50% { opacity: 1; }
				}
				@keyframes glitch-2 {
					0%, 100% { opacity: 0; transform: translate(2px, -2px); }
					50% { opacity: 1; transform: translate(-2px, 2px); }
				}
				.animate-glitch-1 { animation: glitch-1 2s infinite; }
				.animate-glitch-2 { animation: glitch-2 2s infinite 0.5s; }
				.bg-gradient-radial { background: radial-gradient(circle, var(--tw-gradient-from) 0%, var(--tw-gradient-to) 100%); }
			`}</style>

			<motion.div
				className="fixed top-0 rounded-md left-0 right-0 w-full h-px bg-linear-to-r from-theme via-orange-500 to-theme z-50 origin-left"
				style={{ scaleX }}
			/>

			<div className="max-w-6xl mx-auto space-y-8">
				<HeroSection />
				<QuickActions />

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
					<div className="lg:col-span-2 space-y-8">
						<Card className="bg-theme/5 border-theme/10">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<FolderOpen className="w-5 h-5 text-theme" />
									最近项目
								</CardTitle>
							</CardHeader>
							<CardContent>
								<RecentProjects />
							</CardContent>
						</Card>

						<Card className="bg-theme/5 border-theme/10">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Command className="w-5 h-5 text-theme" />
									快捷命令
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-1">
								<MenuItem
									icon={FileCode}
									label="创建新对话"
									shortcut="⌘N"
									badge="AI"
								/>
								<MenuItem icon={FolderOpen} label="打开项目" shortcut="⌘⇧O" />
								<MenuItem icon={Database} label="同步知识库" shortcut="⌘S" />
								<MenuItem icon={Settings} label="系统设置" shortcut="⌘," />
							</CardContent>
						</Card>
					</div>

					<div className="space-y-8">
						<Card className="bg-theme/5 border-theme/10">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<TrendingUp className="w-5 h-5 text-theme" />
									今日统计
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="flex justify-center gap-8">
									<StatRing value="12" label="对话" progress={75} />
									<StatRing value="3" label="项目" progress={45} />
									<StatRing value="1.2k" label="代码" progress={60} />
								</div>
							</CardContent>
						</Card>

						<Card className="bg-theme/5 border-theme/10">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Clock className="w-5 h-5 text-theme" />
									最近动态
								</CardTitle>
							</CardHeader>
							<CardContent>
								<ActivityFeed />
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Skill;
