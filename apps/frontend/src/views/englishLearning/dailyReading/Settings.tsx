/**
 * 每日阅读设置：主题和生成档位。保存不重写已发布的短文。
 */
import Confirm from '@design/Confirm';
import HourPicker from '@design/HourPicker';
import Loading from '@design/Loading';
import { Toast } from '@ui/index';
import { BookOpen } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n, useIsSuperAdmin } from '@/hooks';
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
import { PracticePageShell } from '../practice/components/shell';
import { LABEL } from './components/classes';
import { GenerateBar } from './components/GenerateBar';
import { ProfileFields } from './components/ProfileFields';
import { SettingActions } from './components/SettingActions';
import { sameProfile, sameThemes } from './utils/profile';

const LINK_CLASS =
	'flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-sm font-medium text-teal-500 hover:text-teal-400 disabled:cursor-not-allowed disabled:opacity-50';

const DEFAULT_AUTO_HOUR = 23;

const EMPTY_PROFILE: EnglishDailyReadingProfile = {
	level: 'B1',
	length: 'medium',
	focus: 'reading',
	questions: 0,
	useWeb: true,
};

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
	const [autoHour, setAutoHour] = useState(DEFAULT_AUTO_HOUR);
	const [savedAutoHour, setSavedAutoHour] = useState(DEFAULT_AUTO_HOUR);
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
	const historyRev = englishDailyReadingStore.historyRev;

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
					const nextHour = res.data.auto.hour ?? DEFAULT_AUTO_HOUR;
					setAutoThemes(nextAutoThemes);
					setSavedAutoThemes(nextAutoThemes);
					setAutoProfile(nextAutoProfile);
					setSavedAutoProfile(nextAutoProfile);
					setAutoHour(nextHour);
					setSavedAutoHour(nextHour);
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
		async (
			nextThemes: string[],
			nextProfile: EnglishDailyReadingProfile,
			nextHour: number,
		) => {
			setAutoSaving(true);
			try {
				const res = await saveEnglishDailyReadingAutoSettings({
					themes: nextThemes,
					profile: nextProfile,
					hour: nextHour,
				});
				const storedThemes = res.data?.themes ?? nextThemes;
				const storedProfile = res.data?.profile ?? nextProfile;
				const storedHour = res.data?.hour ?? nextHour;
				setAutoThemes(storedThemes);
				setSavedAutoThemes(storedThemes);
				setAutoProfile(storedProfile);
				setSavedAutoProfile(storedProfile);
				setAutoHour(storedHour);
				setSavedAutoHour(storedHour);
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
		!sameProfile(autoProfile, savedAutoProfile) ||
		autoHour !== savedAutoHour;
	const autoIsDefault =
		sameThemes(autoThemes, defaults) &&
		sameProfile(autoProfile, profileDefaults) &&
		autoHour === DEFAULT_AUTO_HOUR;

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
						<GenerateBar
							saving={saving}
							themes={themes}
							profile={profile}
							records={records}
							streamOpen={streamOpen}
							setStreamOpen={setStreamOpen}
							historyOpen={historyOpen}
							setHistoryOpen={setHistoryOpen}
							selectedId={selectedId}
							setSelectedId={setSelectedId}
							setDeleteId={setDeleteId}
						/>
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
									random
									hour={
										<HourPicker
											name="auto-hour"
											label={t('englishLearning.dailyReading.autoHour')}
											value={autoHour}
											disabled={autoSaving}
											onChange={setAutoHour}
										/>
									}
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
												onSave={() =>
													void persistAuto(autoThemes, autoProfile, autoHour)
												}
												onReset={() =>
													void persistAuto(
														defaults,
														profileDefaults,
														DEFAULT_AUTO_HOUR,
													)
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
