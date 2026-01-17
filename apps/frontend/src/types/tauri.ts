export interface WindowOptions {
	width: number;
	height: number;
	url: string;
	label?: string;
	title?: string;
	resizable?: boolean;
	decorations?: boolean;
	minWidth?: number;
	minHeight?: number;
	x?: number;
	y?: number;
	hiddenTitle?: boolean;
	titleBarStyle?: 'overlay' | 'transparent' | 'visible';
	theme?: 'light' | 'dark'; // 不设置将是跟随系统
	createdCallback?: () => void;
	errorCallback?: (e: any) => void;
}
