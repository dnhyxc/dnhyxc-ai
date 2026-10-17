/**
 * 每日阅读设置：主题和生成档位。保存不重写已发布的短文。
 */
import Loading from '@design/Loading';
import { Button, Input, RadioGroup, RadioGroupItem, Toast } from '@ui/index';
import { Spinner } from '@ui/spinner';
import { BookOpen, X } from 'lucide-react';
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { useNavigate } from 'react-router';
import { useI18n, useIsSuperAdmin } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	type EnglishDailyReadingProfile,
	generateEnglishDailyReading,
	getEnglishDailyReadingManualPending,
	getEnglishDailyReadingSettings,
	saveEnglishDailyReadingAutoSettings,
	saveEnglishDailyReadingSettings,
	stopEnglishDailyReading,
} from '@/service';
import { getRequestErrorMessage } from '@/utils/fetch';
import { PracticePageShell } from '../practice/components/shell';
import { PRACTICE_PRIMARY_ACTION_BTN_CLASS } from '../practice/constants';

const LABEL = 'text-textcolor text-sm font-semibold';
const OPT_ON =
	'border-teal-500/40 bg-teal-500/15 text-textcolor hover:border-teal-500/40 hover:bg-teal-500/15';
const OPT_OFF =
	'border-theme/10 bg-theme/5 text-textcolor hover:border-teal-500/35 hover:bg-teal-500/10';
const OPT_BTN = cn(
	'flex h-10 w-full cursor-pointer items-center justify-center rounded-md text-base font-semibold disabled:cursor-not-allowed',
	PRACTICE_PRIMARY_ACTION_BTN_CLASS,
);

function nextFocus(
	current: EnglishDailyReadingProfile['focus'],
	key: 'reading' | 'vocab' | 'grammar',
): EnglishDailyReadingProfile['focus'] {
	if (key === 'reading') return 'reading';
	const vocab = current === 'vocab' || current === 'both';
	const grammar = current === 'grammar' || current === 'both';
	const nextVocab = key === 'vocab' ? !vocab : vocab;
	const nextGrammar = key === 'grammar' ? !grammar : grammar;
	if (nextVocab && nextGrammar) return 'both';
	if (nextVocab) return 'vocab';
	if (nextGrammar) return 'grammar';
	return 'reading';
}
const CHIP =
	'relative inline-flex h-8 items-center rounded-md border border-theme/10 bg-theme/5 px-3 text-base font-semibold text-textcolor';
const LINK_CLASS =
	'flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-sm font-medium text-teal-500 hover:text-teal-400 disabled:cursor-not-allowed disabled:opacity-50';
function OptionRow<T extends string>({
	name,
	label,
	value,
	options,
	onChange,
	trailing,
}: {
	name: string;
	label: string;
	value: T;
	options: { value: T; label: string }[];
	onChange: (value: T) => void;
	trailing?: ReactNode;
}) {
	const radios = (
		<RadioGroup
			value={value}
			onValueChange={(next) => onChange(next as T)}
			className={cn(
				'grid gap-4',
				options.length === 4
					? 'grid-cols-4'
					: options.length === 2
						? 'grid-cols-2'
						: 'grid-cols-3',
			)}
		>
			{options.map((opt) => {
				const id = `${name}-${opt.value}`;
				const active = value === opt.value;
				return (
					<label
						key={opt.value}
						htmlFor={id}
						className={cn(
							'flex h-10 cursor-pointer items-center justify-center rounded-md border text-base font-semibold transition-colors',
							active ? OPT_ON : OPT_OFF,
						)}
					>
						<RadioGroupItem value={opt.value} id={id} className="sr-only" />
						{opt.label}
					</label>
				);
			})}
		</RadioGroup>
	);
	return (
		<section className="flex min-w-0 flex-col gap-3">
			{trailing ? (
				<div className="flex min-w-0 items-stretch gap-4">
					<div className="flex min-w-0 flex-1 flex-col gap-3">
						<h2 className={LABEL}>{label}</h2>
						{radios}
					</div>
					{trailing}
				</div>
			) : (
				<>
					<h2 className={LABEL}>{label}</h2>
					{radios}
				</>
			)}
		</section>
	);
}

