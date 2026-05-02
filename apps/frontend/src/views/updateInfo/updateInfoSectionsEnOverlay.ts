/**
 * 更新信息独立页的英文正文（与 updateInfoSections.ts 中章节/条目 id 一一对应）。
 * 维护中文主数据时，请同步补齐此处映射。
 */

export const UPDATE_INFO_INTRO_EN =
	'This page summarizes core capabilities and recent improvements so you can quickly see what is new or better. The content is product-level and focuses on user-visible behavior.';

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
	s18: '18. @dnhyxc-ai/tools & fenced-block parsing',
	s19: '19. Metadata & documentation conventions',
	s20: '20. About dialog & standalone legal pages',
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
		title: 'Shared conversation message order fix',
		description:
			'Fixes incorrect message order on share pages for more consistent reading.',
	},
	's4-4': {
		title: 'Web search & citations',
		description:
			'Supports web retrieval with citation metadata for traceability.',
	},
	's4-5': {
		title: 'Attachments & OCR',
		description:
			'Attachment handling and OCR improve multimodal input usability.',
	},
	's4-6': {
		title: 'Async persistence & reliability',
		description:
			'Queues (e.g. BullMQ) improve message persistence reliability and scalability.',
	},
	's4-7': {
		title: 'Desktop chat input: voice & stop-recording policy',
		description:
			'On the Tauri client, the bottom input supports text/voice modes, live dictation, and stop-recording cleanup; after stop, no second full-audio transcription pass is sent—see Section 11 for details.',
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
	's14-1': {
		title: 'Sharing & public reading',
		description:
			'Share pages offer read-only threads; message order, user-side code layout, knowledge preview, and toolbars align with online chat.',
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
};
