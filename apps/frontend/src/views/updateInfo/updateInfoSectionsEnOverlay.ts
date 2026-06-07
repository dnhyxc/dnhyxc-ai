/**
 * 更新信息独立页的英文正文（与 updateInfoSections.ts 中章节/条目 id 一一对应）。
 * 维护中文主数据时，请同步补齐此处映射。
 */

export const UPDATE_INFO_INTRO_EN =
	'This page summarizes core capabilities and recent improvements so you can quickly see what is new or better. The content is product-level and focuses on user-visible behavior. We do not list internal file or directory paths here—implementation details live alongside the source in topic-specific notes you can search after cloning the repo.';

/** 章节标题（key = section.id） */
export const UPDATE_INFO_SECTION_TITLES_EN: Record<string, string> = {
	s1: '1. Releases & updates',
	s2: '2. Account & access control',
	s3: '3. Desktop app & browser',
	s4: '4. Chat (Chatbot)',
	s5: '5. Markdown toolkit & rendering',
	s6: '6. Knowledge base (editor, list, local mode)',
	s7: '7. Monaco editor improvements',
	s8: '8. Charts & code block UX',
	s9: '9. System settings & usability',
	s10: '10. UI components & experience',
	s11: '11. Desktop voice input & transcription (Tauri)',
	s12: '12. Internationalization (UI language)',
	s13: '13. Knowledge base RAG & multi-session assistant',
	s14: '14. Sharing, public reading & chat architecture',
	s15: '15. Monaco & Markdown advanced (summary)',
	s16: '16. Desktop clipboard & layout',
	s17: '17. Deployment, gateway & operations',
	s18: '18. @dnhyxc-ai/markdown-kit & fenced-block parsing',
	s19: '19. Metadata & documentation conventions',
	s20: '20. About dialog & standalone legal pages',
	s21: '21. Release notes standalone page (structured UI)',
	s22: '22. Product guide page & home entry',
	s23: '23. Home “Quick start” & sign-up entry',
	s24: '24. English learning (vocabulary packs, quotes & favorites)',
};

/** 条目标题与描述（key = bullet.id） */
export const UPDATE_INFO_BULLETS_EN: Record<
	string,
	{ title: string; description: string }
