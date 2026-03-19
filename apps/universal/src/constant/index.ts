export const BASE_URL = import.meta.env.PROD
	? import.meta.env.VITE_PROD_API_DOMAIN
	: import.meta.env.VITE_DEV_API_DOMAIN;

export const CHAT_VALIDTYPES = [
	'application/pdf',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'image/png',
	'image/jpeg',
	'image/jpg',
	'image/webp',
];

export const CHAT_IMAGE_VALIDTYPES = [
	'image/png',
	'image/jpeg',
	'image/jpg',
	'image/webp',
];
