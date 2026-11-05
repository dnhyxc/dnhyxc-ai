import type {
	ComponentType,
	CSSProperties,
	ReactNode,
	UIEventHandler,
} from 'react';

export type RichTextImageItem = {
	id?: string;
	url: string;
};

export type RichTextImagePreviewProps = {
	visible: boolean;
	selectedImage?: RichTextImageItem;
	imageList?: RichTextImageItem[];
	showDownload?: boolean;
	showPrevAndNext?: boolean;
	title?: string;
	download?: (image: RichTextImageItem) => void | Promise<void>;
	onVisibleChange?: (visible: boolean) => void;
	t?: (key: string, params?: Record<string, unknown>) => string;
};

export type RichTextScrollAreaProps = {
	className?: string;
	style?: CSSProperties;
	onScroll?: UIEventHandler<HTMLDivElement>;
	children?: ReactNode;
};

export type RichTextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
	showCount?: boolean;
};

export type RichTextButtonProps =
	React.ButtonHTMLAttributes<HTMLButtonElement> & {
		variant?: 'default' | 'outline' | 'ghost' | 'secondary';
	};

export type RichTextKitSlots = {
	ScrollArea: ComponentType<RichTextScrollAreaProps>;
	Button: ComponentType<RichTextButtonProps>;
	Input: ComponentType<RichTextInputProps>;
	ImagePreview: ComponentType<RichTextImagePreviewProps>;
};