function ProfileFields({
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

const EMPTY_PROFILE: EnglishDailyReadingProfile = {
	level: 'B1',
	length: 'medium',
	focus: 'reading',
	questions: 0,
	useWeb: true,
};

function sameThemes(a: string[], b: string[]) {
	return a.length === b.length && a.every((item, index) => item === b[index]);
}

function sameProfile(
	a: EnglishDailyReadingProfile,
	b: EnglishDailyReadingProfile,
) {
	return (
		a.level === b.level &&
		a.length === b.length &&
		a.focus === b.focus &&
		a.questions === b.questions &&
		a.useWeb === b.useWeb
	);
}

function SettingActions({
	dirty,
	isDefault,
	disabled,
	onSave,
	onReset,
}: {
	dirty: boolean;
	isDefault: boolean;
	disabled: boolean;
	onSave: () => void;
	onReset: () => void;
}) {
	const { t } = useI18n();
	if (!dirty && isDefault) return null;
	return (
		<div className="flex min-w-0 flex-1 flex-col gap-3">
			<h2 className={LABEL}>{t('englishLearning.dailyReading.actions')}</h2>
			<div
				className={cn(
					'grid gap-4',
					dirty && !isDefault ? 'grid-cols-2' : 'grid-cols-1',
				)}
			>
				{!isDefault ? (
					<Button
						type="button"
						variant="ghost"
						disabled={disabled}
						className={cn(
							'h-10 w-full border text-base font-semibold',
							OPT_OFF,
						)}
						onClick={onReset}
					>
						{t('englishLearning.dailyReading.themeReset')}
					</Button>
				) : null}
				{dirty ? (
					<button
						type="button"
						disabled={disabled}
						className={OPT_BTN}
						onClick={onSave}
					>
						{t('englishLearning.dailyReading.save')}
					</button>
				) : null}
			</div>
		</div>
	);
}

export default function DailyReadingSettingsPage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const isSuperAdmin = useIsSuperAdmin();
	const [themes, setThemes] = useState<string[]>([]);
	const [defaults, setDefaults] = useState<string[]>([]);
	const [profile, setProfile] =
		useState<EnglishDailyReadingProfile>(EMPTY_PROFILE);
	const [profileDefaults, setProfileDefaults] =
		useState<EnglishDailyReadingProfile>(EMPTY_PROFILE);
	const [savedThemes, setSavedThemes] = useState<string[]>([]);
	const [savedProfile, setSavedProfile] =
		useState<EnglishDailyReadingProfile>(EMPTY_PROFILE);
	const [draft, setDraft] = useState('');
	const [autoThemes, setAutoThemes] = useState<string[]>([]);
	const [autoProfile, setAutoProfile] =
		useState<EnglishDailyReadingProfile>(EMPTY_PROFILE);
	const [savedAutoThemes, setSavedAutoThemes] = useState<string[]>([]);
	const [savedAutoProfile, setSavedAutoProfile] =
		useState<EnglishDailyReadingProfile>(EMPTY_PROFILE);
	const [autoDraft, setAutoDraft] = useState('');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [autoSaving, setAutoSaving] = useState(false);
	const [flight, setFlight] = useState(false);
	const [pending, setPending] = useState(false);
	const [resumeWatch, setResumeWatch] = useState(0);
	const generating = flight || pending;
	const abortRef = useRef<AbortController | null>(null);
	const runIdRef = useRef<string | null>(null);
	const stoppedRef = useRef(false);
	const [error, setError] = useState<string | null>(null);
	const [generateError, setGenerateError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		void getEnglishDailyReadingSettings({ silent: true })
			.then((res) => {
				if (cancelled || !res.data) return;
				const nextThemes = res.data.themes ?? [];
				const nextProfile = res.data.profile ?? EMPTY_PROFILE;
				setThemes(nextThemes);
				setSavedThemes(nextThemes);
				setDefaults(res.data.defaults ?? []);
				setProfile(nextProfile);
				setSavedProfile(nextProfile);
				setProfileDefaults(res.data.profileDefaults ?? EMPTY_PROFILE);
				if (res.data.auto) {
					const nextAutoThemes = res.data.auto.themes ?? [];
					const nextAutoProfile = res.data.auto.profile ?? EMPTY_PROFILE;
					setAutoThemes(nextAutoThemes);
					setSavedAutoThemes(nextAutoThemes);
					setAutoProfile(nextAutoProfile);
					setSavedAutoProfile(nextAutoProfile);
				}
				setError(null);
			})
			.catch((e) => {
				if (!cancelled) {
					setError(
						e instanceof Error
							? e.message
							: t('englishLearning.dailyReading.loadFailed'),
					);
				}
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [t]);

	const persist = useCallback(
		async (nextThemes: string[], nextProfile: EnglishDailyReadingProfile) => {
			setSaving(true);
			try {
				const res = await saveEnglishDailyReadingSettings({
					themes: nextThemes,
					profile: nextProfile,
				});
				const storedThemes = res.data?.themes ?? nextThemes;
				const storedProfile = res.data?.profile ?? nextProfile;
				setThemes(storedThemes);
				setSavedThemes(storedThemes);
				setProfile(storedProfile);
				setSavedProfile(storedProfile);
				if (res.data?.defaults) setDefaults(res.data.defaults);
				if (res.data?.profileDefaults)
					setProfileDefaults(res.data.profileDefaults);
				Toast({
					type: 'success',
					title: t('englishLearning.dailyReading.settingsSaved'),
				});
			} catch {
				// http 已弹出服务端错误
			} finally {
				setSaving(false);
			}
		},
		[t],
	);

	const persistAuto = useCallback(
		async (nextThemes: string[], nextProfile: EnglishDailyReadingProfile) => {
			setAutoSaving(true);
			try {
				const res = await saveEnglishDailyReadingAutoSettings({
					themes: nextThemes,
					profile: nextProfile,
				});
				const storedThemes = res.data?.themes ?? nextThemes;
				const storedProfile = res.data?.profile ?? nextProfile;
				setAutoThemes(storedThemes);
				setSavedAutoThemes(storedThemes);
				setAutoProfile(storedProfile);
				setSavedAutoProfile(storedProfile);
				Toast({
					type: 'success',
					title: t('englishLearning.dailyReading.settingsSaved'),
				});
			} catch {
				// http 已弹出服务端错误
			} finally {
				setAutoSaving(false);
			}
		},
		[t],
	);

	const dirty =
		!sameThemes(themes, savedThemes) || !sameProfile(profile, savedProfile);
	const isDefault =
		sameThemes(themes, defaults) && sameProfile(profile, profileDefaults);
	const autoDirty =
		!sameThemes(autoThemes, savedAutoThemes) ||
		!sameProfile(autoProfile, savedAutoProfile);
	const autoIsDefault =
		sameThemes(autoThemes, defaults) &&
		sameProfile(autoProfile, profileDefaults);

	useEffect(() => {
		let cancelled = false;
		let timer = 0;
		const tick = async () => {
			try {
				const res = await getEnglishDailyReadingManualPending({
					silent: true,
				});
				if (cancelled) return;
				const isPending = !stoppedRef.current && res.data?.pending === true;
				setPending(isPending);
				if (isPending && !timer) {
					timer = window.setInterval(() => void tick(), 2000);
				}
				if (!isPending && timer) {
					window.clearInterval(timer);
					timer = 0;
				}
			} catch {
				// 查询失败时保留上一次的生成状态
			}
		};
		void tick();
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [resumeWatch]);

	const generate = useCallback(async () => {
		stoppedRef.current = false;
		const ac = new AbortController();
		const runId = crypto.randomUUID();
		abortRef.current = ac;
		runIdRef.current = runId;
		setFlight(true);
		setGenerateError(null);
		try {
			const res = await generateEnglishDailyReading(
				{
					themes,
					profile,
					runId,
				},
				{ silent: true, timeout: 180_000, signal: ac.signal, retries: 0 },
			);
			if (stoppedRef.current || ac.signal.aborted) return;
			if (!res.success) {
				setGenerateError(
					res.message || t('englishLearning.dailyReading.generateFailed'),
				);
				return;
			}
			navigate('/english-learning/daily-reading?origin=manual');
		} catch (e) {
			if (stoppedRef.current || ac.signal.aborted) return;
			const message = getRequestErrorMessage(e);
			if (message === '已停止') return;
			setGenerateError(message);
		} finally {
			if (stoppedRef.current) {
				setPending(false);
			} else {
				try {
					const res = await getEnglishDailyReadingManualPending({
						silent: true,
					});
					const isPending = res.data?.pending === true;
					setPending(isPending);
					if (isPending) setResumeWatch((n) => n + 1);
				} catch {
					// 查不到时按未在生成处理，避免按钮一直转
					setPending(false);
				}
			}
			setFlight(false);
		}
	}, [navigate, profile, themes, t]);

	const stopGenerate = useCallback(async () => {
		stoppedRef.current = true;
		setPending(false);
		try {
			await stopEnglishDailyReading({
				silent: true,
				runId: runIdRef.current ?? undefined,
			});
		} catch {
			stoppedRef.current = false;
		}
		abortRef.current?.abort();
		setFlight(false);
	}, []);

	return (
		<PracticePageShell
			title={
				<span className="text-textcolor min-w-0 truncate text-base font-semibold">
					{t('englishLearning.dailyReading.settingsHint')}
				</span>
			}
			contentLayout={loading ? 'fill' : 'start'}
			footer={
				!loading && !error ? (
					<div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
						{generateError ? (
							<div className="flex items-center justify-between gap-2">
								<p
									className="min-w-0 flex-1 truncate text-sm text-rose-500"
									title={generateError}
								>
									{generateError}
								</p>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									className="size-7 -mr-2 shrink-0 bg-transparent p-0 text-textcolor/55 shadow-none hover:bg-transparent hover:text-rose-500"
									aria-label={t('englishLearning.dailyReading.dismissError')}
									onClick={() => setGenerateError(null)}
								>
									<X className="size-4" aria-hidden />
								</Button>
							</div>
						) : null}
						<Button
							type="button"
							disabled={saving && !generating}
							className={cn(
								'h-10 w-full text-base font-semibold',
								PRACTICE_PRIMARY_ACTION_BTN_CLASS,
							)}
							onClick={() => {
								if (generating) {
									void stopGenerate();
									return;
								}
								void generate();
							}}
						>
							{generating ? <Spinner className="size-4 text-white" /> : null}
							{generating
								? t('englishLearning.dailyReading.stopGenerate')
								: t('englishLearning.dailyReading.generate')}
						</Button>
					</div>
				) : undefined
			}
			headerRight={
				!loading && !error ? (
					<button
						type="button"
						className={LINK_CLASS}
						onClick={() => navigate('/english-learning/daily-reading')}
					>
						<BookOpen className="size-4 shrink-0 mt-0.5" aria-hidden />
						<span>{t('englishLearning.dailyReading.openList')}</span>
					</button>
				) : undefined
			}
		>
			{loading ? <Loading /> : null}
			{!loading && error ? (
				<p className="text-textcolor/55 py-16 text-center text-sm">{error}</p>
			) : null}
			{!loading && !error ? (
				<div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
					{isSuperAdmin ? (
						<div className="flex min-w-0 items-center gap-3">
							<h2 className={cn(LABEL, 'shrink-0')}>
								{t('englishLearning.dailyReading.manualTitle')}
							</h2>
							<p className="text-textcolor/55 ml-auto min-w-0 text-right text-sm">
								{t('englishLearning.dailyReading.manualHint')}
							</p>
						</div>
					) : null}
					<ProfileFields
						idPrefix="manual"
						themes={themes}
						setThemes={setThemes}
						draft={draft}
						setDraft={setDraft}
						profile={profile}
						setProfile={setProfile}
						disabled={saving}
						actions={
							dirty || !isDefault ? (
								<SettingActions
									dirty={dirty}
									isDefault={isDefault}
									disabled={saving}
									onSave={() => void persist(themes, profile)}
									onReset={() => void persist(defaults, profileDefaults)}
								/>
							) : undefined
						}
					/>
					{isSuperAdmin ? (
						<section className="border-theme/10 flex flex-col gap-5 border-t pt-5">
							<div className="flex min-w-0 items-center gap-3">
								<h2 className={cn(LABEL, 'shrink-0')}>
									{t('englishLearning.dailyReading.autoTitle')}
								</h2>
								<p className="text-textcolor/55 ml-auto min-w-0 text-right text-sm">
									{t('englishLearning.dailyReading.autoHint')}
								</p>
							</div>
							<ProfileFields
								idPrefix="auto"
								themes={autoThemes}
								setThemes={setAutoThemes}
								draft={autoDraft}
								setDraft={setAutoDraft}
								profile={autoProfile}
								setProfile={setAutoProfile}
								disabled={autoSaving}
								actions={
									autoDirty || !autoIsDefault ? (
										<SettingActions
											dirty={autoDirty}
											isDefault={autoIsDefault}
											disabled={autoSaving}
											onSave={() => void persistAuto(autoThemes, autoProfile)}
											onReset={() =>
												void persistAuto(defaults, profileDefaults)
											}
										/>
									) : undefined
								}
							/>
						</section>
					) : null}
				</div>
			) : null}
		</PracticePageShell>
	);
}
