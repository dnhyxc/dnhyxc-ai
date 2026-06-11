/**
 * 词根词缀大全参考页
 */
import { Button, ScrollArea, Toast } from '@ui/index';
import { Square, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { displayIpaWrapped } from '@/utils';
import {
	playEnglishPreferred,
	stopAllEnglishPlayback,
} from '@/utils/englishTts';
import { ReferencePageShell } from '../components/ReferencePageShell';
import { referenceNavItemClass } from '../utils/referenceNavItemClass';
import {
	getMorphologyAffixLabel,
	MORPHOLOGY_SECTION_KEYS,
	morphologyReference,
	parseMorphologyNavSelection,
} from './morphologyData';
import type { MorphologySectionKey } from './types';

export default function EnglishMorphologyReferencePage() {
	const { t } = useI18n();
	const [searchParams, setSearchParams] = useSearchParams();
	const [playingKey, setPlayingKey] = useState<string | null>(null);

	const selection = useMemo(
		() =>
			parseMorphologyNavSelection(
				searchParams.get('section') ?? searchParams.get('tab'),
				searchParams.get('category'),
			),
		[searchParams],
	);

	const { sectionKey, categoryIndex } = selection;
	const section = morphologyReference[sectionKey];
	const category = section.categories[categoryIndex] ?? section.categories[0];

	useEffect(() => {
		const parsed = parseMorphologyNavSelection(
			searchParams.get('section') ?? searchParams.get('tab'),
			searchParams.get('category'),
		);
		const sec = morphologyReference[parsed.sectionKey];
		if (sec.categories.length === 0) return;
		if (
			parsed.categoryIndex >= sec.categories.length ||
			searchParams.get('tab') != null
		) {
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					next.set('section', parsed.sectionKey);
					next.set('category', String(parsed.categoryIndex));
					next.delete('tab');
					return next;
				},
				{ replace: true },
			);
		}
	}, [searchParams, setSearchParams]);

	useEffect(() => {
		stopAllEnglishPlayback();
		setPlayingKey(null);
	}, [sectionKey, categoryIndex]);

	const toggleExampleAudio = useCallback(
		async (word: string, key: string) => {
			if (playingKey === key) {
				stopAllEnglishPlayback();
				setPlayingKey(null);
				return;
			}
			stopAllEnglishPlayback();
			setPlayingKey(key);
			try {
				await playEnglishPreferred(word);
			} catch {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
			} finally {
				setPlayingKey((k) => (k === key ? null : k));
			}
		},
		[playingKey, t],
	);

	const onSelectCategory = useCallback(
		(key: MorphologySectionKey, index: number) => {
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					next.set('section', key);
					next.set('category', String(index));
					next.delete('tab');
					return next;
				},
				{ replace: true },
			);
		},
		[setSearchParams],
	);

	const sectionTitle = (key: MorphologySectionKey) => {
		if (key === 'prefixes')
			return t('englishLearning.reference.morphology.tabPrefixes');
		if (key === 'suffixes')
			return t('englishLearning.reference.morphology.tabSuffixes');
		return t('englishLearning.reference.morphology.tabRoots');
	};

	return (
		<ReferencePageShell
			title={t('englishLearning.reference.morphology.pageTitle')}
		>
			<ResizablePanelGroup
				id="english-morphology-split"
				orientation="horizontal"
				className="h-full min-h-0 min-w-0"
			>
				<ResizablePanel
					id="english-morphology-nav"
					defaultSize="32%"
					className="min-h-0 min-w-0"
				>
					<aside className="flex h-full min-h-0 flex-col border-r border-theme/10 bg-theme-background">
						<ScrollArea className="min-h-0 flex-1">
							<div className="space-y-4 p-2">
								{MORPHOLOGY_SECTION_KEYS.map((key) => {
									const block = morphologyReference[key];
									if (block.categories.length === 0) return null;
									return (
										<div key={key} className="space-y-0.5">
											<div className="text-textcolor/45 px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide">
												{sectionTitle(key)}
											</div>
											{block.categories.map((cat, i) => {
												const active =
													sectionKey === key && categoryIndex === i;
												return (
													<button
														key={`${key}-${cat.name}`}
														type="button"
														onClick={() => onSelectCategory(key, i)}
														className={referenceNavItemClass(
															active,
															'w-full rounded-md px-3 py-2 text-left text-sm',
														)}
													>
														{cat.name}
													</button>
												);
											})}
										</div>
									);
								})}
							</div>
						</ScrollArea>
					</aside>
				</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel
					id="english-morphology-detail"
					defaultSize="68%"
					className="min-h-0 min-w-0"
				>
					<ScrollArea className="h-full min-h-0">
						<div className="space-y-4 p-4 pt-3">
							<div className="text-textcolor text-base font-semibold">
								{category?.name ?? '—'}
							</div>
							<div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4">
								{category?.items.map((item) => {
									const affixKey = `${getMorphologyAffixLabel(item, sectionKey)}-${item.meaning}`;
									return (
										<div
											key={affixKey}
											className="bg-theme/5 rounded-md pb-2.5 border border-theme/5"
										>
											<div className="px-3 py-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-theme/5">
												<span className="text-textcolor text-lg font-semibold">
													{getMorphologyAffixLabel(item, sectionKey)}
												</span>
												<span className="text-textcolor/55 text-xs">
													{item.meaning}
												</span>
											</div>
											<div className="space-y-4 px-3 pt-1">
												{item.examples.map((ex, exIndex) => {
													const audioKey = `${affixKey}-${exIndex}-${ex.word}`;
													const playing = playingKey === audioKey;
													return (
														<div
															key={`${ex.word}-${ex.translationZh}`}
															className="relative rounded"
														>
															<div className="flex items-start justify-between gap-2 pr-0">
																<div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
																	<span className="text-textcolor text-base font-medium">
																		{ex.word}
																	</span>
																	{ex.pos?.trim() ? (
																		<span className="text-textcolor/50 text-xs">
																			{ex.pos}
																		</span>
																	) : null}
																</div>
																<Button
																	type="button"
																	variant="ghost"
																	size="sm"
																	onClick={() =>
																		void toggleExampleAudio(ex.word, audioKey)
																	}
																	className={cn(
																		'mt-0.5 h-7 w-7 shrink-0 rounded-md border p-2 transition-colors',
																		playing
																			? 'border-teal-500/40 bg-teal-500/15 text-teal-600 dark:text-teal-400'
																			: 'border-theme/10 text-textcolor/60 hover:border-theme/20 hover:bg-theme/10 hover:text-teal-600 dark:hover:text-teal-400',
																	)}
																	aria-label={
																		playing
																			? t('englishLearning.tts.stop')
																			: t('englishLearning.vocab.playWord')
																	}
																>
																	{playing ? (
																		<Square className="size-3.5 fill-current" />
																	) : (
																		<Volume2 className="size-3.5" />
																	)}
																</Button>
															</div>
															<div className="font-mono text-xs text-teal-600/90 dark:text-teal-400/90 mb-2">
																{displayIpaWrapped(ex.ipa)}
															</div>
															<div className="text-textcolor/85 mt-0.5 text-sm">
																{ex.translationZh}
															</div>
														</div>
													);
												})}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					</ScrollArea>
				</ResizablePanel>
			</ResizablePanelGroup>
		</ReferencePageShell>
	);
}
