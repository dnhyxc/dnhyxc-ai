import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RichEditorLocale } from '../locale';
import {
	applyLinkToRange,
	type LinkRange,
	removeLinkInRange,
	resolveLinkTarget,
} from './linkRange';

export type LinkDraft = {
	href: string;
	/** 设链目标；null 表示空行，无法设链 */
	range: LinkRange | null;
};

type LinkFormProps = {
	locale: RichEditorLocale;
	href: string;
	onHrefChange: (href: string) => void;
	onApply: () => void;
	onRemove: () => void;
	onClose: () => void;
	/** 空行无法设链时的提示 */
	hint?: string;
};

/** 自定义链接输入面板（替代 window.prompt，适配 Tauri） */
export function LinkForm({
	locale: t,
	href,
	onHrefChange,
	onApply,
	onRemove,
	onClose,
	hint,
}: LinkFormProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
		inputRef.current?.select();
	}, []);

	return (
		<div
			className="rich-editor-link-form"
			role="dialog"
			aria-label={t.link}
			onMouseDown={(e) => {
				if ((e.target as HTMLElement).closest('input,button')) return;
				e.preventDefault();
			}}
		>
			<span className="rich-editor-link-label">{t.linkPrompt}</span>
			<input
				ref={inputRef}
				type="text"
				inputMode="url"
				autoComplete="url"
				className="rich-editor-link-input"
				placeholder={t.linkPlaceholder}
				value={href}
				onChange={(e) => onHrefChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						onApply();
					}
					if (e.key === 'Escape') {
						e.preventDefault();
						onClose();
					}
				}}
			/>
			{hint ? <span className="rich-editor-link-hint">{hint}</span> : null}
			<button
				type="button"
				className="rich-editor-link-action"
				disabled={!!hint}
				onClick={onApply}
			>
				{t.linkApply}
			</button>
			<button
				type="button"
				className="rich-editor-link-action"
				onClick={onRemove}
			>
				{t.unlink}
			</button>
			<button
				type="button"
				className="rich-editor-link-action ghost"
				onClick={onClose}
			>
				{t.linkCancel}
			</button>
		</div>
	);
}

function normalizeHref(raw: string): string {
	const url = raw.trim();
	if (!url || url === 'https://' || url === 'http://') return '';
	if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) return `https://${url}`;
	return url;
}

/**
 * 打开 / 应用链接。
 * 打开时即锁定目标选区（选区 / 词 / 整行），应用时只给目标加 mark，不把 URL 插入正文。
 */
export function useLinkEditor(editor: Editor | null) {
	const [draft, setDraft] = useState<LinkDraft | null>(null);

	const open = useCallback(() => {
		if (!editor) return;
		const range = resolveLinkTarget(editor.state);
		const prev =
			(editor.getAttributes('link').href as string | undefined) ?? '';

		// 有目标时先选中，方便用户看见将要加链接的范围
		if (range) {
			editor.chain().setTextSelection(range).run();
		}

		setDraft({
			href: prev || 'https://',
			range,
		});
	}, [editor]);

	const close = useCallback(() => setDraft(null), []);

	const apply = useCallback(() => {
		if (!editor || !draft) return;
		const href = normalizeHref(draft.href);

		if (!draft.range) {
			// 空行：不插入 URL 正文
			setDraft(null);
			return;
		}

		if (!href) {
			removeLinkInRange(editor, draft.range);
			setDraft(null);
			return;
		}

		applyLinkToRange(editor, draft.range, href);
		setDraft(null);
	}, [draft, editor]);

	const remove = useCallback(() => {
		if (!editor || !draft) return;
		if (draft.range) removeLinkInRange(editor, draft.range);
		setDraft(null);
	}, [draft, editor]);

	const setHref = useCallback((href: string) => {
		setDraft((d) => (d ? { ...d, href } : d));
	}, []);

	return { draft, open, close, apply, remove, setHref };
}
