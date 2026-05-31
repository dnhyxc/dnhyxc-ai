/**
 * 单词听写 / 拼写练习 — 路由页（index）
 */
import { Toast } from '@ui/index';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useI18n } from '@/hooks';
import { stopAllEnglishPlayback } from '@/utils/englishTts';
import { PracticePageShell } from './components/shell';
import { PracticeShortcutsMenu } from './components/shell/PracticeShortcutsMenu';
import { Session } from './Session';
import { Setup } from './Setup';
import { Summary } from './Summary';
import type {
	PracticeAttemptResult,
	PracticeCountOption,
	PracticeItem,
	PracticeMode,
	PracticePhase,
	PracticeSessionCursor,
	PracticeSetupConfig,
	PracticeSource,
} from './types';
import { fetchPracticeContinueQueue } from './utils/fetchWords';
import { parsePracticeContentKind } from './utils/item';
import { parsePracticePoolTotal } from './utils/paths';

function parseSource(raw: string | null): PracticeSource {
	if (
		raw === 'library' ||
		raw === 'pack' ||
		raw === 'live' ||
		raw === 'mistakes'
	) {
		return raw;
	}
	return 'favorites';
}

function parseMode(raw: string | null): PracticeMode {
	return raw === 'spelling' ? 'spelling' : 'dictation';
}

function mergePracticedKeys(prev: string[], items: PracticeItem[]): string[] {
	const set = new Set(prev);
	for (const item of items) {
		if (item.key) set.add(item.key);
	}
	return [...set];
}

