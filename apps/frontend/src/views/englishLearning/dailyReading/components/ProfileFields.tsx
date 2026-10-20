import { Button, Input, Toast } from '@ui/index';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EnglishDailyReadingProfile } from '@/service';
import { nextFocus } from '../utils/profile';
import { LABEL, OPT_OFF, OPT_ON } from './classes';
import { OptionRow } from './OptionRow';

const CHIP =
	'relative inline-flex h-8 items-center rounded-md border border-theme/10 bg-theme/5 px-3 text-base font-semibold text-textcolor';

export function ProfileFields({
	idPrefix,
	themes,
	setThemes,
	draft,
	setDraft,
	profile,
	setProfile,
	disabled,
	actions,
}: {
	idPrefix: string;
	themes: string[];
	setThemes: (next: string[]) => void;
	draft: string;
	setDraft: (next: string) => void;
	profile: EnglishDailyReadingProfile;
	setProfile: (next: EnglishDailyReadingProfile) => void;
	disabled: boolean;
	actions?: ReactNode;
}) {
	const { t } = useI18n();
	const addTheme = () => {
		const label = draft.trim().replace(/\s+/g, ' ');
		if (!label) return;
		if (label.length > 16 || /[<>]/.test(label)) {
			Toast({
				type: 'warning',
				title: t('englishLearning.dailyReading.themeInvalid'),
			});
			return;
		}
		setDraft('');
		if (themes.includes(label)) return;
		setThemes([...themes, label]);
	};
	return (
		<>
			<section className="flex min-w-0 flex-col gap-3">
				<h2 className={LABEL}>{t('englishLearning.dailyReading.themes')}</h2>
				<div className="border-theme/10 bg-theme/5 flex flex-col gap-3 rounded-md border p-3">
					<div className="flex flex-wrap gap-3">
						{themes.map((theme) => (
							<span key={theme} className={CHIP}>
								{theme}
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									disabled={disabled}
									aria-label={`${t('englishLearning.dailyReading.themeRemove')} ${theme}`}
									className="absolute -top-2 -right-2 size-5 rounded-full border border-theme/10 bg-[color-mix(in_oklch,var(--theme-color)_5%,color-mix(in_oklch,var(--theme-color)_5%,var(--theme-background)))] p-0 text-textcolor/55 hover:border-teal-500 hover:bg-teal-600 hover:text-white"
									onClick={() => {
										if (themes.length <= 1) {
											Toast({
												type: 'warning',
												title: t('englishLearning.dailyReading.themeInvalid'),
											});
											return;
										}
										setThemes(themes.filter((item) => item !== theme));
									}}
								>
									<X className="size-3" aria-hidden />
								</Button>
							</span>
						))}
					</div>
					<div className="border-theme/10 focus-within:border-teal-500/40 flex h-10 items-center overflow-hidden rounded-md border">
						<Input
							value={draft}
							maxLength={16}
							disabled={disabled}
							placeholder={t('englishLearning.dailyReading.themePlaceholder')}
							className="h-10 min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:border-transparent focus-visible:ring-0"
							onChange={(e) => setDraft(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									addTheme();
								}
							}}
						/>
						<Button
							type="button"
							variant="ghost"
							disabled={disabled || !draft.trim()}
							className="text-textcolor/70 hover:text-textcolor h-10 w-20 shrink-0 rounded-none border-l border-theme/10 px-4 font-normal hover:bg-teal-500/10"
							onClick={addTheme}
						>
							{t('englishLearning.dailyReading.themeAdd')}
						</Button>
					</div>
				</div>
			</section>
			<div className="grid grid-cols-2 gap-4">
				<OptionRow
					name={`${idPrefix}-level`}
					label={t('englishLearning.dailyReading.level')}
					value={profile.level}
					options={(['A2', 'B1', 'B2', 'C1'] as const).map((value) => ({
						value,
						label: value,
					}))}
					onChange={(level) => setProfile({ ...profile, level })}
				/>
				<OptionRow
					name={`${idPrefix}-length`}
					label={t('englishLearning.dailyReading.length')}
					value={profile.length}
					options={[
						{
							value: 'short',
							label: t('englishLearning.dailyReading.lengthShort'),
						},
						{
							value: 'medium',
							label: t('englishLearning.dailyReading.lengthMedium'),
						},
						{
							value: 'long',
							label: t('englishLearning.dailyReading.lengthLong'),
						},
					]}
					onChange={(length) => setProfile({ ...profile, length })}
				/>
			</div>
			<div className="grid grid-cols-2 gap-4">
				<section className="flex min-w-0 flex-col gap-3">
					<h2 className={LABEL}>{t('englishLearning.dailyReading.focus')}</h2>
					<div className="grid grid-cols-3 gap-4">
						{(
							[
								['reading', 'englishLearning.dailyReading.focusReading'],
								['vocab', 'englishLearning.dailyReading.focusVocab'],
								['grammar', 'englishLearning.dailyReading.focusGrammar'],
							] as const
						).map(([key, labelKey]) => {
							const on =
								key === 'reading'
									? profile.focus === 'reading'
									: key === 'vocab'
										? profile.focus === 'vocab' || profile.focus === 'both'
										: profile.focus === 'grammar' || profile.focus === 'both';
							return (
								<Button
									key={key}
									type="button"
									variant="ghost"
									aria-pressed={on}
									className={cn(
										'h-10 w-full border text-base font-semibold',
										on ? OPT_ON : OPT_OFF,
									)}
									onClick={() =>
										setProfile({
											...profile,
											focus: nextFocus(profile.focus, key),
										})
									}
								>
									{t(labelKey)}
								</Button>
							);
						})}
					</div>
				</section>
				<OptionRow
					name={`${idPrefix}-questions`}
					label={t('englishLearning.dailyReading.questions')}
					value={String(profile.questions) as '0' | '2' | '3'}
					options={[
						{
							value: '0',
							label: t('englishLearning.dailyReading.questions0'),
						},
						{
							value: '2',
							label: t('englishLearning.dailyReading.questions2'),
						},
						{
							value: '3',
							label: t('englishLearning.dailyReading.questions3'),
						},
					]}
					onChange={(value) =>
						setProfile({
							...profile,
							questions: Number(value) as 0 | 2 | 3,
						})
					}
				/>
			</div>
			<OptionRow
				name={`${idPrefix}-useWeb`}
				label={t('englishLearning.dailyReading.useWeb')}
				value={profile.useWeb ? 'on' : 'off'}
				options={[
					{
						value: 'on',
						label: t('englishLearning.dailyReading.useWebOn'),
					},
					{
						value: 'off',
						label: t('englishLearning.dailyReading.useWebOff'),
					},
				]}
				onChange={(value) => setProfile({ ...profile, useWeb: value === 'on' })}
				trailing={actions}
			/>
		</>
	);
}