> = {
	's1-1': {
		title: 'Public update page refreshes after release',
		description:
			'After a production build is published, the update-info page refreshes to the latest content automatically, reducing manual upkeep and omissions. Local-only validation can skip the sync step via a flag. (Pending commit.)',
	},
	's1-2': {
		title: 'GitHub Release DMG upload script',
		description:
			'upload-dmg-to-release (pnpm upload-dmg at repo root) uploads the Tauri-built .dmg to the same GitHub Release as upload-to-release (e.g. latest tag), using GITHUB_TOKEN, OWNER, APP_REPO, and related env vars. By default it picks the newest .dmg by mtime from the DMG build output folder; override via CLI arg or DMG_PATH.',
	},
	's2-1': {
		title: 'Route-level login guard',
		description:
			'Unauthenticated visits to protected routes are redirected to the login page; public routes are unaffected.',
	},
	's2-2': {
		title: 'Auth expiry handling',
		description:
			'When the API returns 401 Unauthorized, the session is cleared consistently and re-login is triggered, avoiding “looks logged in but is actually expired” drift.',
	},
	's2-3': {
		title: 'Public route policy',
		description:
			'When logged out you can still open home, login, about, share links, the knowledge base (local-only by default—see Section 6), settings and its subpaths, the desktop download landing page, the product guide, legal policies, agreements, and this structured update page. Chat and other signed-in flows stay behind the guard; standalone public routes match Sections 21–22.',
	},
	's2-4': {
		title: 'Avatar storage on Tencent Cloud COS',
		description:
			'Profile avatars and chat attachments are uploaded through the server to Tencent Cloud COS, replacing Qiniu direct upload and local uploads storage. Full object URLs are saved after upload. On the web, objects use the same-origin /ext-cos/ proxy. Preview and downloads are adapted for COS with success/failure toasts. Deployments need COS credentials and readable objects (public-read or equivalent).',
	},
	's3-1': {
		title: 'One frontend for desktop and browser',
		description:
			'The same frontend runs in the desktop shell (Tauri) and in a standalone browser.',
	},
	's3-2': {
		title: 'Capability degradation & hints',
		description:
			'In the browser, desktop-only features such as folder pickers, launch at login, and global shortcuts degrade to hints instead of crashing or blanking the page.',
	},
	's3-3': {
		title: 'Consistent external-link policy',
		description:
			'External links behave consistently and safely across environments (fewer unnecessary permissions and context leaks).',
	},
	's3-4': {
		title: 'macOS production: allow specific HTTP hosts',
		description:
			'App Transport Security (ATS) in Info.plist can allow selected http hosts so production builds can reach those resources.',
	},
	's3-5': {
		title: 'Tauri / browser parity',
		description:
			'Mind init order, capability degradation, and link policy so browser-only environments do not hit desktop-only APIs and white-screen.',
	},
	's4-1': {
		title: 'Streaming chat (SSE)',
		description:
			'Supports streaming generation, stop, and continuation for smoother conversation.',
	},
	's4-2': {
		title: 'Sessions & history',
		description:
			'Create sessions, list and query history, update, and delete sessions.',
	},
	's4-3': {
		title: 'Branches & regenerate',
		description:
			'Conversations support tree-shaped branches and regenerate flows; share read-only views keep message order and layout aligned with online reading even in complex branch cases (complements Section 14 and the message-order fix).',
	},
	's4-4': {
		title: 'Shared conversation message order fix',
		description:
			'Fixes incorrect message order on share pages for more consistent reading.',
	},
	's4-5': {
		title: 'Web search & citations',
		description:
			'Supports web retrieval with citation metadata for traceability.',
	},
	's4-6': {
		title: 'Attachments & OCR',
		description:
			'Attachment handling and OCR improve multimodal input usability.',
	},
	's4-7': {
		title: 'Async persistence & reliability',
		description:
			'Queues (e.g. BullMQ) improve message persistence reliability and scalability.',
	},
	's4-8': {
		title: 'Desktop chat input: voice & stop-recording policy',
		description:
			'On the Tauri client, the bottom input supports text/voice modes, live dictation, and stop-recording cleanup; after stop, no second full-audio transcription pass is sent—see Section 11 for details.',
	},
	's4-9': {
		title: 'Unified chat model backend',
		description:
			'Main Chat now uses the SiliconFlow OpenAI-compatible API by default (GLM-4.7 family). Streaming, stop, continue, and branching behave the same on your side.',
	},
	's4-10': {
		title: 'Chat attachment image preview fix',
		description:
			'Fixes failed image preview after upload on web and desktop (Chinese filenames, cross-port blocking, misconfigured gateways). On production web, attachments load via the same site API route instead of a separate static image path; message payloads use on-disk filenames for OCR. Deploy both frontend and backend and restart; legacy direct /images/ URLs may still need gateway fixes.',
	},
	's5-1': {
		title: 'Markdown rendering',
		description:
			'Common Markdown syntax and rich output with pragmatic error tolerance.',
	},
	's5-2': {
		title: 'Math',
		description:
			'KaTeX rendering with errors isolated so the rest of the page still renders.',
	},
	's5-3': {
		title: 'Syntax highlighting & themes',
		description:
			'highlight.js with theme switching for different reading preferences.',
	},
	's5-4': {
		title: 'Task lists',
		description: 'GitHub Flavored Markdown (GFM) task list rendering.',
	},
	's5-5': {
		title: 'Mermaid diagrams',
		description: 'Mermaid rendering and runtime handling for richer documents.',
	},
	's5-6': {
		title: 'Markdown rendering hardening',
		description:
			'Raw HTML is disabled by default (e.g. <script> is escaped as text), reducing XSS risk when mounting via innerHTML/dangerouslySetInnerHTML; enable HTML explicitly with sanitization if needed.',
	},
	's6-1': {
		title: 'Cloud & local modes',
		description:
			'Manage cloud knowledge entries or use a local folder as the library source.',
	},
	's6-2': {
		title: 'Logged-out: local only',
		description:
			'When logged out, local mode is default and cloud APIs are not called; irrelevant entry points (e.g. trash) are hidden.',
	},
	's6-3': {
		title: 'Local folder management',
		description:
			'Recursive Markdown scan, read/save/delete, and open in an external editor.',
	},
	's6-4': {
		title: 'Delete branching: local / online / both',
		description:
			'When a cloud item matches a located local file on desktop, the delete dialog offers delete local, delete online, or both—preserving prior “both” behavior for existing users.',
	},
	's6-5': {
		title: 'Auto-save (debounced)',
		description:
			'Debounced auto-save reduces write churn and aligns with explicit overwrite semantics to avoid accidental overwrites.',
	},
	's6-6': {
		title: 'In-page chord shortcuts',
		description:
			'Chord shortcuts in the knowledge base for save, clear, open list, toggle action bar, etc.',
	},
	's6-7': {
		title: 'Trash open & clear: editor session state',
		description:
			'Opening from trash keeps snapshots aligned with body and correct Diff baselines; “new / clear draft” refreshes the editor session id to match list-open-then-clear, avoiding stuck split-diff views.',
	},
	's6-8': {
		title: 'Doc assistant: pin bottom/top & hidden when logged out',
		description:
			'When logged in, the bottom document assistant is available; the thread supports jump to bottom or back to top (same idea as Markdown preview badges) for long streaming replies; hidden when logged out.',
	},
	's6-9': {
		title: 'Assistant streaming across documents',
		description:
			'Fixes losing streaming state after switching documents/routes and back; improves the edge case when first save happens mid-stream to avoid wrong termination or incomplete session binding.',
	},
	's6-10': {
		title: 'Assistant input menu follows UI language',
		description:
			'Knowledge-base assistant bottom input aligns with Section 12 UI language; labels such as input mode switch with zh/en; pairs with Section 11 desktop voice.',
	},
	's6-11': {
		title: 'Local directory & editor sync',
		description:
			'Folder scan, disk writes, editor buffer, and list state stay aligned; logged-out local-only policy matches earlier Section 6 items.',
	},
	's6-12': {
		title: 'Send selection to the document assistant',
		description:
			'In the knowledge-base Markdown editor you can send the current selection to the bottom document assistant for AI or RAG prompts; overlapping or duplicate sends are deduped to reduce noisy context.',
	},
	's6-13': {
		title: 'Outline TOC prepended with a level-2 heading',
		description:
			'After “Generate outline” in Knowledge AI mode, the TOC is inserted with a “## 目录” heading; if the doc already has anchor links or a non-standard TOC title at the top, only the heading is added or normalized; if “## 目录” is already present, you are notified and nothing is duplicated.',
	},
	's6-14': {
		title: 'Knowledge assistant streaming UX',
		description:
			'AI-mode assistant streaming no longer shows a collapsible “thinking process” block; the loading spinner beside “Generating…” animates correctly, aligned with main Chat behavior.',
	},
	's6-15': {
		title: 'Format before Knowledge save',
		description:
			'Manual save and debounced auto-save run the same document formatter as in the editor (including safe fenced-code handling) before writing to cloud or local storage.',
	},
	's7-1': {
		title: 'IME (input method editor) compatibility',
		description:
			'Mitigations and practices for CJK IME ghosting/overlap issues in Monaco.',
	},
	's7-2': {
		title: 'Split preview scroll sync',
		description:
			'Editor and preview scroll in sync, including complex cases like chunked diagram rendering.',
	},
	's7-3': {
		title: 'Desktop layout stability',
		description:
			'Better measurement and reflow in desktop WebView to reduce jitter and misalignment.',
	},
	's7-4': {
		title: 'Clipboard & shortcut policy',
		description:
			'Avoids conflicts between editor shortcuts and plain inputs so copy/cut/paste stay reliable.',
	},
	's7-5': {
		title: 'Markdown split Diff',
		description:
			'Bottom bar toggles exclusive “left edit / right read-only Diff” vs “left edit / right preview”; compares against snapshot when the editor opened; distinguishes trivial empty diffs vs “deleted everything”; fixes session switching and model disposal ordering issues.',
	},
	's7-6': {
		title: 'Diff eligibility as shared utilities',
		description:
			'Whether Diff is allowed is centralized in helpers shared by bottom-bar disabled state and click handlers, reducing drift and enabling reuse.',
	},
	's7-7': {
		title: 'Diff & sticky scroll',
		description:
			'Diff and the main editor share sticky-scroll; sticky bar backgrounds align with global styles and theme tokens to reduce glass-theme tint issues.',
	},
	's8-1': {
		title: 'Mermaid interaction',
		description: 'Zoom and preview affordances for complex diagrams.',
	},
	's8-2': {
		title: 'Code block toolbar',
		description:
			'Friendlier actions (copy, download, etc.) in chat code blocks with better layout inside scroll containers.',
	},
	's9-1': {
		title: 'Shortcut conflict protection',
		description:
			'When recording shortcuts in settings, conflicts block save with a clear message; matching uses actual key chords (e.g. Command vs Meta normalization).',
	},
	's9-2': {
		title: 'Unified system toasts',
		description: 'Consistent toast styling for clearer errors and info.',
	},
	's9-3': {
		title: 'LLM settings in app',
		description:
			'New Settings → LLM page: save API Key, Base URL, and model name on the server. When enabled, chat, knowledge assistant, Q&A, and English learning share one config; Restore environment variables reverts to server defaults.',
	},
	's9-4': {
		title: 'LLM settings page UX',
		description:
			'Base URL and model name accept direct typing or presets (SiliconFlow / DeepSeek) via the button beside the field; choosing one preset pairs the other field. The footer active hint shows the current model name. A local default API Key may pre-fill on first visit; after save, the server copy applies.',
	},
	's10-1': {
		title: 'Image component improvements',
		description:
			'Better behavior for desktop config and asset refresh, fewer anomalies and duplicate loads.',
	},
	's10-2': {
		title: 'Desktop input: dropdown trigger merged with primary',
		description:
			'Shared ChatEntry on Tauri merges the input-mode dropdown trigger with the primary focusable control so Radix owns expand state; hover menu vs click send/voice behavior unchanged.',
	},
	's10-3': {
		title: 'sendDisabled maintainability',
		description:
			'sendDisabled derived via useMemo and explicit branches with ?? false for optional booleans—same behavior, clearer code.',
	},
	's11-1': {
		title: 'No second full-audio transcription after stop',
		description:
			'During recording, incremental audio is transcribed in real time into the input; on stop, only recording teardown runs—no extra full upload for a second pass—faster stop and fewer requests; final text is what live dictation already wrote.',
	},
	's11-2': {
		title: 'Input mode menu',
		description:
			'Input mode switches via dropdown items; selection styling and icon color highlight the active mode, same trigger region as send/voice.',
	},
	's12-1': {
		title: 'Chinese & English UI',
		description:
			'Settings toggle UI language (中文 / English); main pages and shared components (chat input, knowledge assistant, etc.) follow; assistant input-mode menu matches global language.',
	},
	's13-1': {
		title: 'Document assistant & RAG',
		description:
			'Bottom assistant supports Q&A and RAG with retrieval citations and multi-turn context; ties to Section 6 assistant features.',
	},
	's13-2': {
		title: 'Multi-session & persistence',
		description:
			'Multiple assistant threads per document with history switching; clear boundaries for temp vs persisted sessions to avoid wrong binding or broken streams when switching docs or saving (complements Section 6 streaming-across-docs).',
	},
	's13-3': {
		title: 'Unified assistant & RAG model backend',
		description:
			'Knowledge doc assistant (AI mode) and RAG Q&A now use the same SiliconFlow-compatible backend. Multi-turn history, stop generation, citation display, and ephemeral drafts are unchanged.',
	},
	's14-1': {
		title: 'Sharing & public reading',
		description:
			'Share pages offer read-only threads; message order, user-side code layout, knowledge preview, and toolbars align with online chat.',
	},
	's14-3': {
		title: 'Share page shows user attachments',
		description:
			'Shared conversation links now include attachment cards on user messages (preview and download), matching the live chat view. Cloud-stored files are shown via the same-site proxy.',
	},
	's14-4': {
		title: 'Knowledge article share: updated time display',
		description:
			'Fixed shared knowledge articles showing “Updated” about 8 hours off from when you saved (e.g. early morning saved as evening). Matches the cloud knowledge library list.',
	},
	's14-2': {
		title: 'Chatbot capability areas',
		description:
			'Session lifecycle, SSE streaming, web search, attachments/OCR, async persistence are split front/back; see commits and release notes for history.',
	},
	's15-1': {
		title: 'Preview & navigation',
		description:
			'Markdown preview supports TOC and heading hash jumps for long documents.',
	},
	's15-2': {
		title: 'Editor interactions',
		description:
			'Context menu and bottom bar integrate with the knowledge workflow; Diff eligibility, snapshots, and sticky scroll match Section 7.',
	},
	's15-3': {
		title: 'Fenced code blocks',
		description:
			'Format fenced blocks (incl. Prettier), TSX highlight paths; cut with no selection maps to whole-line behavior consistent with desktop shortcut policy.',
	},
	's15-4': {
		title: 'Split scroll & IME',
		description:
			'Editor/preview follow-scroll keeps evolving; CJK IME ghosting has targeted mitigations.',
	},
	's15-5': {
		title: 'Mermaid & chat code blocks',
		description:
			'Mermaid fences get a sticky toolbar (zoom, etc.); chat code blocks get floating toolbars aligned with React concurrent external-store patterns.',
	},
	's16-1': {
		title: 'Global shortcuts & selection',
		description:
			'Global shortcut handling decoupled from Monaco selection to reduce select-all/copy vs focus conflicts.',
	},
	's16-2': {
		title: 'Tauri editor layout',
		description:
			'Explicit layout for editor containers in desktop WebView to reduce measurement jitter.',
	},
	's16-3': {
		title: 'OS shortcut conflicts & toasts',
		description:
			'When keys conflict with the OS or browser, toasts explain failures so shortcut recording stays understandable.',
	},
	's17-1': {
		title: 'Service deployment',
		description:
			'Backend supports common deployment shapes and env configuration; Nginx reverse proxy and TLS are illustrated in repo ops docs.',
	},
	's18-1': {
		title: 'Shared tools package',
		description:
			'Shared Markdown parsing, build scripts, etc. for frontend and doc pipelines.',
	},
	's18-2': {
		title: 'Line-oriented fenced parsing',
		description:
			'Fenced blocks support line-oriented parsing for easier highlighting pipeline extensions.',
	},
	's19-1': {
		title: 'Post-release external sync',
		description:
			'Release pipelines can sync Wiki or the public update page—complements Section 1—with a skip switch for local-only validation.',
	},
	's19-2': {
		title: 'Feature index',
		description:
			'In-repo index mapping feature areas to docs; update it when adding or moving topics so readers do not get lost.',
	},
	's20-1': {
		title: 'About links open in the browser',
		description:
			'Service policy and user agreement links in About open at site root + fixed paths in the system browser or a new tab instead of nested child windows—better for long reads and copying URLs.',
	},
	's20-2': {
		title: 'Standalone full-screen routes',
		description:
			'Policies live at /service-policy and /user-agreement without the main app Layout—same full-page scroll feel as public share pages.',
	},
	's20-3': {
		title: 'Public access & copy',
		description:
			'Those paths are on the logged-out allowlist; body copy is zh/en and follows UI language; implementation lives under standalone legal views for easy swap to formal legal text later.',
	},
	's20-4': {
		title: 'Legal pages: header language toggle',
		description:
			'/service-policy and /user-agreement headers include the same language toggle as /project-guide: navigate with ?lang= to switch zh/en immediately, wired to standalone-page locale-from-URL behavior—no need to change global settings first.',
	},
	's21-1': {
		title: '/update-info standalone route',
		description:
			'Full-screen public route like share pages: header plus scrollable body with sectioned layout (not a Markdown preview renderer).',
	},
	's21-2': {
		title: 'Relationship to this write-up',
		description:
			'The live page is driven by structured frontend data (updateInfoSections), not by rendering this prose directly—keep code and copy in sync when editing.',
	},
	's21-3': {
		title: 'About entry point',
		description:
			'From About, “Release notes” opens the absolute URL in the browser as above.',
	},
	's22-1': {
		title: '/project-guide full-screen route',
		description:
			'Standalone product guide without main chrome; header includes language toggle (?lang=). Content aligns with the companion product-guide prose and is driven by projectGuideSections (+ English overlay).',
	},
	's22-2': {
		title: 'Home “Learn more” opens externally',
		description:
			'The hero “Learn more” button opens the guide in the system browser (desktop) or a new tab (web), passing the current UI lang as a query parameter.',
	},
	's22-3': {
		title: 'Maintenance note',
		description:
			'When the external-facing guide copy changes, update the structured product-guide modules and route constants before shipping the frontend bundle.',
	},
	's23-1': {
		title: 'Quick-start steps vs top-bar CTA',
		description:
			'On the home “Quick start” list, specific steps (e.g. register) are fully clickable for that flow; the main top-bar quick-start still opens chat (/chat) so one button does not mix two product intents. A “get started” style step matches the top bar and opens the main chat view.',
	},
	's23-2': {
		title: 'Login URL stays in sync with register mode',
		description:
			'The login page can open directly in register mode via the mode=register query string; switching between login and register updates the address bar with replace history to avoid stacking duplicate /login entries—refresh and shared links land on the right view.',
	},
	's24-1': {
		title: 'Topic-driven packs & streaming',
		description:
			'Signed-in users generate vocabulary packs and classic quotes from a topic in the English-learning area; generation streams over SSE with cancel, multi-turn agent chat, and clear error feedback.',
	},
	's24-2': {
		title: 'Quick-intent chips',
		description:
			'Toolbar chips attach a prefix to outgoing content; click again to clear selection; copy follows Section 12 UI language.',
	},
	's24-3': {
		title: 'Left rail form persists across routes',
		description:
			'Leaving the English-learning route and returning restores topic/count inputs and intent mirror text so you do not retype; works with the singleton pack/stream store.',
	},
	's24-4': {
		title: 'Favorites & drawers',
		description:
			'Vocabulary and quotes can be favorited, browsed paged inside drawers; list and sidebar UX includes refinements such as collapse memory where implemented.',
	},
	's24-5': {
		title: 'Export favorites to Word (DOCX)',
		description:
			'One-click DOCX export for vocabulary or quote favorites; the server aggregates up to about 3000 rows per user (newest favorites first, decoupled from UI pagination) with binary download on both browser and Tauri.',
	},
	's24-6': {
		title: 'Master retrieval: on-demand web search & RAG',
		description:
			'The master agent summarizes pack content; web search fires only when the model decides it is needed, with unified parsing of dates/recency in topics to cut routine noise; can combine with knowledge-base RAG tools so citations feel like the main chat product.',
	},
	's24-7': {
		title: 'JSON import & persisted libraries',
		description:
			'Standalone /english-learning/import (kind=vocab|classic): drag JSON, preview/validate, title, save; libraries use main+item tables with pagination; large packs via multipart upload; left rail groups import/library entry; after save navigate to the library with the new pack selected.',
	},
	's24-8': {
		title: 'Library paging, delete & session cache',
		description:
			'Right-pane entry lists paginate; delete a word library with confirm and cascade; switching libraries and returning restores loaded pages and scroll in-session (cleared on full refresh).',
	},
	's24-9': {
		title: 'Pull history delete & results UX',
		description:
			'History drawer deletes finished runs with cascade cleanup; opening history only navigates to results without refilling the left form; in-progress rows marked and usually not deletable; topic/web summary moved to page header; Agent save may jump to Knowledge.',
	},
	's24-10': {
		title: 'English-learning Agent multi-session',
		description:
			'Per-session messages and SSE; paginated history drawer and URL alignment; new chat without pre-creating empty sessions; intentPrefix not stored; placeholder IDs replaced via SSE with real DB ids.',
	},
	's24-11': {
		title: 'Batch unfavorite & collapsed quick intents',
		description:
			'Favorites drawer: multi-select, batch/single unfavorite with confirm; left rail shows two quick-intent chips by default, expandable to all.',
	},
	's24-12': {
		title: 'Vocabulary part-of-speech (pos)',
		description:
			'Streaming pull, lists, favorites, and DOCX export carry abbreviated English pos; legacy rows without pos treated as empty.',
	},
	's24-13': {
		title: 'List retries & friendlier errors',
		description:
			'Tauri GET retries by default; library/favorites/pack lists batch favorite-status with retries; list failure toasts use i18n copy; debounced status queries and progressive star highlights.',
	},
	's24-14': {
		title: 'Stream stop & silent cancel',
		description:
			'Stopping pack SSE aborts locally and may notify the server; cancel calls are silent so user-initiated stop does not show an error toast.',
	},
	's24-15': {
		title: 'Collapsible word/quote grids',
		description:
			'Pulled entry grids collapse/expand; new pulls auto-expand; a11y labels follow UI language.',
	},
	's24-16': {
		title: 'Dictation & spelling practice (summary)',
		description:
			'Start practice from favorites, library, or pack results; the report shows accuracy and stats, lists both wrong and correct words this round (green/red left border), with retry-mistakes, continue, and re-setup; back is an icon in the report header.',
	},
	's24-17': {
		title: 'Practice entry & return navigation',
		description:
			'Headphones icon on library list cards and vocab history drawer (tooltip: dictation/spelling); setup shows pool word count; back from home history returns to English learning home; practicing another history row from stream page keeps the current selection.',
	},
	's24-18': {
		title: 'Vocabulary mistake book',
		description:
			'Save wrong words from the practice report; open the mistake book from the English learning sidebar or /english-learning/mistakes to review, remove, and start dictation/spelling again; a shortcut on the report opens the mistake book.',
	},
	's24-19': {
		title: 'Unified practice entry',
		description:
			'Consistent dictation/spelling entry across favorites, library (including the word list header), pack results, and history drawer; the library word list header now practices the current library.',
	},
	's24-20': {
		title: 'In-session practice hints',
		description:
			'While answering dictation or spelling items, use Hint in the card header for clues (dictation: Chinese meaning and IPA; spelling: IPA under the prompt). The English word is not shown; the button is disabled when no clues exist; hints close when you move to the next item.',
	},
	's24-21': {
		title: 'Classic quote dictation & spelling',
		description:
			'Start practice from classic favorites, the quotes library, pack results, or the classic history drawer. Shares setup and summary with vocabulary practice. Hints may show Chinese meaning, source, or notes—never the English sentence before reveal.',
	},
	's24-22': {
		title: 'Classic quote mistake book',
		description:
			'Save wrong sentences to the shared mistake book page with tabs and footer actions. Re-saving updates last wrong spelling when it differs.',
	},
	's24-23': {
		title: 'Practice setup pool units',
		description:
			'On the dictation/spelling setup screen, the pool size shows “N words” or “N sentences” depending on vocabulary vs classic quote practice.',
	},
	's24-24': {
		title: 'Relaxed classic quote grading',
		description:
			'Classic dictation/spelling ignores case and punctuation; vocabulary practice also ignores trailing punctuation, reducing false negatives.',
	},
	's24-25': {
		title: 'Mistake book spelling refresh',
		description:
			'When saving to the mistake book again, if the wrong spelling differs from what was stored, only “last wrong input” is updated; word/sentence snapshots are unchanged.',
	},
	's24-26': {
		title: 'Two-tier wrong answer & playback',
		description:
			'First wrong: hints + playback, no English answer; full reveal after Show answer or 2nd wrong. Try again/Next; arrow keys ←→↑↓; dictation triple-play; retry restarts triple-play immediately; stable soft-reveal layout.',
	},
	's24-27': {
		title: 'Wrong-answer panel & shortcut help',
		description:
			'After first wrong or reveal: field-style hints; footer play, guidance, circular Show answer matching play button. Header shows word vs sentence mode. ? icon lists shortcuts by phase. Dictation triple-play only on initial main play when hint is closed; other play and ← are single; ← works while answering and after reveal.',
	},
	's24-28': {
		title: 'Playback continues after Show answer',
		description:
			'If audio is playing on the first-wrong screen, tapping Show answer or → to open the full reveal does not stop it—the same utterance keeps playing; both screens share play state until you stop or it finishes.',
	},
	's24-29': {
		title: 'Wrong-screen shortcuts & Previous question',
		description:
			'Play/stop is Shift + Space. On wrong screens: ↑ previous question, ← try again, → show answer, ↓ next. Footer Previous button when not on the first item. See ? menu for the full list.',
	},
	's24-30': {
		title: "Today's review (spaced repetition)",
		description:
			"The English learning home sidebar shows Today's review with due counts for vocabulary and sentences. New mistakes or changed misspellings enter the schedule; correct answers remove items from today's queue. Opens the practice setup page to choose mode and count; the due count refreshes after you finish.",
	},
	's24-31': {
		title: 'Random practice fills short pages',
		description:
			'When random order hits a page with fewer items than your chosen count, the app fetches more pages until the session is full or the pool is exhausted.',
	},
};