export default function EnglishLearningPracticePage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const initialContentKind = useMemo(
		() => parsePracticeContentKind(searchParams.get('contentKind')),
		[searchParams],
	);
	const initialSource = useMemo(
		() => parseSource(searchParams.get('source')),
		[searchParams],
	);
	const initialMode = useMemo(
		() => parseMode(searchParams.get('mode')),
		[searchParams],
	);
	const initialLibraryId = searchParams.get('libraryId') ?? undefined;
	const initialStreamId = searchParams.get('streamId') ?? undefined;
	const initialSourceTitle = searchParams.get('sourceTitle') ?? undefined;
	const initialPoolTotal = useMemo(
		() => parsePracticePoolTotal(searchParams.get('poolTotal')),
		[searchParams],
	);
	const initialReturnStreamId =
		searchParams.get('returnStreamId')?.trim() || undefined;
	const returnToHome = searchParams.get('returnTo') === 'home';

	const [phase, setPhase] = useState<PracticePhase>('setup');
	const [config, setConfig] = useState<PracticeSetupConfig | null>(null);
	const [queue, setQueue] = useState<PracticeItem[]>([]);
	const [index, setIndex] = useState(0);
	const [results, setResults] = useState<PracticeAttemptResult[]>([]);
	const [sessionCursor, setSessionCursor] =
		useState<PracticeSessionCursor | null>(null);
	const [practicedKeys, setPracticedKeys] = useState<string[]>([]);
	const [continueLoading, setContinueLoading] = useState(false);

	useEffect(() => {
		return () => stopAllEnglishPlayback();
	}, []);

	const onExit = useCallback(() => {
		stopAllEnglishPlayback();
		if (returnToHome) {
			navigate('/english-learning');
			return;
		}
		const kind = initialContentKind;
		if (initialSource === 'favorites') {
			navigate(
				`/english-learning/favorites?kind=${kind === 'classic' ? 'classic' : 'vocab'}`,
			);
			return;
		}
		if (initialSource === 'library') {
			navigate(
				`/english-learning/library?kind=${kind === 'classic' ? 'classic' : 'vocab'}`,
			);
			return;
		}
		if (initialSource === 'mistakes') {
			navigate(
				kind === 'classic'
					? '/english-learning/mistakes?kind=classic'
					: '/english-learning/mistakes?kind=vocab',
			);
			return;
		}
		if (initialSource === 'pack') {
			const backStreamId = initialReturnStreamId || initialStreamId;
			if (backStreamId) {
				navigate(
					`/english-learning/stream?kind=${kind === 'classic' ? 'classic' : 'vocab'}&streamId=${encodeURIComponent(backStreamId)}`,
				);
				return;
			}
		}
		navigate('/english-learning');
	}, [
		initialContentKind,
		initialReturnStreamId,
		initialSource,
		initialStreamId,
		navigate,
		returnToHome,
	]);

	const onStarted = useCallback(
		(
			items: PracticeItem[],
			setup: PracticeSetupConfig,
			cursor: PracticeSessionCursor,
		) => {
			setConfig(setup);
			setSessionCursor(cursor);
			setPracticedKeys(items.map((i) => i.key).filter(Boolean));
			setQueue(items);
			setIndex(0);
			setResults([]);
			setPhase('running');
		},
		[],
	);

	const onRetryWrong = useCallback(
		(wrongQueue: PracticeItem[]) => {
			if (!config || wrongQueue.length === 0) return;
			const n = wrongQueue.length;
			const count = (
				n <= 10 ? 10 : n <= 20 ? 20 : n <= 30 ? 30 : n <= 40 ? 40 : 50
			) as PracticeCountOption;
			const nextConfig: PracticeSetupConfig = {
				...config,
				contentKind: config.contentKind,
				count,
			};
			setConfig(nextConfig);
			setPracticedKeys((prev) => mergePracticedKeys(prev, wrongQueue));
			setQueue(wrongQueue);
			setIndex(0);
			setResults([]);
			setPhase('running');
		},
		[config],
	);

	const onContinuePractice = useCallback(async () => {
		if (!config || !sessionCursor) return;
		setContinueLoading(true);
		try {
			const { items, cursor } = await fetchPracticeContinueQueue({
				contentKind: config.contentKind,
				source: config.source,
				count: config.count,
				order: config.order,
				libraryId: config.libraryId,
				streamId: config.streamId,
				poolTotal: config.poolTotal ?? initialPoolTotal,
				cursor: sessionCursor,
				excludeKeys: practicedKeys,
			});
			if (items.length === 0) {
				Toast({
					type: 'warning',
					title: t('englishLearning.practice.continueEmpty'),
				});
				return;
			}
			setSessionCursor(cursor);
			setPracticedKeys((prev) => mergePracticedKeys(prev, items));
			setQueue(items);
			setIndex(0);
			setResults([]);
			setPhase('running');
		} catch (e) {
			Toast({
				type: 'error',
				title:
					e instanceof Error
						? e.message
						: t('englishLearning.practice.loadFailed'),
			});
		} finally {
			setContinueLoading(false);
		}
	}, [config, initialPoolTotal, practicedKeys, sessionCursor, t]);

	const onBackToSetup = useCallback(() => {
		stopAllEnglishPlayback();
		setPhase('setup');
		setConfig(null);
		setQueue([]);
		setIndex(0);
		setResults([]);
		setSessionCursor(null);
		setPracticedKeys([]);
	}, []);

	const onStepComplete = useCallback((result: PracticeAttemptResult) => {
		setResults((prev) => [...prev, result]);
		setIndex((prevIndex) => {
			const nextIndex = prevIndex + 1;
			setQueue((q) => {
				if (nextIndex >= q.length) {
					setPhase('summary');
				}
				return q;
			});
			return nextIndex;
		});
	}, []);

	const currentItem = queue[index];

	const shellTitle = useMemo(() => {
		if (phase === 'setup') {
			return initialContentKind === 'classic'
				? t('englishLearning.practice.classicSetupTitle')
				: t('englishLearning.practice.setupTitle');
		}
		if (phase === 'summary') return t('englishLearning.practice.summaryTitle');
		return initialContentKind === 'classic'
			? t('route.englishLearning.practice.classicTitle')
			: t('route.englishLearning.practice.title');
	}, [initialContentKind, phase, t]);

	const shellSubtitle = useMemo(() => {
		if (phase !== 'running' || !config) return undefined;
		return t('englishLearning.practice.progress', {
			current: index + 1,
			total: queue.length,
		});
	}, [config, index, phase, queue.length, t]);

	return (
		<PracticePageShell
			title={shellTitle}
			subtitle={shellSubtitle}
			contentLayout={phase === 'summary' ? 'fill' : 'center'}
			onBack={
				phase === 'setup' || phase === 'running' || phase === 'summary'
					? phase === 'running'
						? onBackToSetup
						: onExit
					: undefined
			}
			backLabel={t('englishLearning.practice.back')}
			headerRight={
				<PracticeShortcutsMenu
					practiceMode={phase === 'running' ? config?.mode : undefined}
				/>
			}
		>
			{phase === 'setup' ? (
				<Setup
					initialContentKind={initialContentKind}
					initialSource={initialSource}
					initialMode={initialMode}
					initialLibraryId={initialLibraryId}
					initialStreamId={initialStreamId}
					initialSourceTitle={initialSourceTitle}
					initialPoolTotal={initialPoolTotal}
					onStarted={onStarted}
				/>
			) : null}
			{phase === 'running' && config && currentItem ? (
				<Session
					mode={config.mode}
					item={currentItem}
					isLastQuestion={index >= queue.length - 1}
					onStepComplete={onStepComplete}
				/>
			) : null}
			{phase === 'summary' && config ? (
				<Summary
					results={results}
					practicedTotal={practicedKeys.length}
					config={config}
					continueLoading={continueLoading}
					onRetryWrong={onRetryWrong}
					onContinuePractice={() => void onContinuePractice()}
					onBackToSetup={onBackToSetup}
				/>
			) : null}
		</PracticePageShell>
	);
}
