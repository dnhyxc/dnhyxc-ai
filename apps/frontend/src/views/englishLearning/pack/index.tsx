/**
 * 英语学习：单词 / 经典句拉取结果（独立路由，MobX 实时同步；历史带 streamId 分页）
 */
import { observer } from 'mobx-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useI18n } from '@/hooks';
import { EnglishLearningPanelHeader } from '../components/EnglishLearningPanelHeader';
import { EnglishPracticeEntry } from '../components/practiceEntry';
import { MasterWebSearchResultsBar } from '../components/WebSearchResultsBar';
import { ClassicQuotesPackSection } from './classic';
import { PackStreamHistoryDrawerTrigger } from './components/PackStreamHistoryDrawerTrigger';
import type { PackStreamKind, PackStreamSectionSnapshot } from './types';
import { VocabularyPackSection } from './vocabulary';

const EMPTY_SNAPSHOT: PackStreamSectionSnapshot = {
	loaded: 0,
	total: 0,
	topic: '',
	masterSearchOrganic: [],
	practiceParams: null,
	showPageLoading: false,
	historyLoadingText: '',
	showEmpty: false,
	emptyHint: '',
};

function parseKind(raw: string | null): PackStreamKind {
	return raw === 'classic' ? 'classic' : 'vocab';
}

function EnglishLearningPackStreamPageInner() {
	const { t } = useI18n();
	const [searchParams] = useSearchParams();
	const kind = useMemo(
		() => parseKind(searchParams.get('kind')),
		[searchParams],
	);
	const historyStreamId = useMemo(
		() => searchParams.get('streamId')?.trim() || null,
		[searchParams],
	);

	const [vocabSnapshot, setVocabSnapshot] =
		useState<PackStreamSectionSnapshot>(EMPTY_SNAPSHOT);
	const [classicSnapshot, setClassicSnapshot] =
		useState<PackStreamSectionSnapshot>(EMPTY_SNAPSHOT);
	const snapshot = kind === 'vocab' ? vocabSnapshot : classicSnapshot;

	const title =
		kind === 'vocab'
			? t('englishLearning.stream.vocab.pageTitle')
			: t('englishLearning.stream.classic.pageTitle');
	const countType = kind === 'vocab' ? t('common.type-1') : t('common.type-2');
	const { topic, masterSearchOrganic, practiceParams, loaded, total } =
		snapshot;

	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5.5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
					<EnglishLearningPanelHeader
						titleClassName="flex min-w-0 flex-1 items-center gap-2 overflow-hidden"
						title={
							<>
								<span className="shrink-0 whitespace-nowrap">{title}</span>
								{topic ? (
									<span
										className="text-textcolor/80 min-w-0 truncate text-sm font-normal"
										title={`${t('englishLearning.stream.topicLabel')}: ${topic}`}
									>
										{t('englishLearning.stream.topicLabel')}: {topic}
									</span>
								) : null}
								<span className="text-textcolor/50 shrink-0 whitespace-nowrap text-sm font-normal">
									{t('englishLearning.library.listCount', {
										count: total,
										type: countType,
									})}{' '}
									/{' '}
									{t('common.loaded', {
										count: loaded,
										type: countType,
									})}
								</span>
							</>
						}
						trailing={
							<div className="flex shrink-0 flex-nowrap items-center justify-end gap-3">
								{masterSearchOrganic.length > 0 ? (
									<MasterWebSearchResultsBar
										items={masterSearchOrganic}
										t={t}
									/>
								) : null}
								{practiceParams ? (
									<EnglishPracticeEntry
										variant="text"
										className="shrink-0 gap-1.5 whitespace-nowrap font-medium"
										practice={practiceParams}
									/>
								) : null}
								<PackStreamHistoryDrawerTrigger
									kind={kind}
									loadedStreamId={historyStreamId}
								/>
							</div>
						}
					/>

					<section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
						{kind === 'vocab' ? (
							<VocabularyPackSection
								historyStreamId={historyStreamId}
								onSnapshotChange={setVocabSnapshot}
							/>
						) : (
							<ClassicQuotesPackSection
								historyStreamId={historyStreamId}
								onSnapshotChange={setClassicSnapshot}
							/>
						)}
					</section>
				</div>
			</div>
		</div>
	);
}

const EnglishLearningPackStreamPage = observer(
	EnglishLearningPackStreamPageInner,
);
export default EnglishLearningPackStreamPage;
