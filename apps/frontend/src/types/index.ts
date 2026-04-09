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
	preview?: string;
	id: string;
}

export interface UploadedFile {
	id: string;
	uuid: string;
	filename: string;
	mimetype: string;
	originalname: string;
	path: string;
	size: number;
}

export interface ShareInfo {
	createdAt: number;
	expiresAt: number;
	shareId: string;
	shareUrl: string;
}

/** 知识库单条（与后端 Knowledge 一致；接口 JSON 日期多为 ISO 字符串） */
export type KnowledgeRecord = {
	id: string;
	title: string | null;
	content: string;
	author: string | null;
	authorId: number | null;
	createdAt?: string;
	updatedAt?: string;
	/**
	 * 从本地文件夹打开时：保存到磁盘应使用的目录（一般为该文件所在目录），与默认知识库目录互斥
	 */
	localDirPath?: string;
};

/** 列表项（无正文大字段） */
export type KnowledgeListItem = Omit<KnowledgeRecord, 'content'> & {
	/** 本地浏览模式下列表项对应的 `.md` 绝对路径 */
	localAbsolutePath?: string;
};

/** 知识库回收站列表项（与后端 KnowledgeTrashListItem 对齐） */
export type KnowledgeTrashListItem = {
	id: string;
	originalId: string;
	title: string | null;
	author: string | null;
	authorId: number | null;
	deletedAt?: string;
};
