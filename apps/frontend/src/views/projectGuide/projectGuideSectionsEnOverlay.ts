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
	'pg-s13': '13. Going deeper',
	'pg-s14': '14. About window and legal pages',
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
			'Good for quick access. Features are limited to what the web platform allows; some actions show “desktop only.”',
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
	'pg-s4-1': {
		title: '4.1 Basic prompts',
		description:
			'Structure prompts with context, goal, constraints (length, tone, audience, steps vs comparison), and desired format (e.g. table or numbered steps). Example: “PRD review—need a one-page summary, under 300 words, bullet list.”',
	},
	'pg-s4-2': {
		title: '4.2 Streaming, stop, and continue',
		description:
			'Replies stream as they generate. Stop early if you have enough; use continue to extend the current answer.',
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
			'When logged in, use the Knowledge doc assistant at the bottom of the editor for multi-turn help grounded in the current Markdown. Hidden when logged out. Long threads: use scroll-to-bottom / scroll-to-top near the input; during streaming you can jump back to the latest output. On desktop when logged in, the assistant supports text/voice like Chat and follows UI language.',
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
		title: 'Developer and ops docs',
		description:
			'This page targets everyday use. For self-hosting, reverse proxies, editor edge cases, or contributing, open the documentation folder in your local clone—indexed by topic alongside the source.',
	},
	'pg-s14-1': {
		title: 'Service policy and user agreement',
		description:
			'From About, links open in the system browser (desktop) or a new tab (web), not inside the small About window. Routes: /service-policy and /user-agreement—full-page scroll without the main app chrome. Available logged out; language follows Settings.',
	},
	'pg-s14-2': {
		title: 'Release notes page',
		description:
			'About also links to structured release notes at /update-info—same standalone layout as share pages (header, scroll body). Content is maintained in frontend data modules synced from the repo changelog doc.',
	},
};
