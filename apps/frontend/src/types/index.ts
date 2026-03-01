export * from './tauri';

export interface DownloadProgress {
	url: string;
	total_bytes: number;
	content_length: number;
	percent: number;
	file_path: string;
	file_name: string;
	file_size: number;
	id: string;
	success: 'success' | 'error' | 'start';
	message: string;
}

export interface DownloadResult {
	success: 'success' | 'error' | 'start';
	message: string;
	id?: string;
	file_path?: string;
	file_name?: string;
	content_type?: string;
	file_size?: number;
}

// 下载选项接口
export interface DownloadOptions {
	url: string;
	id?: string;
	file_name?: string;
	overwrite?: boolean;
	max_size?: number;
	save_dir?: string;
}

// Blob下载选项接口
export interface DownloadBlobOptions {
	file_name: string;
	overwrite?: boolean;
	id: string;
	save_dir?: string;
}

// 文件上传接口
export interface FileWithPreview {
	file: File;
	preview: string;
	id: string;
}

export interface UploadedFile {
	id: string;
	filename: string;
	mimetype: string;
	originalname: string;
	path: string;
	size: number;
}
