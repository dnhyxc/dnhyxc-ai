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
	id: string;
	success: string;
}
