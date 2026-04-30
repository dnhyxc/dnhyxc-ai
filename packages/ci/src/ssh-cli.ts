import { spawn } from 'node:child_process';

type ExecResult = { code: number; stdout: string; stderr: string };

function run(
	bin: string,
	args: string[],
	timeoutMs: number,
): Promise<ExecResult> {
	return new Promise((resolve, reject) => {
		const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
		let stdout = '';
		let stderr = '';

		const t = setTimeout(() => {
			child.kill('SIGKILL');
			reject(new Error(`${bin} 超时（${timeoutMs}ms）`));
		}, timeoutMs);

		child.stdout.on('data', (d) => (stdout += d.toString('utf8')));
		child.stderr.on('data', (d) => (stderr += d.toString('utf8')));
		child.on('error', (e) => {
			clearTimeout(t);
			reject(e);
		});
		child.on('close', (code) => {
			clearTimeout(t);
			resolve({ code: code ?? 0, stdout, stderr });
		});
	});
}

export class SshCliConnection {
	constructor(
		private readonly opts: {
			sshTarget: string;
			port: number;
			sshArgs: string[];
			timeoutMs: number;
		},
	) {}

	async connect(): Promise<void> {
		// ssh-cli 无需显式 connect，这里做一次轻量探测
		const r = await this.exec('true');
		if (r.code !== 0) {
			throw new Error(`ssh 连接探测失败：${r.stderr || r.stdout}`.trim());
		}
	}

	async close(): Promise<void> {
		// no-op
	}

	async exec(cmd: string): Promise<ExecResult> {
		const args = [
			'-p',
			String(this.opts.port),
			...this.opts.sshArgs,
			this.opts.sshTarget,
			// 用 sh -lc 保持与交互 shell 相近的行为
			'sh',
			'-lc',
			cmd,
		];
		return await run('ssh', args, this.opts.timeoutMs);
	}

	async uploadFile(localPath: string, remotePath: string): Promise<void> {
		// scp -P <port> <local> <target>:<remote>
		const dest = `${this.opts.sshTarget}:${remotePath}`;
		const args = [
			'-P',
			String(this.opts.port),
			...this.opts.sshArgs,
			localPath,
			dest,
		];
		const r = await run('scp', args, this.opts.timeoutMs);
		if (r.stdout.trim()) console.log(r.stdout.trim());
		if (r.stderr.trim()) console.error(r.stderr.trim());
		if (r.code !== 0) {
			throw new Error(`scp 上传失败（exit=${r.code}）`);
		}
	}
}
