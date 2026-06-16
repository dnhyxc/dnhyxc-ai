const COVER_ACCEPT = /^image\/(jpeg|png|webp)$/i;
const MAX_COVER_BYTES = 2 * 1024 * 1024;

export type CoverImageOptions = {
	maxEdge?: number;
	quality?: number;
};

function coverMimeFromFile(file: File): string {
	if (file.type === 'image/png') return 'image/png';
	if (file.type === 'image/webp') return 'image/webp';
	return 'image/jpeg';
}

function coverExtFromMime(mime: string): string {
	if (mime === 'image/png') return 'png';
	if (mime === 'image/webp') return 'webp';
	return 'jpg';
}

/** 将图片文件压缩为可上传的 File，供书架封面上传 */
export async function fileToCoverFile(
	file: File,
	opts: CoverImageOptions = {},
): Promise<File> {
	const { maxEdge = 640, quality = 0.85 } = opts;
	if (!COVER_ACCEPT.test(file.type)) {
		throw new Error('仅支持 JPG、PNG、WebP 封面');
	}
	if (file.size > MAX_COVER_BYTES) {
		throw new Error('封面图片不能超过 2MB');
	}

	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
	const width = Math.max(1, Math.round(bitmap.width * scale));
	const height = Math.max(1, Math.round(bitmap.height * scale));

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		bitmap.close();
		throw new Error('无法处理封面图片');
	}
	ctx.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();

	const mime = coverMimeFromFile(file);
	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(result) => {
				if (result) resolve(result);
				else reject(new Error('无法处理封面图片'));
			},
			mime,
			quality,
		);
	});

	const ext = coverExtFromMime(mime);
	return new File([blob], `cover.${ext}`, { type: mime });
}
