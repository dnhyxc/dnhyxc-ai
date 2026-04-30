import path from 'node:path';
import {
	type DeployConfig,
	loadDeployConfig,
	resolveMaybeRelative,
} from './config.js';
import { SshConnection } from './ssh.js';
import { SshCliConnection } from './ssh-cli.js';

type DeployOptions = {
	configPath: string;
	/** 只部署指定 target 名称（可多次传入） */
	onlyTargets?: string[];
	dryRun?: boolean;
};

function shQuote(s: string): string {
	// 最基础的 shell 单引号转义
	return `'${s.replace(/'/g, `'\\''`)}'`;
}

async function runOrThrow(
	ssh: {
		exec: (
			cmd: string,
		) => Promise<{ code: number; stdout: string; stderr: string }>;
	},
	cmd: string,
	stepLabel: string,
	dryRun: boolean,
): Promise<void> {
	if (dryRun) {
		// eslint-disable-next-line no-console
		console.log(`[dry-run] ${stepLabel}: ${cmd}`);
		return;
	}
	const { code, stdout, stderr } = await ssh.exec(cmd);
	if (stdout.trim()) console.log(stdout.trim());
	if (stderr.trim()) console.error(stderr.trim());
	if (code !== 0) {
		throw new Error(`${stepLabel} 失败（exit=${code}）：${cmd}`);
	}
}

function pickTargets(
	cfg: DeployConfig,
	only?: string[],
): DeployConfig['targets'] {
	if (!only?.length) return cfg.targets;
	const set = new Set(only);
	return cfg.targets.filter((t) => set.has(t.name));
}

export async function deployZipViaSsh(opts: DeployOptions): Promise<void> {
	const { config, configDir } = await loadDeployConfig(opts.configPath);
	const targets = pickTargets(config, opts.onlyTargets);
	if (!targets.length) {
		throw new Error(
			'未选中任何 targets（请检查 --only 或配置文件 targets.name）',
		);
	}

	for (const target of targets) {
		console.log(`\n==> 部署目标：${target.name}`);
		const server = config.servers[target.server];
		if (!server) {
			throw new Error(
				`targets[${target.name}].server 指向不存在的 servers key：${target.server}`,
			);
		}

		const localZipAbs = resolveMaybeRelative(configDir, target.localZip);
		const remoteDir = target.remoteDir;
		const remoteTmpZip = target.remoteTmpZip;

		const ssh =
			server.kind === 'ssh-cli'
				? new SshCliConnection({
						sshTarget: server.sshTarget,
						port: server.port,
						sshArgs: server.sshArgs ?? [],
						timeoutMs: server.connectTimeoutMs,
					})
				: await SshConnection.fromConfig({
						host: server.host,
						port: server.port,
						connectTimeoutMs: server.connectTimeoutMs,
						auth: {
							username: server.auth.username,
							password: server.auth.password,
							privateKeyPath: server.auth.privateKeyPath
								? resolveMaybeRelative(configDir, server.auth.privateKeyPath)
								: undefined,
							passphrase: server.auth.passphrase,
						},
					});

		try {
			console.log(
				server.kind === 'ssh-cli'
					? `连接 ${server.sshTarget}:${server.port} ...`
					: `连接 ${server.host}:${server.port} ...`,
			);
			await ssh.connect();
			console.log('连接成功');

			for (const c of target.preCommands) {
				await runOrThrow(ssh, c, `preCommand`, Boolean(opts.dryRun));
			}

			console.log(`上传 ${path.basename(localZipAbs)} -> ${remoteTmpZip}`);
			if (!opts.dryRun) {
				await ssh.uploadFile(localZipAbs, remoteTmpZip);
			} else {
				console.log(`[dry-run] upload ${localZipAbs} -> ${remoteTmpZip}`);
			}

			await runOrThrow(
				ssh,
				`mkdir -p ${shQuote(remoteDir)}`,
				`创建远端目录`,
				Boolean(opts.dryRun),
			);

			if (target.cleanRemoteDir) {
				await runOrThrow(
					ssh,
					`rm -rf ${shQuote(remoteDir)}/*`,
					`清空远端目录`,
					Boolean(opts.dryRun),
				);
			}

			// 使用 unzip 覆盖解压；若目标机器无 unzip，可在 preCommands 自行安装
			await runOrThrow(
				ssh,
				`unzip -o ${shQuote(remoteTmpZip)} -d ${shQuote(remoteDir)}`,
				`解压 dist.zip`,
				Boolean(opts.dryRun),
			);

			if (target.installDeps) {
				await runOrThrow(
					ssh,
					`cd ${shQuote(remoteDir)} && ${target.installCommand}`,
					`安装依赖`,
					Boolean(opts.dryRun),
				);
			}

			if (target.pm2Name) {
				await runOrThrow(
					ssh,
					`${target.pm2RestartCommand} ${shQuote(target.pm2Name)}`,
					`pm2 重启`,
					Boolean(opts.dryRun),
				);
			}

			if (target.restartNginx) {
				await runOrThrow(
					ssh,
					target.nginxRestartCommand,
					`重启 nginx`,
					Boolean(opts.dryRun),
				);
			}

			for (const c of target.postCommands) {
				await runOrThrow(ssh, c, `postCommand`, Boolean(opts.dryRun));
			}

			console.log(`完成：${target.name}`);
		} finally {
			await ssh.close().catch(() => undefined);
		}
	}
}
