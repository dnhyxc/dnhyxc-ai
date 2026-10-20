/**
 * 每日阅读设置：主题和生成档位。保存不重写已发布的短文。
 */
import { StreamingMarkdownBody } from '@design/ChatAssistantMessage/StreamingMarkdownBody';
import Confirm from '@design/Confirm';
import Loading from '@design/Loading';
import {
	bindMarkdownCodeFenceActions,
	MarkdownParser,
} from '@dnhyxc-ai/markdown-kit';
import '@dnhyxc-ai/markdown-kit/styles.css';
import {
	Button,
	Input,
	Popover,
	PopoverAnchor,
	PopoverContent,
	PopoverTrigger,
	RadioGroup,
	RadioGroupItem,
	ScrollArea,
	Toast,
} from '@ui/index';
import { Spinner } from '@ui/spinner';
import { BookOpen, History, ScrollText, Trash2, X } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useNavigate } from 'react-router';
import { getChatMarkdownHighlightTheme } from '@/constants';
import { useI18n, useIsSuperAdmin } from '@/hooks';
import { useTheme } from '@/hooks/theme';
import { useStickToBottomScroll } from '@/hooks/useStickToBottomScroll';
import { cn } from '@/lib/utils';
import {
	type DailyReadingGen,
	type EnglishDailyReadingProfile,
	getEnglishDailyReadingSettings,
	listEnglishDailyReadingGens,
	removeEnglishDailyReadingGen,
	saveEnglishDailyReadingAutoSettings,
	saveEnglishDailyReadingSettings,
} from '@/service';
import englishDailyReadingStore from '@/store/englishDailyReading';
import { downloadChatCodeBlock } from '@/utils/chatCodeToolbar';
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

/** 短文 JSON 后面还会接释义。只取第一段已闭合的对象，避免整段解析失败后退回时间。 */
function firstJsonObject(text: string): string | null {
	const start = text.indexOf('{');
	if (start < 0) return null;
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = start; i < text.length; i += 1) {
		const ch = text[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (ch === '\\') escaped = true;
			else if (ch === '"') inString = false;
			continue;
		}
		if (ch === '"') {
			inString = true;
			continue;
		}
		if (ch === '{') depth += 1;
		else if (ch === '}') {
			depth -= 1;
			if (depth === 0) return text.slice(start, i + 1);
		}
	}
	return null;
}

function recordTitle(text: string, startedAt: number): string {
	const slice = firstJsonObject(text);
	if (slice) {
		try {
			const data = JSON.parse(slice) as {
				titleZh?: unknown;
				titleEn?: unknown;
				answer?: { titleZh?: unknown; titleEn?: unknown };
			};
			const title =
				data.titleZh ??
				data.answer?.titleZh ??
				data.titleEn ??
				data.answer?.titleEn;
			if (typeof title === 'string' && title.trim()) return title.trim();
		} catch {
			// 第一段还不是完整 JSON 时，列表用开始时间。
		}
	}
	return new Date(startedAt).toLocaleString();
}

function formatElapsed(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const pad = (n: number) => String(n).padStart(2, '0');
	if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
	return `${pad(m)}:${pad(s)}`;
}

function StreamMeta({
	startedAt,
	elapsed,
	tokens,
}: {
	startedAt: number | null;
	elapsed: number;
	tokens: number;
}) {
	const { t } = useI18n();
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!startedAt) return;
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, [startedAt]);
	const ms = startedAt ? Math.max(0, now - startedAt) : elapsed;
	return (
		<div className="flex justify-between px-3 pt-2 pb-3 border-b border-theme/10 text-textcolor">
			<div className="text-base">
				{t('englishLearning.dailyReading.titleGenerationInfo')}
			</div>
			<div className="flex gap-4 text-textcolor/65">
				<div className="flex items-center">
					<div className="text-sm">
						{t('englishLearning.dailyReading.elapsed')}：
					</div>
					<div className="mt-0.5 text-sm tabular-nums">{formatElapsed(ms)}</div>
				</div>
				<div className="flex items-center">
					<div className="text-sm">
						{t('englishLearning.dailyReading.tokens')}：
					</div>
					<div className="mt-0.5 text-sm tabular-nums">
						{tokens.toLocaleString()}
					</div>
				</div>
			</div>
		</div>
	);
}

