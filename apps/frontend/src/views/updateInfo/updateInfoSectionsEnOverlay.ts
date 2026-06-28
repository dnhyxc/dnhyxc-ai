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
	s25: '25. E-books (bookshelf & reader)',
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
	's2-5': {
		title: 'Stripe membership billing (three plans)',
		description:
			'After sign-in, open /pay to choose Monthly (¥9.9), Quarterly (¥25.9), or Annual (¥99.9)—fixed prices, not editable—via Stripe embedded checkout. Successful payment activates or extends membership (stacked from the current expiry) and redirects to /profile for badge and validity. When membership expires, profile/login reflects non-member state with upgrade guidance.',
	},
	's2-6': {
		title: 'Clear local cache on account switch',
		description:
			'When you sign out, sign in with another account, or the session ends with 401 in the same browser tab, client-side display cache for the previous account is cleared—including unsaved knowledge drafts, document assistant and RAG chats, English learning Agent threads, in-progress vocabulary/classic streams, the ebook bookshelf list, and MOKE reader assistant state—so you do not see another user’s content. Updating profile or membership for the same user id does not trigger a reset.',
	},
	's2-7': {
		title: 'Profile membership badge styling',
		description:
			'On /profile, active members see a high-contrast gold “Member” badge and gold “Valid until …” line for easier reading on dark backgrounds. Membership detection is unified on the client and stays aligned with LLM default presets for members vs non-members.',
	},
	's2-8': {
		title: 'Membership grant idempotency fix',
		description:
			'Fixes duplicate membership duration when Stripe webhook and checkout completion ran concurrently (e.g. monthly plan showing about one extra month). New payments no longer stack twice; contact support if a past account was over-credited.',
	},
	's2-9': {
		title: 'Fix sign-in immediately logging you out',
		description:
			'After cloud TTS preferences were synced to your account, some users were sent back to the login page right after a successful sign-in while background sync ran without credentials. Login order and member-only prefetch are adjusted so the session stays active in production.',
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
			'Main Chat now uses the SiliconFlow OpenAI-compatible API by default (GLM-5.1 family). Streaming, stop, continue, and branching behave the same on your side.',
	},
	's4-10': {
		title: 'Chat attachment image preview fix',
		description:
			'Fixes failed image preview after upload on web and desktop (Chinese filenames, cross-port blocking, misconfigured gateways). On production web, attachments load via the same site API route instead of a separate static image path; message payloads use on-disk filenames for OCR. Deploy both frontend and backend and restart; legacy direct /images/ URLs may still need gateway fixes.',
	},
	's4-11': {
		title: 'Image attachment text recognition',
		description:
			'Before you send a message with image attachments, the server uses a Zhipu vision model to extract on-screen text and scene description, then passes that to the chat model. This step is independent of the chat model you pick in Settings. Self-hosted deployments must configure a Zhipu API credential on the server; otherwise image attachments may not be understood correctly.',
	},
	's4-12': {
		title: 'Long chats and attachment parsing stability',
		description:
			'Fixes server memory growth and crashes with multi-turn chats that include PDF/Excel attachments, and fixes broken Stop or mid-reply cutoffs when sending two messages in quick succession. Parsed attachment text is cached per path with size limits; very long sessions only send recent turns to the model.',
	},
	's4-13': {
		title: 'Horizontal scroll for code blocks during streaming',
		description:
			'Fixes fenced code blocks in assistant messages that could not be scrolled sideways reliably while the reply was still streaming—including after the closing fence when the model kept writing prose below. Copy, download, and the code toolbar behave as before.',
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
	's6-16': {
		title: 'Knowledge vector indexing reliability',
		description:
			'Fixes cloud vectorization failures on save (e.g. HTTP 404 or invalid parameters) that blocked RAG retrieval; long articles and the default non-member embedding model now use shorter chunks per tier to reduce indexing errors.',
	},
	's6-17': {
		title: 'Knowledge RAG multi-collection search',
		description:
			'With custom vector settings enabled, Knowledge RAG searches all vector collections you have saved in parallel and always includes the system default bge collection, so older articles remain findable after you switch models; new saves still go to the currently selected collection.',
	},
	's6-18': {
		title: 'Site-wide BGE-only mode & indexing stability',
		description:
			'Super admins can enable “BGE vector collection only” on the LLM settings page; when on, all users index and retrieve via the system BGE collection and models. Fixes vectorization failures on long articles (including emoji) under site-wide BGE and oversized single upserts from small BGE chunks.',
	},
	's6-19': {
		title: 'Member default vector collection in RAG',
		description:
			'Active members who saved custom vector settings also get the member default Qwen3 vector collection merged into parallel RAG search, alongside their collections and the system bge collection, reducing missed hits in older data.',
	},
	's6-20': {
		title: 'Knowledge vector chunk boundary fix',
		description:
			'Fixes mid-word truncation when vectorizing long articles and code samples (e.g. console.log split into ole.log). Code blocks are split by line first, including closing ``` on the same line. Re-save existing articles to refresh stored chunks used in retrieval.',
	},
	's6-21': {
		title: 'Auto-focus assistant input after sending selection',
		description:
			'After copying selected Markdown text to the document assistant (context menu or ⌘/Ctrl+Shift+V), the assistant input is focused with the caret at the end of the inserted text so you can continue typing follow-up questions.',
	},
	's6-22': {
		title: 'CJK input fix after assistant auto-focus',
		description:
			'Fixes duplicated pinyin/Latin characters when typing in Chinese IME after auto-focus following copy-to-assistant; EPUB MOKE ask-about-selection prefills benefit as well.',
	},
	's6-23': {
		title: 'Knowledge save / vector indexing stability',
		description:
			'Fixes vector indexing failures (e.g. Invalid array length) or server crashes on some short or list-style Markdown saves. Chunking now always advances each iteration and caps pieces per article. Re-save affected articles if indexing failed before.',
	},
	's6-24': {
		title: 'Cloud save for long knowledge articles',
		description:
			'Fixes cloud knowledge saves failing when article body exceeded about 100KB. Saves now align with the per-article limit (about 5MB); long Markdown articles persist normally.',
	},
	's6-25': {
		title: 'Assistant keeps scroll position after streaming ends',
		description:
			'Fixes Knowledge doc assistant, ebook MOKE assistant, and English-learning Agent jumping to the bottom after streaming when you had scrolled up to read history. Scroll back to the bottom or tap “Scroll to bottom” to resume following new output.',
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
	's7-8': {
		title: 'Preview/edit & document assistant panel',
		description:
			'Full-width preview without an empty right pane; with the assistant open, preview stays on the left in preview mode and the editor in edit mode; toggling preview/edit keeps the panel open and preserves scroll position where possible.',
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
	's9-5': {
		title: 'Per-account LLM settings and member defaults',
		description:
			'LLM API Key, Base URL, and model name in Settings are stored per signed-in account, not shared site-wide. Without custom config, active members default to SiliconFlow models and non-members to Zhipu GLM; presets include Zhipu GLM. Switching Base URL or model clears the API Key to avoid using the wrong provider key.',
	},
	's9-6': {
		title: 'LLM settings: save to enable',
		description:
			'Settings → LLM no longer has a separate “use custom LLM” switch. Fill API Key, Base URL, and model name, then Save to enable custom config; the footer shows the active model in green or the default model in gray. Restore default turns off custom config and reverts to member-based defaults. Unsaved edits or incomplete fields show hints and keep Save disabled.',
	},
	's9-7': {
		title: 'Vector model settings',
		description:
			'The LLM settings page adds a Vector model block below chat LLM: API Key, Embedding / Rerank endpoint URLs, embedding and rerank model names, and collection name—saved and restored separately from chat LLM. Each save records collections you have used; the page lists collections included in RAG search, which always also queries the system default bge collection.',
	},
	's9-8': {
		title: 'Vector settings save & form UX',
		description:
			'Fixes non–super-admin users being blocked when saving vector settings; endpoint labels now read “Vector model URL” and “Rerank model URL”; LLM and vector form rows use more consistent label width and alignment.',
	},
	's9-9': {
		title: 'LLM & vector Key echo and presets',
		description:
			'API Keys are no longer auto-filled from local build-time env; they echo only after you saved them in Settings and the API returns them. Switching chat or vector presets or linked vector model / rerank / collection fields no longer clears keys already entered; BGE and Qwen3 preset tiers keep the three vector fields paired.',
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
	's13-4': {
		title: 'Multi-collection RAG with custom vectors',
		description:
			'When custom vector settings are enabled, RAG searches saved collections in parallel and always queries the system default bge collection; active members also get the member default Qwen3 collection merged in; ties to Section 9 vector settings and Section 6 vector indexing.',
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
	's24-32': {
		title: 'Cloud playback prefers MiniMax streaming TTS',
		description:
			'When MiniMax is enabled on the server, cloud playback for sentences and longer text starts faster with more natural English. If MiniMax is unavailable, billing fails, or upstream errors occur, playback falls back to the previous cloud TTS; repeated plays of the same line still use cache.',
	},
	's24-33': {
		title: 'Settings: Cloud playback',
		description:
			'Separate from LLM settings. Toggle custom playback parameters (model, English voices, speed/volume/pitch, emotion, audio format, language boost, and advanced sample-rate options). Changes save to your account (sync across devices); preview and restore-default supported; when off, server defaults apply.',
	},
	's24-34': {
		title: 'Cloud playback prefs sync by account',
		description:
			'Custom cloud playback parameters moved from browser-only storage to your account in the cloud. The same account sees the same settings on different computers or browsers. Local Web Speech voice on the Voice settings page stays on each device only.',
	},
	's24-35': {
		title: 'Unified voice settings page',
		description:
			'Settings tab Voice settings is visible to everyone. The top section is local voice settings; active members also get cloud voice settings below. The local voice block was removed from System settings.',
	},
	's24-36': {
		title: 'Local playback voice per account',
		description:
			'Local English Web Speech voice on the Voice settings page is stored separately per signed-in account in the same browser. After switching accounts, the dropdown and playback use that account’s preference without overwriting others (device-only, not synced across devices).',
	},
	's24-37': {
		title: 'English playback routed by membership',
		description:
			'Speaker playback across English learning—words, sentences, dictation/spelling practice, daily review, etc.: active members default to cloud synthesis (falls back to local Web Speech when cloud is unavailable); non-members default to browser local voice. Aligns with local/cloud settings under Voice settings.',
	},
	's24-38': {
		title: 'Members can choose local or cloud playback',
		description:
			'Active members can use mutually exclusive switches “Use local voice for playback” and “Use cloud voice for playback” under Voice settings to choose the default medium for English learning speaker buttons; preference is saved per account and syncs across devices. Non-members remain local-only.',
	},
	's24-39': {
		title: 'Daily memorize quiz distractors and footer buttons',
		description:
			'After recognition in Daily memorize, multiple-choice distractors favor similar part of speech and definition length, with less repetition of the same wrong option within one round. The Start memorizing footer spacing aligns with dictation/spelling setup; Test me and related primary buttons no longer sit inside an extra dark bordered gap.',
	},
	's24-40': {
		title: 'Library edit and public libraries',
		description:
			'Hover a library card to edit (owners on private libraries; super admins on public ones). Owners can rename a library (character count shown, up to 50); press Enter in the dialog to save when there are changes. Super administrators can mark a library as public so all signed-in users can browse and practice; others cannot delete a public library they do not own. A Public badge appears on published libraries for all users. New imports stay private until manually published.',
	},
	's24-41': {
		title: 'English learning home sidebar visual unify',
		description:
			'Left sidebar blocks (daily memorize, quick intents, vocab/quotes libraries, topic pulls, favorites, today review, mistake books, etc.) now share one card and button spec aligned with the Agent and knowledge sidebars—subtle borders and light fills—while keeping each block’s icon and button colors. JSON import examples in library cards are collapsed by default; tap the label to expand or collapse. Quick-intent chips stay two columns in a narrow sidebar and add columns when the panel is wider.',
	},
	's24-42': {
		title: 'Cloud Chinese voices',
		description:
			'Active members: in Settings → Voice settings → Cloud voice, set Language boost to Chinese to pick from 64 Chinese system voices (Mandarin and Cantonese); English boost shows English voices only. When you change language boost, an incompatible voice resets to that language’s default.',
	},
	's24-43': {
		title: 'Faster cloud TTS for long passages',
		description:
			'With cloud voice enabled, longer text (e.g. e-book quote excerpts, long classic sentences) is synthesized in sentence-sized segments—the first segment starts playing as soon as it is ready, and the next segment is prefetched while the current one plays. Short words and phrases still use a single request. Same behavior for Listen on EPUB quotes and English learning play buttons.',
	},
	's24-44': {
		title: 'iFlytek cloud narration',
		description:
			'Active members can choose iFlytek cloud as the playback source in Voice settings (mutually exclusive with local and MiniMax cloud)—suited for Chinese listen-to-book. Configure voice, speed, volume, and pitch with preview; if the server is not configured or synthesis fails, playback falls back to other cloud or local voice.',
	},
	's25-1': {
		title: 'E-book bookshelf',
		description:
			'New Bookshelf entry in the sidebar (/ebook). Signed-in users can manage EPUB/PDF: cards show title, format, and progress; open to read or remove with confirmation.',
	},
	's25-2': {
		title: 'Desktop vs browser import',
		description:
			'Desktop (Tauri): Select local file to pick epub/pdf; the app registers the path and reads from disk (file is not copied to the server). Browser: Import file uploads to your account shelf. About 120MB per file.',
	},
	's25-3': {
		title: 'EPUB/PDF reading and progress',
		description:
			'Reader supports page turns and percent progress; EPUB has a table of contents; reading position (EPUB locator / PDF page) syncs when signed in and restores on reopen.',
	},
	's25-4': {
		title: 'Reader UX',
		description:
			'Reader header: back, title, page turns and (EPUB) TOC. Keyboard ↑/← previous page, ↓/→ next page (ignored when TOC is open or an input is focused). Main header breadcrumb shows Bookshelf > Reading instead of the default app title.',
	},
	's25-5': {
		title: 'Bookshelf and reader polish',
		description:
			'Vertical shelf cards with a four-edge progress ring and EPUB/PDF color accents; open/import adds to the shelf without auto-opening the reader—tap Read or Continue on the card. PDF reader header matches EPUB: page turns, page numbers, and TOC from embedded bookmarks (empty state when none). Fixed render errors when jumping via TOC quickly. EPUB text color follows the app theme (light on black theme, dark on others); smoother page turns and progress saving.',
	},
	's25-6': {
		title: 'EPUB reader settings and continuous scroll',
		description:
			'EPUB reader header adds Reading settings next to TOC: font size, line spacing, text color, reading background, and paginated vs continuous scroll; preferences are stored locally. In continuous scroll, reaching the bottom or top of a chapter automatically moves to the next or previous chapter without repeated page-turn clicks.',
	},
	's25-7': {
		title: 'Desktop cloud backup and local-first reading',
		description:
			'On desktop, opening a local file adds the book to the shelf immediately so you can read right away, while a cloud backup runs in the background (progress bar for large files). Reading prefers the local file; browser import or unavailable local files fall back to cloud. Progress stays tied to one book. Local open up to about 512MB; cloud upload about 120MB per file.',
	},
	's25-8': {
		title: 'Shelf scroll loading and reader settings polish',
		description:
			'Bookshelf loads more as you scroll; the header shows total book count. EPUB reading settings offer 12 background and 12 text colors (swatch picker); continuous scroll is the default page flow with a segmented toggle; the settings panel uses the app ScrollArea scrollbar style.',
	},
	's25-9': {
		title: 'PDF reader scrollbar styling',
		description:
			'When scrolling long PDF pages in the reader, the scrollbar uses a thin, theme-colored style consistent with EPUB continuous scroll.',
	},
	's25-10': {
		title: 'PDF fit width and scroll page turns',
		description:
			'PDFs default to fit the reader width. Header zoom out/in and percentage (100% = fit width); preference is stored locally. On long pages, scroll to the top or bottom, pause, then scroll again to go to the previous or next page—fast flick scrolling will not skip multiple pages. Header and keyboard page turns still work.',
	},
	's25-11': {
		title: 'Shelf cover and title editing',
		description:
			'Shelf cards support custom covers (JPG/PNG/WebP via the bottom-left control on hover) and inline title editing (tap the title below the card, Enter to save) with success toasts. With a cover, the card shows the image; without, EPUB/PDF color placeholders remain. Hover the card for Read/Continue, progress, or Remove. Desktop import button label is now Select local file.',
	},
	's25-12': {
		title: 'EPUB context menu and MOKE reading assistant',
		description:
			'While reading EPUB, right-click in the body: Reading assistant, page turns, TOC, and settings when nothing is selected; Copy, MOKE ask-about-selection, and Select all when text is selected. Open the right split pane via the header Bot icon or the menu (same layout as the knowledge-base assistant, draggable width, ~50% default). Multi-turn chat and streaming replies. Sign-in required.',
	},
	's25-13': {
		title: 'MOKE assistant on PDF',
		description:
			'PDF reading adds the header Bot control and Right-click → Reading assistant for the same right split pane. No ask-about-selection yet because PDF text cannot be selected. One independent conversation session per book, separate from the knowledge-base document assistant.',
	},
	's25-14': {
		title: 'PDF reading context menu',
		description:
			'Right-click in the PDF reader for Reading assistant, TOC, zoom in/out (menu stays open for repeated zoom), and previous/next page.',
	},
	's25-15': {
		title: 'MOKE assistant: save and share',
		description:
			'From ebook assistant AI replies: Save to knowledge base (opens the knowledge editor) or share the current Q&A pair as a read-only link.',
	},
	's25-16': {
		title: 'Long book titles in reader header',
		description:
			'Very long titles truncate with an ellipsis in the reader header so they do not cover page-turn or TOC controls.',
	},
	's25-17': {
		title: 'Cloud backup requires membership',
		description:
			'Browser import of epub/pdf requires an active membership. On desktop, non-members can still add a local path and read locally without cloud backup. Member uploads are stored in cloud object storage only.',
	},
	's25-18': {
		title: 'Same local path not re-uploaded',
		description:
			'On desktop, if a member selects a local file whose path is already on the shelf, an info message says the book is already there and no duplicate cloud upload starts.',
	},
	's25-19': {
		title: 'Bookshelf refreshes after account switch',
		description:
			'After sign-out, switching accounts, or session expiry, the previous account’s bookshelf cache is cleared and the current account’s list is loaded again.',
	},
	's25-20': {
		title: 'TOC highlights current chapter',
		description:
			'When you open the table of contents while reading EPUB or PDF, the entry for your current position is highlighted and scrolled into view (PDF uses bookmark entries).',
	},
	's25-21': {
		title: 'Bookshelf categories',
		description:
			'The app header shows Moke BookHouse > My Bookshelf (same breadcrumb style as Moke BookHouse > Reading). The shelf toolbar has Manage categories, category tabs (All / custom / Uncategorized, horizontally scrollable), and Import (hover for hints). Create, rename, delete, and reorder categories; move books via the folder icon to the right of the title under each card; deleting a category moves its books to Uncategorized. Imports default to the selected category (last choice remembered). Categories refresh when you switch accounts.',
	},
	's25-22': {
		title: 'Large-file cloud backup stability',
		description:
			'For members uploading or downloading ~100MB epub/pdf files, the server uses streaming I/O instead of loading whole files into memory, reducing upload failures and process crashes. Reading and download behavior is unchanged.',
	},
	's25-23': {
		title: 'EPUB reading notes',
		description:
			'While reading EPUB, select text and choose Write note from the context menu. Saved passages show a subtle amber dashed underline; tap to view, edit, or delete. Multiple notes per passage (newest first, with username). Tapping the underline opens the list first (even for a single note). Nested overlapping selections show one visible underline; drag-select release does not open the list. Sign-in required; notes are stored on your account and removed when you delete the book. EPUB only; PDF is not supported yet.',
	},
	's25-24': {
		title: 'EPUB reading notes UI refresh',
		description:
			'Note list, details, and compose move to the right reading column (mutually exclusive with MK ask-about-selection; same resizable slot). Header shows title and note count; quote cards offer copy, write note, and MK ask shortcuts; a floating toolbar complements the context menu. Enter saves, Shift/Ctrl/Cmd+Enter inserts new lines with the input fixed at the panel footer. Fixes wrong list after writing on a different passage and occasional crashes after save.',
	},
	's25-25': {
		title: 'EPUB selection floating toolbar visuals',
		description:
			'The floating toolbar above selected text uses a frosted panel and theme-aware downward shadow so edges stay clear on dark reading backgrounds and colored themes; the caret matches the panel with consistent rounded corners. After copy, a brief “Copied” state shows before the selection clears.',
	},
	's25-26': {
		title: 'EPUB user highlights',
		description:
			'While reading EPUB, select text and use Highlight on the floating toolbar—background fill, straight underline, or wavy underline in five colors. Tap an existing mark to change style or remove it. Adjacent or overlapping highlights merge into one; the latest style wins. Sign-in required; highlights sync to your account and are removed when you delete the book. Can coexist with reading-note underlines. EPUB only; PDF not supported yet.',
	},
	's25-27': {
		title: 'EPUB highlight matching improvements',
		description:
			'Highlights are matched by position in the text—duplicate sentences in the same chapter no longer delete or merge each other by mistake. The toolbar shows Remove highlight when the whole selection is already highlighted, and Highlight when the selection is mixed or not highlighted yet.',
	},
	's25-28': {
		title: 'EPUB selection toolbar UX improvements',
		description:
			'Highlights, removals, and reading notes apply to the page more smoothly. The toolbar no longer flashes when switching between Highlight and Remove highlight, and the action row no longer shows empty placeholder gaps.',
	},
	's25-29': {
		title: 'EPUB reading-note partial overlap fix',
		description:
			'When you add a second reading note on text that partially overlaps an earlier note, the overlapping stretch no longer shows two stacked dashed underlines. Each selection can still be tapped to open its own note list.',
	},
	's25-30': {
		title: 'EPUB highlight and note sync performance',
		description:
			'After adding a user highlight or saving a reading note, marks appear on the page much sooner and scrolling stays responsive during sync—even when the book already has many marks.',
	},
	's25-31': {
		title: 'EPUB reading-note click aggregation',
		description:
			'Tapping a dashed reading-note underline opens a sidebar that intelligently aggregates related notes: nested selections (whole paragraph plus sub-phrases) default to the full excerpt with every note listed; adjacent phrases merge only when punctuation or line breaks between them also have notes—unannotated gaps stay separate. Multiple selection groups show section headers.',
	},
	's25-32': {
		title: 'EPUB reading-notes sidebar highlight coverage',
		description:
			'The Highlight / Remove highlight buttons in the reading-notes sidebar quote area match the selection toolbar: Remove highlight appears only when the entire displayed quote excerpt is already highlighted; if any part is not highlighted (e.g. only the second half), Highlight is shown and adds a highlight for the full excerpt.',
	},
	's25-33': {
		title: 'EPUB split-panel drag reading-area polish',
		description:
			'While dragging the MOKE assistant or reading-notes split width, the EPUB text reflows smoothly without white-screen flashes; user color highlights stay visible during the drag.',
	},
	's25-34': {
		title: 'EPUB reading-notes list interaction polish',
		description:
			'A single tap on a note in the list opens its details directly (no longer switches the quote excerpt). Group section headers support expand/collapse for long excerpts, aligned with the top quote card; the list quote area no longer jumps to the in-book PopBar on tap.',
	},
	's25-35': {
		title: 'EPUB reading background synced across the page',
		description:
			'After you change Reading background in settings, the header, reading-notes / MOKE assistant side panel, settings panel, and EPUB body share the same background. Follow app still matches Settings → theme colors.',
	},
	's25-36': {
		title: 'EPUB settings: tap the reader to close',
		description:
			'While the reading settings panel is open, tapping the left reading area (book body) closes the panel—you no longer need to tap the header settings button again.',
	},
	's25-37': {
		title: 'EPUB reading notes: no underline on blank lines',
		description:
			'When writing reading notes across multiple paragraphs, blank lines between paragraphs no longer show an amber dashed underline—only lines with actual text are marked.',
	},
	's25-38': {
		title: 'EPUB notes list: close panel after deleting last note',
		description:
			'When you open a note from the list and delete the last remaining note, the reading-notes side panel closes instead of staying open empty. If other notes remain, you return to the updated list. Note body alignment matches the list when entering details.',
	},
	's25-39': {
		title: 'EPUB quote share image',
		description:
			'While reading EPUB, tap Share quote on the selection toolbar or in the reading-notes quote area to generate a calendar-style quote card image. Copy the image to paste into WeChat and similar apps, or download a PNG; font sizes and weights are preserved when possible.',
	},
	's25-40': {
		title: 'EPUB MK ask & right side panel UX',
		description:
			'Header Bot, MK ask, and reading-notes side panel now share one right-column flow—opening MK from the notes list no longer flickers; closing MK fully collapses the panel when empty or returns to notes when applicable; closing the notes list restores full-width reading with no blank right column; user highlights no longer dismiss MK while it is open.',
	},
	's25-41': {
		title: 'EPUB context menu & selection toolbar',
		description:
			'Opening the context menu closes the selection toolbar immediately without flicker; right-click without a prior manual selection no longer auto-highlights a word—the menu shows the no-selection items; copy, MK ask, and write note still work after you drag-select first.',
	},
	's25-42': {
		title: 'EPUB reading-notes quote stays in view',
		description:
			'When you open or close the reading-notes side panel, the quoted passage in the left EPUB view stays on screen instead of scrolling away after the column resizes—easier to edit alongside the sidebar.',
	},
	's25-43': {
		title: 'EPUB split panel close layout fix',
		description:
			'After closing the reading-notes list or MK ask side panel, the left reading column returns to full width immediately—no sporadic blank right column and no multi-frame delay.',
	},
	's25-44': {
		title: 'EPUB quote “Listen”',
		description:
			'While reading EPUB, tap Listen on the selection toolbar or on the quote footer in the reading-notes list or details to hear the selected or quoted text; the button shows Stop while playing—tap again to stop. Chinese excerpts are more reliable with the browser’s built-in speech on desktop.',
	},
	's25-45': {
		title: 'EPUB split close & delete last note blank fix',
		description:
			'After closing the reading-notes list or MK ask side panel, deleting the last note from the list, or a dev hot reload, the left reading column returns to full width with no blank right column.',
	},
	's25-46': {
		title: 'EPUB thought dashes vs user underlines overlap fix',
		description:
			'Amber thought underlines show when you annotate a single sentence inside a paragraph. User straight underlines cover thought dashes only where they overlap; non-overlapping dashes remain. Background highlights and wavy underlines still coexist correctly with thought dashes.',
	},
	's25-47': {
		title: 'EPUB Listen sentence highlight while playing',
		description:
			'While Listen is reading aloud, the sentence being spoken shows a soft yellow background; it clears when that sentence finishes and moves to the next; stopping or finishing clears all playback highlights without affecting your highlights or thought underlines.',
	},
	's25-48': {
		title: 'EPUB Listen vs user highlight conflict fix',
		description:
			'After highlighting then Listen, or re-highlighting a wider selection, highlights no longer duplicate and cancel still works; when playback ends, highlights and thought underlines return to a consistent state.',
	},
	's25-49': {
		title: 'EPUB Listen cross-paragraph highlight fix',
		description:
			'When Listen spans line breaks or two paragraphs, the previous sentence yellow tint clears as soon as the next sentence starts—no more multiple sentences staying highlighted until playback finishes.',
	},
	's25-50': {
		title: 'EPUB Listen auto-scroll follow',
		description:
			'While Listen plays a long selection, the current sentence scrolls into view automatically. Manual scroll or wheel pauses follow; a bottom-right button returns to the playing passage and resumes auto-follow.',
	},
	's25-51': {
		title: 'EPUB listen while reading',
		description:
			'While reading EPUB, tap Listen to book in the header to hear continuous sentence-by-sentence TTS from your current position. A bottom bar offers pause/resume, prev/next sentence, and speed. Current sentence gets a light yellow tint and auto-scrolls into view; manual scroll pauses follow and a bottom-right button returns to the playing line. Mutually exclusive with quote Listen; TOC jumps resume from the new location. EPUB only.',
	},
	's25-52': {
		title: 'EPUB listen bar: sentences & speed',
		description:
			'The listen-while-reading bottom bar adds a Sentences button to open a per-chapter list and jump to any line (the list scrolls to the line currently playing). Speed is chosen from a popup grid from 0.75× to 3×; with cloud voice, changing speed takes effect on the current sentence immediately. Jumping from the list scrolls that sentence to the center of the screen for easier reading along.',
	},
	's25-53': {
		title: 'EPUB listen highlight follows panel resize',
		description:
			'While Listen or listen-while-reading is playing, opening or closing the reading-thoughts sidebar, dragging the MOKE/thoughts split, or narrowing the window keeps the light-yellow sentence highlight aligned with the reflowed text instead of drifting or disappearing. Independent of user highlights and thought underlines.',
	},
	's25-54': {
		title: 'EPUB quote Listen shares bottom bar',
		description:
			'While quote Listen is playing, the same bottom bar as listen-while-reading appears with pause/resume, stop, previous/next sentence, sentence list jump, and speed 0.75×–3×. PopBar and reading-notes quote entries are unchanged; mutually exclusive with listen-while-reading.',
	},
	's25-55': {
		title: 'EPUB listen sentence split for leading Chinese punctuation',
		description:
			'While listen-while-reading or quote Listen is playing, leading ellipsis, em dashes, and opening quotes are kept with the sentence they belong to—the sentence list and per-sentence highlight stay aligned with speech instead of splitting empty sentences or drifting off the read text.',
	},
	's25-56': {
		title: 'Smoother cloud listen between sentences',
		description:
			'When using cloud voice for listen-while-reading or quote Listen in continuous playback, the gap between sentences is shorter so the next line starts sooner after the previous one finishes. Local browser speech is unchanged.',
	},
	's25-57': {
		title: 'Local speech first sentence fix',
		description:
			'When using local browser speech for listen-while-reading, quote Listen, or English learning playback, the first sentence no longer occasionally stays silent. MiniMax or iFlytek cloud voice is unchanged.',
	},
};
