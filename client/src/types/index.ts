export * from './tauri';

export interface DownloadFileInfo {
	file_path: string;
	file_name: string;
	id: string;
	content_type: string;
	success: string;
	message: string;
	file_size?: number;
}

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
	success: 'success' | 'error';
	message: string;
	id?: string;
	file_path?: string;
	file_name?: string;
}

export interface DownloadFileInfo {
	file_path: string;
	file_name: string;
	id: string;
	content_type: string;
	success: string;
	message: string;
}

// 下载选项接口
export interface DownloadOptions {
	id: string;
	url: string;
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
