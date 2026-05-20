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
import { GrammarPointBlock } from './GrammarPointBlock';
import {
	buildGrammarNavItems,
	buildGrammarNavRows,
	findGrammarNavBySectionId,
	grammarReference,
	resolveGrammarSection,
} from './grammarData';
import { ReferencePageShell } from './ReferencePageShell';
import { referenceNavItemClass } from './referenceNavItemClass';
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

	return (
		<ReferencePageShell title={grammarReference.title}>
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
					<aside className="flex h-full min-h-0 flex-col border-r border-theme/10 bg-theme-background">
						<ScrollArea className="min-h-0 flex-1">
							<div className="space-y-0.5 p-2 pt-0.5">
								{navRows.map((item) => {
									const chapter =
										grammarReference.parts[item.partIndex].chapters[
											item.chapterIndex
										];
									return (
										<div key={item.sectionId}>
											{item.showChapter ? (
												<div className="text-textcolor/55 px-2 pb-1 pt-3 text-xs font-medium">
													{chapter.title}
												</div>
											) : null}
											<button
												type="button"
												onClick={() => onSelectSection(item.sectionId)}
												className={referenceNavItemClass(
													activeNav?.sectionId === item.sectionId,
													'w-full rounded-md py-2 pl-4 pr-2 text-left text-sm',
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
				<ResizableHandle withHandle />
				<ResizablePanel
					id="english-grammar-detail"
					defaultSize="66%"
					className="min-h-0 min-w-0"
				>
					<ScrollArea className="h-full min-h-0">
						<div className="space-y-4 p-4 pt-3.5">
							{section ? (
								<>
									<div>
										{chapterTitle ? (
											<p className="text-textcolor/50 mb-2.5 text-xs">
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
