export type { Editor } from '@tiptap/react';
export type {
	CodeLanguage,
	CreateExtensionsOptions,
	ResolveImageSrc,
	RichEditorChangePayload,
	RichEditorContent,
	RichEditorLocale,
	RichEditorProps,
	TextDirection,
} from './editor';
export {
	Btn,
	CODE_LANGUAGES,
	createExtensions,
	EMPTY_NOTE_DOC,
	enUS,
	fileToDataUrl,
	getDocTitleText,
	NoteTitleField,
	normalizeNoteContent,
	pickImageFile,
	RichEditor,
	richEditorLocaleOf,
	TitleNode,
	zhCN,
} from './editor';
export type {
	RichTextButtonProps,
	RichTextImageItem,
	RichTextImagePreviewProps,
	RichTextInputProps,
	RichTextKitSlots,
	RichTextScrollAreaProps,
} from './slots';
export {
	DefaultButton,
	DefaultImagePreview,
	DefaultInput,
	DefaultScrollArea,
	defaultRichTextKitSlots,
	mergeRichTextKitSlots,
	RichTextKitProvider,
	useRichTextKitSlots,
} from './slots';
