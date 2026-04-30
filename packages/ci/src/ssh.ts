import { readFile } from 'node:fs/promises';
import { Client, type ConnectConfig } from 'ssh2';

export type SshAuth =
	| { username: string; password: string }
	| { username: string; privateKey: Buffer; passphrase?: string };

export type SshServer = {
	host: string;
	port: number;
	auth: SshAuth;
	connectTimeoutMs: number;
};

export class SshConnection {
	private client: Client;

	constructor(private readonly server: SshServer) {
		this.client = new Client();
	}

	static async fromConfig(input: {
		host: string;
		port: number;
		connectTimeoutMs: number;
		auth: {
			username: string;
			password?: string;
			privateKeyPath?: string;
			passphrase?: string;
		};
	}): Promise<SshConnection> {
		const { auth } = input;
		if (auth.password) {
			return new SshConnection({
				host: input.host,
				port: input.port,
				connectTimeoutMs: input.connectTimeoutMs,
				auth: { username: auth.username, password: auth.password },
			});
		}
		if (auth.privateKeyPath) {
			const key = await readFile(auth.privateKeyPath);
			return new SshConnection({
				host: input.host,
				port: input.port,
				connectTimeoutMs: input.connectTimeoutMs,
				auth: {
					username: auth.username,
					privateKey: key,
					passphrase: auth.passphrase,
				},
			});
		}
		throw new Error('auth.password 与 auth.privateKeyPath 必须二选一');
	}

	async connect(): Promise<void> {
		const cfg: ConnectConfig = {
			host: this.server.host,
			port: this.server.port,
			username: this.server.auth.username,
			readyTimeout: this.server.connectTimeoutMs,
		};
		if ('password' in this.server.auth) {
			cfg.password = this.server.auth.password;
		} else {
			cfg.privateKey = this.server.auth.privateKey;
			if (this.server.auth.passphrase)
				cfg.passphrase = this.server.auth.passphrase;
		}

		await new Promise<void>((resolve, reject) => {
			this.client
				.on('ready', () => resolve())
				.on('error', (err) => reject(err))
				.connect(cfg);
		});
	}

	async close(): Promise<void> {
		await new Promise<void>((resolve) => {
			this.client.on('close', () => resolve());
			this.client.end();
		});
	}

	async exec(
		cmd: string,
	): Promise<{ code: number; stdout: string; stderr: string }> {
		return await new Promise((resolve, reject) => {
			this.client.exec(cmd, { pty: false }, (err, stream) => {
				if (err) return reject(err);
				let stdout = '';
				let stderr = '';
				stream
					.on('close', (code: number | null) => {
						resolve({ code: code ?? 0, stdout, stderr });
					})
					.on('data', (d: Buffer) => {
						stdout += d.toString('utf8');
					});
				stream.stderr.on('data', (d: Buffer) => {
					stderr += d.toString('utf8');
				});
			});
		});
	}

	async uploadFile(localPath: string, remotePath: string): Promise<void> {
		const sftp = await new Promise<any>((resolve, reject) => {
			this.client.sftp((err, s) => {
				if (err) return reject(err);
				resolve(s);
			});
		});

		await new Promise<void>((resolve, reject) => {
			sftp.fastPut(localPath, remotePath, (err: any) => {
				if (err) return reject(err);
				resolve();
			});
		});
	}
}
