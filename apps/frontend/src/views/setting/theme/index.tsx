import { Button } from '@ui/button';
import { CircleCheckBig } from 'lucide-react';
import type { ReactNode } from 'react';
import { THEMES, useI18n, useTheme } from '@/hooks';

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
	const { t } = useI18n();

	const colorThemes = THEMES.filter((themeItem) => themeItem.type === 'color');

	return (
		<div className="box-border flex h-full min-h-0 w-full min-w-0 max-w-3xl mx-auto flex-col overflow-x-hidden">
			<div className="mb-2 w-full pb-5.5">
				<div className="text-md mb-4.5 font-bold">
					{t('setting.theme.colorTitle')}
				</div>
				<div className="flex flex-wrap justify-between gap-2">
					{colorThemes.map((themeItem) => (
						<Button
							key={themeItem.name}
							onClick={() => changeTheme(themeItem.name)}
							className={`group relative h-16 w-16 cursor-pointer rounded-xl transition-all duration-200 ${
								theme === themeItem.name ? 'ring-2' : 'hover:scale-102'
							}`}
							style={{ backgroundColor: themeItem.value }}
						>
							<span
								style={{ color: themeItem.value }}
								className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs opacity-0 transition-opacity group-hover:opacity-100"
							>
								{t(themeItem.labelKey) ?? themeItem.label}
							</span>
							{theme === themeItem.name && (
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

			<div className="mt-2 w-full pb-4.5">
				<div className="text-md mb-4.5 font-bold">
					{t('setting.theme.previewTitle')}
				</div>
				<div className="box-border w-full space-y-5 rounded-xl border border-theme-border bg-theme-card p-4 text-sm sm:p-6">
					<StyleRow
						title={t('setting.theme.preview.cardBg.title')}
						varName="--theme-card"
						classHint="· bg-theme-card"
					>
						<p className="text-[11px] text-textcolor/55">
							{t('setting.theme.preview.cardBg.desc')}
						</p>
					</StyleRow>

					<div className="wrap-break-word text-md font-bold text-textcolor">
						{t('setting.theme.preview.tip')}
					</div>

					<StyleRow
						title={t('setting.theme.preview.pageBg.title')}
						varName="--theme-background"
						classHint="· bg-theme-background"
					>
						<div className="h-11 w-full rounded-lg border border-theme-border/60 bg-theme-background" />
					</StyleRow>

					<StyleRow
						title={t('setting.theme.preview.foreground.title')}
						varName="--theme-foreground"
						classHint="· text-theme-foreground"
					>
						<p className="text-base font-semibold text-theme-foreground">
							{t('setting.theme.preview.foreground.desc')}
						</p>
					</StyleRow>

					<StyleRow
						title={t('setting.theme.preview.text.title')}
						varName="--theme-textcolor"
						classHint="· text-textcolor"
					>
						<p className="leading-relaxed text-textcolor">
							{t('setting.theme.preview.text.desc')}
						</p>
					</StyleRow>

					<StyleRow
						title={t('setting.theme.preview.mutedText.title')}
						varName="—"
						classHint="· text-textcolor/55（弱化层级）"
					>
						<p className="leading-relaxed text-textcolor/55">
							{t('setting.theme.preview.mutedText.desc')}
						</p>
					</StyleRow>

					<StyleRow
						title={t('setting.theme.preview.accent.title')}
						varName="--theme-color"
						classHint="· text-theme"
					>
						<p className="font-medium text-theme">
							{t('setting.theme.preview.accent.desc')}
						</p>
					</StyleRow>

					<StyleRow
						title={t('setting.theme.preview.mutedBg.title')}
						varName="--theme-muted"
						classHint="· bg-theme-muted"
					>
						<div className="rounded-lg bg-theme-muted p-4">
							<p className="text-textcolor">
								{t('setting.theme.preview.mutedBg.desc')}
							</p>
						</div>
					</StyleRow>

					<StyleRow
						title={t('setting.theme.preview.secondary.title')}
						varName="--theme-secondary"
						classHint="· bg-theme-secondary"
					>
						<div className="rounded-lg bg-theme-secondary px-4 py-2.5 text-textcolor">
							{t('setting.theme.preview.secondary.desc')}
						</div>
					</StyleRow>

					<StyleRow
						title={t('setting.theme.preview.selection.title')}
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
							{t('setting.theme.preview.selection.desc')}
						</span>
					</StyleRow>

					<StyleRow
						title={t('setting.theme.preview.border.title')}
						varName="--theme-border"
						classHint="· border-theme-border"
					>
						<div className="h-10 w-full rounded-lg border-2 border-theme-border bg-theme-card" />
					</StyleRow>

					<StyleRow
						title={t('setting.theme.preview.ring.title')}
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