function StreamPreview({
	text,
	generating,
}: {
	text: string;
	generating: boolean;
}) {
	const { t } = useI18n();
	const { theme } = useTheme();
	const rootRef = useRef<HTMLDivElement>(null);
	const { viewportRef, scrollViewportHandlers } = useStickToBottomScroll({
		isStreaming: generating,
		contentRevision: text,
		idleFlushKey: generating ? null : 'paused',
	});
	const parser = useMemo(
		() =>
			new MarkdownParser({
				enableChatCodeFenceToolbar: true,
				chatCodeFenceToolbarTexts: {
					copy: t('common.copy'),
					download: t('common.download'),
				},
				enableMermaid: false,
				highlightTheme: getChatMarkdownHighlightTheme(theme),
			}),
		[theme, t],
	);
	useEffect(() => {
		const el = rootRef.current;
		if (!el) return;
		return bindMarkdownCodeFenceActions(el, {
			onDownload(payload) {
				void downloadChatCodeBlock(payload.block, payload.lang);
			},
		});
	}, []);
	const markdown = text
		? `\`\`\`json\n${text}${generating ? '' : '\n```'}`
		: '';
	return (
		<ScrollArea
			ref={viewportRef}
			className="h-full min-w-0 flex-1"
			viewportClassName="[overflow-anchor:none]"
			scrollbarClassName="right-0 w-1.5 border-l-0 p-0"
			{...scrollViewportHandlers}
		>
			<div
				ref={rootRef}
				data-stick-scroll-content
				className="message-md-wrap p-3 [&_.chat-md-code-block]:my-0"
			>
				{markdown ? (
					<StreamingMarkdownBody
						markdown={markdown}
						parser={parser}
						preferDark={theme === 'black'}
						isStreaming={generating}
						t={t}
						className={cn(
							'min-w-0 w-full max-w-full [&_.streaming-md-body]:min-w-0 [&_.markdown-body]:text-textcolor/90! [&_.markdown-body]:rounded-md',
							generating ? 'mb-2.5' : 'mb-0',
						)}
					/>
				) : null}
				{generating ? (
					<div className="flex items-center">
						<Spinner className="mr-2 h-4 w-4 text-textcolor/50" />
						<span className="text-sm text-textcolor/50">
							{t('chat.assistant.generating')}
						</span>
					</div>
				) : null}
			</div>
		</ScrollArea>
	);
}

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

