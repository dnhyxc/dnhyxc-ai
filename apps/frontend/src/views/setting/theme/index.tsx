import { Button } from '@ui/button';
import { CircleCheckBig } from 'lucide-react';
import { THEMES, useTheme } from '@/hooks';

const Theme = () => {
	const { theme, changeTheme } = useTheme();

	const colorThemes = THEMES.filter((t) => t.type === 'color');

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-2">
			<div className="border-b border-theme/20 pb-7 mb-2 min-w-[610px]">
				<div className="text-md font-bold mb-6">彩色主题</div>
				<div className="flex flex-wrap gap-4 px-10">
					{colorThemes.map((t) => (
						<Button
							key={t.name}
							onClick={() => changeTheme(t.name as any)}
							className={`group relative w-16 h-16 rounded-xl transition-all duration-200 cursor-pointer ${
								theme === t.name ? 'ring-2' : 'hover:scale-102'
							}`}
							style={{ backgroundColor: t.value }}
						>
							<span
								style={{ color: t.value }}
								className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
							>
								{t.label}
							</span>
							{theme === t.name && (
								<div className="absolute inset-0 flex items-center justify-center">
									<div className="w-8 h-8 rounded-full bg-theme/50 flex items-center justify-center">
										<CircleCheckBig className="text-textcolor" />
									</div>
								</div>
							)}
						</Button>
					))}
				</div>
			</div>
			<div className="mt-6 pb-7 w-full">
				<div className="text-md font-bold mb-6 px-10">主题预览</div>
				<div className="mx-10 p-6 rounded-xl border border-theme-border bg-theme-card">
					<div className="text-md font-bold text-textcolor mb-4">
						选择彩色主题后，整个页面的背景色将跟随主题色变化
					</div>
					<div className="space-y-4 text-sm">
						<div className="p-4 rounded-lg bg-theme-muted">
							<p className="text-textcolor">
								这是一段示例文本，展示在不同主题下的显示效果。页面的主要背景色、
								卡片背景、文字颜色等都会随主题色变化。
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Theme;
