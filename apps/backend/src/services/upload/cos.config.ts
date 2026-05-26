import { CosEnum } from '../../enum/config.enum';
import { getEnvConfig } from '../../utils';

/** 与 cos-nodejs-sdk-v5 的 COS.ObjectACL 保持一致 */
export const COS_OBJECT_ACL_VALUES = [
	'default',
	'private',
	'public-read',
	'authenticated-read',
	'bucket-owner-read',
	'bucket-owner-full-control',
] as const;

export type CosObjectAcl = (typeof COS_OBJECT_ACL_VALUES)[number];

export function parseCosObjectAcl(raw: unknown): CosObjectAcl {
	const value = String(raw || 'public-read');
	if ((COS_OBJECT_ACL_VALUES as readonly string[]).includes(value)) {
		return value as CosObjectAcl;
	}
	return 'public-read';
}

export interface CosRuntimeConfig {
	secretId: string;
	secretKey: string;
	bucket: string;
	region: string;
	publicDomain: string;
	/** putObject ACL，头像等需浏览器直读时一般为 public-read */
	objectAcl: CosObjectAcl;
}

/** 读取 COS 配置；兼容旧七牛环境变量名以便迁移 */
export function getCosRuntimeConfig(): CosRuntimeConfig {
	const config = getEnvConfig();
	const secretId = config[CosEnum.COS_SECRET_ID] || config.ACCESS_KEY || '';
	const secretKey = config[CosEnum.COS_SECRET_KEY] || config.SECRET_KEY || '';
	const bucket = config[CosEnum.COS_BUCKET] || config.BUCKET_NAME || '';
	const region = config[CosEnum.COS_REGION] || '';
	const publicDomainRaw =
		config[CosEnum.COS_PUBLIC_DOMAIN] || config.DOMAIN || '';

	let publicDomain = String(publicDomainRaw || '').trim();
	if (publicDomain && !publicDomain.endsWith('/')) {
		publicDomain = `${publicDomain}/`;
	}
	if (!publicDomain && bucket && region) {
		publicDomain = `https://${bucket}.cos.${region}.myqcloud.com/`;
	}

	return {
		secretId: String(secretId),
		secretKey: String(secretKey),
		bucket: String(bucket),
		region: String(region),
		publicDomain,
		objectAcl: parseCosObjectAcl(config[CosEnum.COS_OBJECT_ACL]),
	};
}

type CosSdkError = Error & {
	statusCode?: number;
	code?: string;
	error?: { Code?: string; Message?: string; RequestId?: string };
	RequestId?: string;
};

/** 将 COS SDK 错误转为可读提示（含常见权限问题说明） */
export function formatCosUploadError(error: unknown): string {
	const err = error as CosSdkError;
	const code = err?.code || err?.error?.Code;
	const requestId = err?.RequestId || err?.error?.RequestId;
	const base = err?.error?.Message || err?.message || '上传到 COS 失败';
	const suffix = requestId ? `（RequestId: ${requestId}）` : '';

	if (code === 'AccessDenied' || /access denied/i.test(base)) {
		return (
			'COS 拒绝写入（AccessDenied）：当前 SecretId 可能仅有读权限。' +
			'请在访问管理 CAM 为该密钥关联用户/子账号添加对象写入策略，' +
			'例如预设策略 QcloudCOSDataFullControl，或自定义策略包含 cos:PutObject，' +
			`资源范围需覆盖存储桶 ${getCosRuntimeConfig().bucket || '<COS_BUCKET>'} 下路径（如 assets/*）。` +
			suffix
		);
	}

	return `${base}${suffix}`;
}

export function assertCosRuntimeConfig(
	config: CosRuntimeConfig,
): asserts config is CosRuntimeConfig & {
	secretId: string;
	secretKey: string;
	bucket: string;
	region: string;
} {
	if (
		!config.secretId ||
		!config.secretKey ||
		!config.bucket ||
		!config.region
	) {
		throw new Error(
			'COS 未配置：请设置 COS_SECRET_ID、COS_SECRET_KEY、COS_BUCKET、COS_REGION',
		);
	}
}
