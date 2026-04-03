import { Button } from '@ui/button';
import { CircleCheckBig } from 'lucide-react';
import type { ReactNode } from 'react';
import { THEMES, useTheme } from '@/hooks';

/** 展示用：中文说明 + 变量名 + 常用 Tailwind 类 */
function StyleRow({
	title,
	varName,
	classHint,
	children,
}: {
	title: string;
	varName: string;
	classHint?: string;
	children: ReactNode;
}) {
	return (
		<section className="space-y-1.5">
			<div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-textcolor/50">
				<span className="min-w-0 font-medium text-textcolor/65">{title}</span>
				<code className="max-w-full wrap-break-word rounded bg-theme-muted px-1.5 py-0.5 font-mono text-[10px] text-textcolor/75">
					{varName}
				</code>
				{classHint ? (
					<span className="min-w-0 max-w-full wrap-break-word text-[10px] text-textcolor/45">
						{classHint}
					</span>
				) : null}
			</div>
			{children}
		</section>
	);
}

const Theme = () => {
	const { theme, changeTheme } = useTheme();

	const colorThemes = THEMES.filter((t) => t.type === 'color');

	return (
		<div className="box-border flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-x-hidden p-0.5">
			<div className="mb-2 w-full min-w-0 max-w-full pb-5.5">
				<div className="text-md mb-4.5 px-2 font-bold sm:px-4">彩色主题</div>
				<div className="flex flex-wrap justify-between gap-4 px-2 sm:px-4">
					{colorThemes.map((t) => (
						<Button
							key={t.name}
							onClick={() => changeTheme(t.name)}
							className={`group relative h-16 w-16 cursor-pointer rounded-xl transition-all duration-200 ${
								theme === t.name ? 'ring-2' : 'hover:scale-102'
							}`}
							style={{ backgroundColor: t.value }}
						>
							<span
								style={{ color: t.value }}
								className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs opacity-0 transition-opacity group-hover:opacity-100"
							>
								{t.label}
							</span>
							{theme === t.name && (
								<div className="absolute inset-0 flex items-center justify-center">
									<div className="flex h-8 w-8 items-center justify-center rounded-full bg-theme/50">
										<CircleCheckBig className="text-textcolor" />
									</div>
								</div>
							)}
						</Button>
					))}
				</div>
			</div>

			<div className="mt-2 w-full min-w-0 max-w-full px-2 sm:px-4 pb-4.5">
				<div className="text-md mb-4.5 font-bold">主题预览</div>
				<div className="box-border w-full min-w-0 max-w-full space-y-5 rounded-xl border border-theme-border bg-theme-card p-4 text-sm sm:p-6">
					<StyleRow
						title="当前卡片背景"
						varName="--theme-card"
						classHint="· bg-theme-card"
					>
						<p className="text-[11px] text-textcolor/55">
							本预览区域容器使用 theme-card；切换上方主题即可看到变化。
						</p>
					</StyleRow>

					<div className="wrap-break-word text-md font-bold text-textcolor">
						选择彩色主题后，整个页面的背景色将跟随主题色变化
					</div>

					<StyleRow
						title="页面背景"
						varName="--theme-background"
						classHint="· bg-theme-background"
					>
						<div className="h-11 w-full rounded-lg border border-theme-border/60 bg-theme-background" />
					</StyleRow>

					<StyleRow
						title="标题 / 前景字"
						varName="--theme-foreground"
						classHint="· text-theme-foreground"
					>
						<p className="text-base font-semibold text-theme-foreground">
							用于标题、强调段落的主要前景色
						</p>
					</StyleRow>

					<StyleRow
						title="正文"
						varName="--theme-textcolor"
						classHint="· text-textcolor"
					>
						<p className="leading-relaxed text-textcolor">
							这是一段示例文本，展示在不同主题下的显示效果。页面的主要背景色、
							卡片背景、文字颜色等都会随主题色变化。
						</p>
					</StyleRow>

					<StyleRow
						title="次要说明字"
						varName="—"
						classHint="· text-textcolor/55（弱化层级）"
					>
						<p className="leading-relaxed text-textcolor/55">
							辅助说明、时间戳、占位提示等次要信息。
						</p>
					</StyleRow>

					<StyleRow
						title="主题强调色"
						varName="--theme-color"
						classHint="· text-theme"
					>
						<p className="font-medium text-theme">
							按钮、链接、焦点态等强调元素
						</p>
					</StyleRow>

					<StyleRow
						title="次要区域背景"
						varName="--theme-muted"
						classHint="· bg-theme-muted"
					>
						<div className="rounded-lg bg-theme-muted p-4">
							<p className="text-textcolor">
								muted 背景上的正文仍使用 textcolor，层次靠底色区分。
							</p>
						</div>
					</StyleRow>

					<StyleRow
						title="次要填充"
						varName="--theme-secondary"
						classHint="· bg-theme-secondary"
					>
						<div className="rounded-lg bg-theme-secondary px-4 py-2.5 text-textcolor">
							侧栏条目、次级面板等使用的次要底色
						</div>
					</StyleRow>

					<StyleRow
						title="文本选区"
						varName="--theme-selection-bg / --theme-selection-fg"
						classHint="· ::selection"
					>
						<span
							className="inline-block rounded px-2 py-1 text-xs font-medium"
							style={{
								backgroundColor: 'var(--theme-selection-bg)',
								color: 'var(--theme-selection-fg)',
							}}
						>
							拖选文本时的背景与字色示意
						</span>
					</StyleRow>

					<StyleRow
						title="边框"
						varName="--theme-border"
						classHint="· border-theme-border"
					>
						<div className="h-10 w-full rounded-lg border-2 border-theme-border bg-theme-card" />
					</StyleRow>

					<StyleRow
						title="聚焦环"
						varName="--theme-ring"
						classHint="· ring / focus-visible"
					>
						<div
							className="h-10 w-full rounded-lg bg-theme-muted"
							style={{ boxShadow: '0 0 0 2px var(--theme-ring)' }}
						/>
					</StyleRow>
				</div>
			</div>
		</div>
	);
};

export default Theme;