export default observer(function DailyReadingSettingsPage() {
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
	const [error, setError] = useState<string | null>(null);
	const [streamOpen, setStreamOpen] = useState(false);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [records, setRecords] = useState<DailyReadingGen[]>([]);
	const generating = englishDailyReadingStore.generating;
	const paused = englishDailyReadingStore.paused;
	const preview = englishDailyReadingStore.text;
	const generateError = englishDailyReadingStore.error;
	const historyRev = englishDailyReadingStore.historyRev;
	const runId = englishDailyReadingStore.runId;
	const showStream = generating || (paused && Boolean(preview));
	const selected = records.find((row) => row.id === selectedId) ?? null;
	const historyView = Boolean(
		selected && (!generating || selected.id !== runId),
	);
	const showHistory = records.length > 0 || generating;
	const liveRow =
		generating && runId
			? {
					id: runId,
					text: preview,
					startedAt: englishDailyReadingStore.startedAt ?? Date.now(),
					live: true as const,
				}
			: null;
	const historyRows = [
		...(liveRow ? [liveRow] : []),
		...records
			.filter((row) => row.id !== liveRow?.id)
			.map((row) => ({
				id: row.id,
				text: row.text,
				startedAt: row.startedAt,
				live: false as const,
			})),
	];

	useEffect(() => {
		let cancelled = false;
		void listEnglishDailyReadingGens()
			.then((res) => {
				if (!cancelled) setRecords(Array.isArray(res.data) ? res.data : []);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [historyRev]);

	useEffect(() => {
		englishDailyReadingStore.setOnReady(() => {
			navigate('/english-learning/daily-reading?origin=manual');
		});
		return () => {
			englishDailyReadingStore.setOnReady(null);
		};
	}, [navigate]);

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

	return (
		<>
			<Confirm
				open={deleteId != null}
				onOpenChange={(open) => {
					if (!open) setDeleteId(null);
				}}
				title={t('englishLearning.dailyReading.deleteHistoryTitle')}
				description={t('englishLearning.dailyReading.deleteHistoryDesc')}
				confirmText={t('common.delete')}
				cancelText={t('common.cancel')}
				confirmVariant="destructive"
				closeOnConfirm={false}
				onConfirm={() => {
					const id = deleteId;
					if (!id) return;
					void removeEnglishDailyReadingGen(id)
						.then(() => {
							setRecords((rows) => rows.filter((row) => row.id !== id));
							if (selectedId === id) {
								setSelectedId(null);
								setStreamOpen(false);
							}
							setDeleteId(null);
						})
						.catch(() => {});
				}}
			/>
			<PracticePageShell
				title={
					<span className="text-textcolor min-w-0 truncate text-base font-semibold">
						{t('englishLearning.dailyReading.settingsHint')}
					</span>
				}
				contentLayout={loading ? 'fill' : 'start'}
				footer={
					!loading && !error ? (
						<Popover
							open={streamOpen && (historyView || showStream)}
							onOpenChange={setStreamOpen}
						>
							<PopoverAnchor asChild>
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
												aria-label={t(
													'englishLearning.dailyReading.dismissError',
												)}
												onClick={() => englishDailyReadingStore.clearError()}
											>
												<X className="size-4" aria-hidden />
											</Button>
										</div>
									) : null}
									<div className="flex items-center gap-2">
										<Button
											type="button"
											disabled={saving && !generating}
											className={cn(
												'h-10 min-w-0 flex-1 text-base font-semibold',
												PRACTICE_PRIMARY_ACTION_BTN_CLASS,
											)}
											onClick={() => {
												setSelectedId(null);
												setStreamOpen(false);
												if (generating) {
													englishDailyReadingStore.stopRun();
													return;
												}
												englishDailyReadingStore.startRun(themes, profile);
											}}
										>
											{generating ? (
												<Spinner className="size-4 text-white" />
											) : null}
											{generating
												? t('englishLearning.dailyReading.stopGenerate')
												: t('englishLearning.dailyReading.generate')}
										</Button>
										{showHistory ? (
											<Popover open={historyOpen} onOpenChange={setHistoryOpen}>
												<PopoverTrigger asChild>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														aria-expanded={historyOpen}
														aria-label={t(
															'englishLearning.dailyReading.history',
														)}
														className={cn(
															'size-10 shrink-0 border',
															historyOpen ? OPT_ON : OPT_OFF,
														)}
													>
														<History className="size-4" aria-hidden />
													</Button>
												</PopoverTrigger>
												<PopoverContent
													side="top"
													align="end"
													sideOffset={8}
													className="w-72 overflow-hidden p-0"
												>
													<ScrollArea
														className="w-full"
														style={{
															height: Math.min(288, historyRows.length * 40),
														}}
													>
														{historyRows.map((row) => (
															<div
																key={row.id}
																className="flex h-10 items-center pr-1.5 hover:bg-teal-500/10"
															>
																<Button
																	type="button"
																	variant="ghost"
																	className="h-10 min-w-0 flex-1 justify-start rounded-none bg-transparent px-3 hover:bg-transparent"
																	onClick={() => {
																		setSelectedId(row.id);
																		setStreamOpen(true);
																		setHistoryOpen(false);
																	}}
																>
																	<span className="min-w-0 flex-1 truncate text-left text-sm">
																		{recordTitle(row.text, row.startedAt)}
																	</span>
																</Button>
																{row.live ? (
																	<Spinner className="mr-1.5 size-4 shrink-0 text-textcolor" />
																) : (
																	<Button
																		type="button"
																		variant="ghost"
																		size="sm"
																		className="h-7 w-7 shrink-0 rounded-md p-0 text-textcolor/65 transition-colors hover:border hover:border-destructive/10 hover:bg-destructive/10 hover:text-destructive"
																		aria-label={t(
																			'englishLearning.dailyReading.deleteHistory',
																		)}
																		onClick={(event) => {
																			event.stopPropagation();
																			setDeleteId(row.id);
																		}}
																	>
																		<Trash2 className="size-3.5" aria-hidden />
																	</Button>
																)}
															</div>
														))}
													</ScrollArea>
												</PopoverContent>
											</Popover>
										) : null}
										{showStream ? (
											<PopoverTrigger asChild>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													aria-expanded={streamOpen && !historyView}
													aria-label={t(
														'englishLearning.dailyReading.showStream',
													)}
													className={cn(
														'size-10 shrink-0 border',
														streamOpen && !historyView ? OPT_ON : OPT_OFF,
													)}
													onClick={(event) => {
														setSelectedId(null);
														if (historyView) {
															event.preventDefault();
															setStreamOpen(true);
														}
													}}
												>
													<ScrollText className="size-4" aria-hidden />
												</Button>
											</PopoverTrigger>
										) : null}
									</div>
								</div>
							</PopoverAnchor>
							<PopoverContent
								side="top"
								align="start"
								sideOffset={8}
								className="w-(--radix-popover-trigger-width) overflow-hidden p-0"
							>
								<StreamMeta
									startedAt={
										historyView ? null : englishDailyReadingStore.startedAt
									}
									elapsed={
										historyView && selected
											? selected.elapsed
											: englishDailyReadingStore.elapsed
									}
									tokens={
										historyView && selected
											? selected.tokens
											: englishDailyReadingStore.tokens
									}
								/>
								<div className="flex h-65">
									<StreamPreview
										text={historyView && selected ? selected.text : preview}
										generating={historyView ? false : generating}
									/>
								</div>
							</PopoverContent>
						</Popover>
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
		</>
	);
});
