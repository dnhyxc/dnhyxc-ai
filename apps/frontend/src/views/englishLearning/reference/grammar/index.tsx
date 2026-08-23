/**
 * 英语语法大全参考页
 */
import { ScrollArea } from '@ui/scroll-area';
import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useI18n } from '@/hooks';
import { ReferencePageShell } from '../components/ReferencePageShell';
import { referenceNavItemClass } from '../utils/referenceNavItemClass';
import { useReferenceDetailScrollReset } from '../utils/useReferenceDetailScrollReset';
import { GrammarPointBlock } from './GrammarPointBlock';
import {
	buildGrammarNavItems,
	buildGrammarNavRows,
	findGrammarNavBySectionId,
	grammarReference,
	resolveGrammarSection,
} from './grammarData';
import type { GrammarSubsection } from './types';

function GrammarSubsectionBlock({ node }: { node: GrammarSubsection }) {
	return (
		<div className="space-y-3">
			<h4 className="text-textcolor text-sm font-semibold">{node.title}</h4>
			{node.content ? (
				<p className="text-textcolor/75 text-sm leading-relaxed">
					{node.content}
				</p>
			) : null}
			{node.points?.map((p) => (
				<GrammarPointBlock key={p.name ?? p.description} point={p} />
			))}
			{node.subsections?.map((sub) => (
				<div key={sub.id} className="pl-3 border-l border-theme/15">
					<GrammarSubsectionBlock node={sub} />
				</div>
			))}
		</div>
	);
}

export default function EnglishGrammarReferencePage() {
	const { t } = useI18n();
	const [searchParams, setSearchParams] = useSearchParams();
	const navItems = useMemo(() => buildGrammarNavItems(), []);
	const navRows = useMemo(() => buildGrammarNavRows(), []);

	const activeNav = useMemo(() => {
		const id = searchParams.get('section');
		if (id) {
			const found = findGrammarNavBySectionId(id);
			if (found) return found;
		}
		return navItems[0] ?? null;
	}, [navItems, searchParams]);

	const section = useMemo(() => {
		if (!activeNav) return null;
		return resolveGrammarSection(
			activeNav.partIndex,
			activeNav.chapterIndex,
			activeNav.sectionIndex,
		);
	}, [activeNav]);

	const chapterTitle = useMemo(() => {
		if (!activeNav) return '';
		const part = grammarReference.parts[activeNav.partIndex];
		return part?.chapters[activeNav.chapterIndex]?.title ?? '';
	}, [activeNav]);

	useEffect(() => {
		if (!activeNav) return;
		const id = searchParams.get('section');
		if (id === activeNav.sectionId) return;
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				next.set('section', activeNav.sectionId);
				return next;
			},
			{ replace: true },
		);
	}, [activeNav, searchParams, setSearchParams]);

	const onSelectSection = useCallback(
		(sectionId: string) => {
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					next.set('section', sectionId);
					return next;
				},
				{ replace: true },
			);
		},
		[setSearchParams],
	);

	const detailScrollRef = useReferenceDetailScrollReset(
		activeNav?.sectionId ?? '',
	);

	return (
		<ReferencePageShell>
			<ResizablePanelGroup
				id="english-grammar-split"
				orientation="horizontal"
				className="h-full min-h-0 min-w-0"
			>
				<ResizablePanel
					id="english-grammar-nav"
					defaultSize="34%"
					className="min-h-0 min-w-0"
				>
					<aside className="flex h-full min-h-0 flex-col p-4 pr-0 border-r border-theme/5 bg-theme-background">
						<ScrollArea className="min-h-0 flex-1 pr-4">
							<div className="space-y-1 pt-0.5">
								{navRows.map((item) => {
									const chapter =
										grammarReference.parts[item.partIndex].chapters[
											item.chapterIndex
										];
									return (
										<div key={item.sectionId}>
											{item.showChapter ? (
												<div className="text-textcolor/55 pb-2.5 pt-2.5 first:pt-0 text-sm font-medium">
													{chapter.title}
												</div>
											) : null}
											<button
												type="button"
												onClick={() => onSelectSection(item.sectionId)}
												className={referenceNavItemClass(
													activeNav?.sectionId === item.sectionId,
													'w-full rounded-md py-2 pl-2 text-left text-sm',
												)}
											>
												{item.label}
											</button>
										</div>
									);
								})}
							</div>
						</ScrollArea>
					</aside>
				</ResizablePanel>
				<ResizableHandle withHandle className="w-0" />
				<ResizablePanel
					id="english-grammar-detail"
					defaultSize="66%"
					className="min-h-0 min-w-0"
				>
					<ScrollArea ref={detailScrollRef} className="h-full min-h-0 py-4">
						<div className="space-y-4 px-4">
							{section ? (
								<>
									<div>
										{chapterTitle ? (
											<p className="text-textcolor/50 mb-2.5 text-sm">
												{chapterTitle}
											</p>
										) : null}
										<h3 className="text-textcolor text-base font-semibold">
											{section.title}
										</h3>
										{section.content ? (
											<p className="text-textcolor/75 mt-2 text-sm leading-relaxed">
												{section.content}
											</p>
										) : null}
									</div>
									{section.points?.map((p) => (
										<GrammarPointBlock
											key={p.name ?? p.description}
											point={p}
										/>
									))}
									{section.subsections?.map((sub) => (
										<GrammarSubsectionBlock key={sub.id} node={sub} />
									))}
								</>
							) : (
								<p className="text-textcolor/50 text-sm">
									{t('englishLearning.reference.grammar.empty')}
								</p>
							)}
						</div>
					</ScrollArea>
				</ResizablePanel>
			</ResizablePanelGroup>
		</ReferencePageShell>
	);
}
