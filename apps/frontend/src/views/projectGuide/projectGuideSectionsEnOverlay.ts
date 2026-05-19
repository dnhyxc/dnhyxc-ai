/**
 * 产品指南独立页的英文正文（与 projectGuideSections.ts 中章节/条目 id 一一对应）。
 */
export const PROJECT_GUIDE_SECTION_TITLES_EN: Record<string, string> = {
	'pg-s1': '1. What you can do with it',
	'pg-s2': '2. Desktop vs browser',
	'pg-s3': '3. Quick start (about 5 minutes)',
	'pg-s4': '4. Chat in depth',
	'pg-s5': '5. Knowledge base in depth',
	'pg-s6': '6. Markdown authoring',
	'pg-s7': '7. Shortcuts',
	'pg-s8': '8. Recommended settings',
	'pg-s9': '9. FAQ',
	'pg-s10': '10. Glossary',
	'pg-s11': '11. Sharing, RAG mode, and UI language',
	'pg-s12': '12. More in the Knowledge editor',
	'pg-s13': '13. English learning (word packs, quotes, favorites)',
	'pg-s14': '14. Going deeper',
	'pg-s15': '15. About window and legal pages',
};

export const PROJECT_GUIDE_ITEMS_EN: Record<
	string,
	{ title: string; description: string }
