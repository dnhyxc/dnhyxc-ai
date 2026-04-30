import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const AuthSchema = z
	.object({
		username: z.string().min(1),
		/** 二选一：password 或 privateKeyPath */
		password: z.string().min(1).optional(),
		privateKeyPath: z.string().min(1).optional(),
		passphrase: z.string().min(1).optional(),
	})
	.superRefine((v, ctx) => {
		const hasPwd = Boolean(v.password);
		const hasKey = Boolean(v.privateKeyPath);
		if (hasPwd === hasKey) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'auth.password 与 auth.privateKeyPath 必须二选一',
				path: ['auth'],
			});
		}
	});

const ServerSsh2Schema = z.object({
	kind: z.literal('ssh2').default('ssh2'),
	host: z.string().min(1),
	port: z.number().int().min(1).max(65535).default(22),
	auth: AuthSchema,
	/** 连接超时（毫秒） */
	connectTimeoutMs: z.number().int().min(1000).max(120000).default(15000),
});

const ServerSshCliSchema = z.object({
	kind: z.literal('ssh-cli'),
	/**
	 * ssh 目标：支持 user@ip / host，也支持你本机 ~/.ssh/config 里的 alias（如 xxx）
	 * 最终会执行：ssh -p <port> <sshTarget> "<cmd>"
	 */
	sshTarget: z.string().min(1),
	port: z.number().int().min(1).max(65535).default(22),
	/** 额外 ssh 参数（如 -o StrictHostKeyChecking=no） */
	sshArgs: z.array(z.string().min(1)).default([]),
	/** 连接超时（毫秒） */
	connectTimeoutMs: z.number().int().min(1000).max(120000).default(15000),
});

const ServerSchema = z.union([ServerSsh2Schema, ServerSshCliSchema]);

const TargetSchema = z.object({
	/** 目标名称（用于日志） */
	name: z.string().min(1),
	/** 引用 servers 里的某个 key */
	server: z.string().min(1),

	/** 本地 dist.zip 路径（支持相对 config 文件所在目录） */
	localZip: z.string().min(1),
	/** 远端部署目录（解压到这里） */
	remoteDir: z.string().min(1),

	/** 远端临时 zip 路径 */
	remoteTmpZip: z.string().default('/tmp/dist.zip'),
	/** 解压前是否清空 remoteDir（危险操作） */
	cleanRemoteDir: z.boolean().default(false),

	/** 是否执行安装依赖（后端常见）；默认不安装 */
	installDeps: z.boolean().default(false),
	/** 安装依赖命令（可自定义 pnpm/npm/yarn） */
	installCommand: z.string().default('pnpm install --prod'),

	/** pm2：需要重启的应用名；不填则跳过 */
	pm2Name: z.string().min(1).optional(),
	/** pm2 重启命令（可自定义，如 ecosystem） */
	pm2RestartCommand: z.string().default('pm2 restart'),

	/** 是否重启 nginx */
	restartNginx: z.boolean().default(false),
	/** nginx 重启命令（需要 sudo 权限时请自行配置免密或改成适配命令） */
	nginxRestartCommand: z.string().default('sudo systemctl restart nginx'),

	/** 额外的远端命令（可选） */
	preCommands: z.array(z.string().min(1)).default([]),
	postCommands: z.array(z.string().min(1)).default([]),
});

export const DeployConfigSchema = z.object({
	/** 多服务器配置：key 为 serverId */
	servers: z.record(z.string().min(1), ServerSchema),
	/** 多目标部署（可一次 deploy 多个项目/多台机器） */
	targets: z.array(TargetSchema).min(1),
});

export type DeployConfig = z.infer<typeof DeployConfigSchema>;

export async function loadDeployConfig(configPath: string): Promise<{
	config: DeployConfig;
	configDir: string;
}> {
	const abs = path.isAbsolute(configPath)
		? configPath
		: path.resolve(process.cwd(), configPath);
	const raw = await readFile(abs, 'utf8');
	const json = JSON.parse(raw);
	const config = DeployConfigSchema.parse(json);
	return { config, configDir: path.dirname(abs) };
}

export function resolveMaybeRelative(baseDir: string, p: string): string {
	return path.isAbsolute(p) ? p : path.resolve(baseDir, p);
}
