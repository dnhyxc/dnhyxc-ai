import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import {
	clipboardImageFiles,
	dataTransferImageFiles,
	fileToDataUrl,
	insertImages,
	type ResolveImageSrc,
} from './image';

export type ImageUploadOptions = {
	/** 可变引用：始终读最新上传实现（默认 FileReader → data URL） */
	resolveSrcRef: { current: ResolveImageSrc };
};

/**
 * 粘贴 / 拖放本地图片到编辑器。
 * ponytail: 通过 ref 读上传函数，避免 useEditor 扩展不随 props 重建。
 */
export const ImageUpload = Extension.create<ImageUploadOptions>({
	name: 'imageUpload',

	addOptions() {
		return {
			resolveSrcRef: { current: fileToDataUrl },
		};
	},

	addProseMirrorPlugins() {
		const editor = this.editor;
		const { resolveSrcRef } = this.options;

		return [
			new Plugin({
				key: new PluginKey('imageUpload'),
				props: {
					handlePaste(_view, event) {
						const files = clipboardImageFiles(event);
						if (!files.length) return false;
						event.preventDefault();
						void insertImages(editor, files, (f) => resolveSrcRef.current(f));
						return true;
					},
					handleDrop(_view, event, _slice, moved) {
						if (moved) return false;
						const files = dataTransferImageFiles(event.dataTransfer);
						if (!files.length) return false;
						event.preventDefault();
						void insertImages(editor, files, (f) => resolveSrcRef.current(f));
						return true;
					},
				},
			}),
		];
	},
});
