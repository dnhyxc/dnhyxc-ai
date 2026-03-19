export const setStorage = (key: string, value: string) => {
	localStorage.setItem(key, value);
	window.dispatchEvent(new Event(`${key}Changed`));
};

export const getStorage = (key: string) => {
	return localStorage.getItem(key);
};

export const removeStorage = (key: string) => {
	localStorage.removeItem(key);
	window.dispatchEvent(new Event(`${key}Changed`));
};
