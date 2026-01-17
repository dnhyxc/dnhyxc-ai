/** biome-ignore-all lint/a11y/noSvgWithoutTitle: <explanation> */
import { THEMES, useTheme } from '@/hooks';
import { Button } from '@ui/button';

const Theme = () => {
	const { theme, changeTheme, isDark } = useTheme();

	const defaultThemes = THEMES.filter((t) => t.type === 'default');
	const colorThemes = THEMES.filter((t) => t.type === 'color');

	const activeTheme = isDark ? 'dark' : theme;

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<div className="border-b dark:border-gray-800 border-gray-300 pb-5.5 mb-1 min-w-[610px]">
				<div className="text-lg font-bold mb-4">基础主题</div>
				<div className="flex items-center gap-4 px-10">
					{defaultThemes.map((t) => (
						<Button
							key={t.name}
							onClick={() => changeTheme(t.name as any)}
							className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
								activeTheme === t.name
									? 'border-theme bg-theme-light/50 dark:bg-theme-light/20'
									: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
							}`}
						>
							<div
								className="w-6 h-6 rounded-full border border-gray-300"
								style={{ backgroundColor: t.value }}
							/>
							<span className="text-sm">{t.label}</span>
						</Button>
					))}
				</div>
			</div>

			<div className="mt-6 border-b dark:border-gray-800 border-gray-300 pb-5.5 mb-1 min-w-[610px]">
				<div className="text-lg font-bold mb-4">彩色主题</div>
				<div className="flex flex-wrap gap-4 px-10">
					{colorThemes.map((t) => (
						<Button
							key={t.name}
							onClick={() => changeTheme(t.name as any)}
							className={`group relative w-16 h-16 rounded-xl transition-all duration-200 ${
								theme === t.name
									? 'ring-2 ring-offset-2 dark:ring-offset-gray-800 scale-105'
									: 'hover:scale-102'
							}`}
							style={{ backgroundColor: t.value }}
							title={t.label}
						>
							{theme === t.name && (
								<div className="absolute inset-0 flex items-center justify-center">
									<div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
										<svg
											className="w-5 h-5"
											fill="none"
											stroke={t.value}
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M5 13l4 4L19 7"
											/>
										</svg>
									</div>
								</div>
							)}
							<span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
								{t.label}
							</span>
						</Button>
					))}
				</div>
			</div>

			<div className="mt-6 pb-7 w-full">
				<div className="text-lg font-bold mb-4 px-10">主题预览</div>
				<div className="mx-10 p-6 rounded-xl border border-theme-border bg-theme-card">
					<div className="text-xl font-bold text-theme mb-4">
						选择彩色主题后，整个页面的背景色将跟随主题色变化
					</div>
					<div className="space-y-4">
						<div className="p-4 rounded-lg bg-theme-muted">
							<p className="text-theme-foreground">
								这是一段示例文本，展示在不同主题下的显示效果。页面的主要背景色、
								卡片背景、文字颜色等都会随主题色变化。
							</p>
						</div>
						<div className="flex gap-4">
							<Button className="px-4 py-2 rounded-lg text-white text-sm bg-theme hover:opacity-90 transition-opacity">
								主要按钮
							</Button>
							<Button className="px-4 py-2 rounded-lg text-sm border border-theme text-theme hover:bg-theme-light/30 transition-colors">
								次要按钮
							</Button>
						</div>
						<div className="flex gap-4 items-center">
							<div className="w-8 h-8 rounded-full bg-theme"></div>
							<div className="w-8 h-8 rounded-full bg-theme-light"></div>
							<div className="w-8 h-8 rounded-full bg-theme-muted border border-theme-border"></div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Theme;