> = {
	'pg-s1-1': {
		title: 'Chat',
		description:
			'Ask questions, discuss plans, polish writing, and collaborate on code and documents.',
	},
	'pg-s1-2': {
		title: 'Knowledge base',
		description:
			'Capture notes in Markdown (cloud or local), then reuse them while writing and searching.',
	},
	'pg-s1-english': {
		title: 'English learning',
		description:
			'Stream themed word packs and classic sentences; import JSON into libraries with paginated browsing, pull history, multi-session Agent chat, favorites, and one-click Word (DOCX) export. Main flows require signing in.',
	},
	'pg-s1-3': {
		title: 'Rich Markdown',
		description:
			'Math (KaTeX), code highlighting, task lists, Mermaid diagrams—suited for technical notes and specs.',
	},
	'pg-s1-4': {
		title: 'Desktop experience',
		description:
			'On desktop you get deeper OS integration: global shortcuts, folder pickers, launch at login, and more.',
	},
	'pg-s2-1': {
		title: '2.1 Desktop (recommended)',
		description:
			'Best when you need stronger local capabilities: global shortcuts, choosing a folder for files, startup options—ideal for heavy writing and long-term knowledge management.',
	},
	'pg-s2-2': {
		title: '2.2 Browser',
		description:
			'Good for quick access. Features are limited to what the web platform allows; some actions show “desktop only.” When logged out you can still browse the home page, open Knowledge (local mode by default), and read some public pages (product guide, release notes, policies, etc.). Flows that need an account (e.g. Chat) will prompt you to sign in after you enter.',
	},
	'pg-s3-1': {
		title: '3.1 First-time suggestions',
		description:
			'(1) Open Chat and ask about a real task (e.g. weekly report or comparison).\n(2) Open Knowledge and save conclusions as Markdown.\n(3) If you write technical docs, try task lists, math, and Mermaid.',
	},
	'pg-s3-2': {
		title: '3.2 Typical workflows',
		description:
			'Chat then capture: outline in chat, then persist conclusions in Knowledge.\nOrganize sources: turn links and summaries into searchable Markdown.\nSpec writing: Background → Goals → Options → Trade-offs → Conclusion, plus Mermaid flow or sequence diagrams.',
	},
	'pg-s3-3': {
		title: '3.3 Home “Quick start”: steps vs top bar',
		description:
			'The step list and the top “quick start” button differ: the top button still opens /chat. The “Create account” step opens Login with the registration form (URL carries mode=register so refresh or copy keeps you on register). “Get started” steps match the top bar and open Chat. Toggling login/register syncs the address bar; history usually uses replace to avoid stacking duplicate /login entries. Opening /login?mode=register from a bookmark also lands on register.',
	},
	'pg-s4-1': {
		title: '4.1 Basic prompts',
		description:
			'Structure prompts with context, goal, constraints (length, tone, audience, steps vs comparison), and desired format (e.g. table or numbered steps). Example: “PRD review—need a one-page summary, under 300 words, bullet list.”',
	},
	'pg-s4-2': {
		title: '4.2 Streaming, stop, and continue',
		description:
			'Replies stream as they generate. Stop early if you have enough; use continue to extend the current answer. Branches and regeneration live in a message tree; shared read-only pages try to keep order and layout consistent even in complex branch cases.',
	},
	'pg-s4-3': {
		title: '4.3 Web search and citations',
		description:
			'Ask for up-to-date info or sourced answers. You can require authoritative sources, clickable citations, or “sources first, then summary.”',
	},
	'pg-s4-4': {
		title: '4.4 Attachments and OCR',
		description:
			'Upload images or screenshots and ask to extract text, summarize, or turn tables into Markdown.',
	},
	'pg-s4-5': {
		title: '4.5 Desktop voice input (Tauri)',
		description:
			'On desktop, hover the round main button to open the input mode menu and switch between text and voice. In voice mode, tap to speak; recognized text fills the input continuously; tap again to stop. Edit before sending. Menu strings follow the UI language.',
	},
	'pg-s5-1': {
		title: '5.1 Cloud vs local',
		description:
			'Cloud suits multi-device sync; local keeps Markdown in a folder you control. When logged out, Knowledge defaults to local mode and hides irrelevant entries (e.g. recycle bin).',
	},
	'pg-s5-2': {
		title: '5.2 Create and edit',
		description:
			'Create a doc (title + body), write Markdown, then save manually or rely on auto-save. Suggested outline: title, background, goals, conclusion first, reasoning, todos, references.',
	},
	'pg-s5-3': {
		title: '5.3 Save modes',
		description:
			'Manual save for explicit checkpoints; overwrite when updating one canonical doc; debounced auto-save after you pause typing to reduce lost work. Long drafts favor auto-save; structured edits may favor manual save.',
	},
	'pg-s5-4': {
		title: '5.4 Local folders: scan, open, delete, external editors',
		description:
			'Folders are scanned recursively for Markdown. Edit in-app or open in an external editor (e.g. Cursor). On desktop, delete behavior depends on source: local files affect disk only; cloud entries linked to local files may offer delete local only, cloud only, or both.',
	},
	'pg-s5-5': {
		title: '5.5 Recycle bin',
		description:
			'With cloud management, deleted items may go to the recycle bin for recovery.',
	},
	'pg-s5-6': {
		title: '5.6 In-document AI assistant (logged in)',
		description:
			'When logged in, use the Knowledge doc assistant at the bottom of the editor for multi-turn help grounded in the current Markdown. Hidden when logged out. Long threads: use scroll-to-bottom / scroll-to-top near the input; during streaming you can jump back to the latest output. Send selected editor text to the assistant for AI or RAG follow-ups; overlapping selections may be deduped for context (behavior per release). On desktop when logged in, the assistant supports text/voice like Chat and follows UI language.',
	},
	'pg-s6-1': {
		title: '6.1 Task lists',
		description:
			'Use `- [ ]` / `- [x]` for plans, milestones, and acceptance checks.',
	},
	'pg-s6-2': {
		title: '6.2 Math (KaTeX)',
		description: 'Inline and block equations for algorithms and derivations.',
	},
	'pg-s6-3': {
		title: '6.3 Code blocks',
		description:
			'Paste commands and snippets with language-specific highlighting.',
	},
	'pg-s6-4': {
		title: '6.4 Mermaid',
		description:
			'Flowcharts, sequence diagrams, state charts from text. Draft with Chat, then refine in Knowledge.',
	},
	'pg-s7-1': {
		title: '7.1 Global shortcuts (desktop)',
		description:
			'Configure shortcuts for common actions. Conflicts are blocked with a clear message so one shortcut does not trigger multiple actions.',
	},
	'pg-s7-2': {
		title: '7.2 In-page shortcuts (Knowledge)',
		description:
			'Shortcuts such as save or clear draft apply only on the Knowledge page to avoid accidental triggers elsewhere.',
	},
	'pg-s8-1': {
		title: '8.1 File storage',
		description:
			'On desktop, pick a default folder that fits your workflow (sync drive, project root, etc.).',
	},
	'pg-s8-2': {
		title: '8.2 Startup and quit (desktop)',
		description:
			'Balance always-available (launch at login, minimize to tray) vs freeing resources (quit fully on close).',
	},
	'pg-s9-1': {
		title: '9.1 Why “desktop only”?',
		description:
			'Browsers cannot access some OS APIs (global shortcuts, native folder pickers, etc.). Desktop builds include those capabilities.',
	},
	'pg-s9-2': {
		title: '9.2 Markdown looks wrong',
		description:
			'Check fenced code blocks are closed; validate Mermaid/math syntax; split content to isolate issues. Pasting large ```tsx fences containing literal ```mermaid can confuse formatting—back up or paste in smaller chunks.',
	},
	'pg-s9-3': {
		title: '9.3 Turning chat into reusable knowledge',
		description:
			'Ask the model for conclusions, key points, and todos; paste into Knowledge; add your context and final decisions.',
	},
	'pg-s10-1': {
		title: 'Terms',
		description:
			'Tauri: desktop shell wrapping the web UI.\nSSE: server-sent events for streaming.\nOCR: text extraction from images.\nGFM: GitHub-flavored Markdown.\nMermaid: text-based diagrams.\nDebounce: delay action until input pauses.\nRAG: retrieval-augmented generation—retrieve snippets then generate (used in Knowledge assistant modes).',
	},
	'pg-s11-1': {
		title: '11.1 Shared sessions (read-only)',
		description:
			'Share generates a link for read-only viewing in a browser—no install required. Message order matches the conversation, including branches/regeneration; layout aligns with the online reader.',
	},
	'pg-s11-2': {
		title: '11.2 Knowledge assistant: AI vs RAG',
		description:
			'Besides default AI mode (multi-turn on current Markdown), switch to RAG to answer using retrieved snippets—good for “questions against your corpus.” Mode switching and streaming mirror Chat; citations help verify sources.',
	},
	'pg-s11-3': {
		title: '11.3 UI language',
		description:
			'Switch Chinese/English in Settings; Chat, Knowledge assistant, menus, and common prompts follow. Desktop voice needs microphone permission. Untranslated spots are usually new UI pending i18n keys.',
	},
	'pg-s12-1': {
		title: 'Preview TOC and anchors',
		description:
			'Long docs: use the preview outline or heading anchors (including hash navigation).',
	},
	'pg-s12-2': {
		title: 'Context menu',
		description:
			'After selecting text in the editor, use the context menu for quick edits alongside the bottom toolbar.',
	},
	'pg-s12-3': {
		title: 'Mermaid zoom and preview',
		description: 'Zoom complex diagrams for easier reading.',
	},
	'pg-s12-4': {
		title: 'Format code blocks',
		description:
			'Format supported fenced languages when available; nested fences may need backup or incremental paste.',
	},
	'pg-s13-1': {
		title: '13.1 Word packs and classic lines (streaming)',
		description:
			'Fill theme and counts, then generate with streaming UI; cancel per product controls; errors show readable messages. Main pass summarizes points; web search triggers when the model judges it needed (e.g. time-sensitive topics). Combine with Knowledge RAG so answers carry verifiable citations, consistent with the Knowledge assistant domain.',
	},
	'pg-s13-2': {
		title: '13.2 Quick intents (toolbar chips)',
		description:
			'Toolbar chips attach prefixes or intent hints; tap again to deselect. Labels follow the UI language from Settings.',
	},
	'pg-s13-3': {
		title: '13.3 Left form and returning to the page',
		description:
			'Theme, counts, and other left-panel fields are generally restored after you navigate away and back (works with streaming singleton state; exact behavior per release).',
	},
	'pg-s13-4': {
		title: '13.4 Favorites, drawer, and DOCX export',
		description:
			'Favorite words or lines; browse and manage in a paginated drawer, with multi-select and confirmed batch unfavorite. Export word favorites or quote favorites to Word (DOCX); the server aggregates up to about 3000 items per account by favorite time (newest first), independent of the drawer page; word export may include part-of-speech (pos) fields. Browser and desktop both use binary download and local save; desktop dedupe prompts if implemented.',
	},
	'pg-s13-5': {
		title: '13.5 Libraries and JSON import',
		description:
			'Use the left-rail library area to import. Standalone page /english-learning/import with kind=vocab or kind=classic. Drag a .json file, preview/validate, set a title, and save; large packs use an upload path suited to big files. After save you land in the library with the new pack selected; the title can be prefilled from the filename without extension.',
	},
	'pg-s13-6': {
		title: '13.6 Browse and manage libraries',
		description:
			'Pick a library on the left; the right pane loads entries with pagination and load-more. Within the same session, switching libraries and returning restores loaded pages and scroll when possible. Delete a word library after confirmation (entries cascade). Favorite stars load incrementally as lists grow.',
	},
	'pg-s13-7': {
		title: '13.7 Pull history, results page, and stop',
		description:
			'History drawer lists past pack runs; in-progress rows are marked and usually not deletable. Opening history goes to the results page without overwriting the left-rail form for a new pull. Finished history can be deleted. Header shows topic and web-search summary; live vs history paging differs. Stopping a stream keeps generated content and typically avoids a harsh error toast.',
	},
	'pg-s13-8': {
		title: '13.8 English-learning Agent (multi-session)',
		description:
			'Agent chat supports multiple sessions with a paginated history drawer; “New chat” clears the view and creates the server session on first send. Quick intents affect only the current turn, not stored transcript. Saving to the knowledge base may navigate you there to continue editing.',
	},
	'pg-s13-9': {
		title: '13.9 List and left-rail UX details',
		description:
			'Pulled word or quote grids can collapse/expand; a new pull expands automatically. Quick intents show a few chips by default with expand for all. Word packs can show abbreviated part-of-speech labels (e.g. n, v, adj).',
	},
	'pg-s13-10': {
		title: '13.10 When the network is flaky (especially desktop)',
		description:
			'On desktop, transient list or favorite-status failures may auto-retry read-only calls and show readable toasts instead of raw transport errors. Write actions such as favorite/unfavorite are generally not retried to avoid duplicate side effects.',
	},
	'pg-s14-1': {
		title: 'Topic notes and release overview',
		description:
			'This page targets everyday use. For hosting, reverse proxies, editor edge cases, or contributing, search topic-specific maintainer material in your local clone—feature index, deployment examples, desktop voice, Monaco notes, etc. The in-app Release Notes page (/update-info) is the user-facing “what changed” overview—read it alongside this guide; keep it in sync with maintainer source material before each release.',
	},
	'pg-s15-1': {
		title: '15.1 Service policy and user agreement',
		description:
			'From About: Service Policy and User Agreement open in the system browser (desktop) or a new tab (web), not inside the small About window—same full-page scroll feel as share pages, without main chrome. Routes /service-policy and /user-agreement; available logged out.\nBesides changing UI language in Settings, those pages have a header toggle like the product guide: ?lang= switches zh/en and refreshes body copy immediately.\nLegal copy is product-level; maintainer-edited in code.',
	},
	'pg-s15-2': {
		title: '15.2 Release notes (standalone structured page)',
		description:
			'About also opens Release Notes in the browser. Route /update-info; no main chrome; header plus scroll body like share pages. Regular section layout (not a Markdown preview wall); wording stays aligned with the external release-notes write-up—update structured frontend data when that prose changes.',
	},
	'pg-s15-3': {
		title: '15.3 Product guide (standalone structured page)',
		description:
			'Home “Learn more” opens this guide in the default browser or a new tab. Route /project-guide; full-page scroll; logged-out OK. Header title plus language toggle (?lang=), same pattern as legal standalone pages. Structured sections like release notes; keep frontend guide modules (including English overlay) in sync when this prose changes.',
	},
};
