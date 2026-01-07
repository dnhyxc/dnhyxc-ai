import CryptoJS from 'crypto-js';
import md5 from 'js-md5';

const key = CryptoJS.enc.Utf8.parse((md5 as any)(import.meta.env.VITE_MD5_KEY)); // 十六位十六进制数作为密钥
const iv = CryptoJS.enc.Utf8.parse(
	(md5 as any)(import.meta.env.VITE_MD5_IV_KEY),
); // 十六位十六进制数作为密钥偏移量

console.log(key, iv);

// 加密方法
export const encrypt = (pwd: string) => {
	const srcs = CryptoJS.enc.Utf8.parse(pwd);
	const encrypted = CryptoJS.AES.encrypt(srcs, key, {
		iv,
		mode: CryptoJS.mode.CBC,
		padding: CryptoJS.pad.Pkcs7,
	});
	return encrypted.ciphertext.toString().toUpperCase();
};

// 解密方法
export const decrypt = (pwd: string) => {
	const encryptedHexStr = CryptoJS.enc.Hex.parse(pwd);
	const srcs = CryptoJS.enc.Base64.stringify(encryptedHexStr);
	const decrypt = CryptoJS.AES.decrypt(srcs, key, {
		iv,
		mode: CryptoJS.mode.CBC,
		padding: CryptoJS.pad.Pkcs7,
	});
	const decryptedStr = decrypt.toString(CryptoJS.enc.Utf8);
	return decryptedStr.toString();
};
