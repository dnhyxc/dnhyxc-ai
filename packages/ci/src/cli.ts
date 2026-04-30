import { Command } from 'commander';
import { deployZipViaSsh } from './deploy.js';

const program = new Command();

program
	.name('dnhyxc-ci')
	.description(
		'CI/部署工具：SSH 上传 dist.zip、远端解压、可选安装依赖、pm2/nginx 重启',
	)
	.version('0.0.1');

program
	.command('ssh:deploy')
	.description('通过 SSH 上传 dist.zip 并部署到远端目录')
	.requiredOption('-c, --config <path>', '配置文件路径（JSON）')
	.option('--only <targetName...>', '只部署指定 target（可传多个）')
	.option('--dry-run', '只打印将执行的命令，不做实际操作', false)
	.action(
		async (opts: { config: string; only?: string[]; dryRun?: boolean }) => {
			await deployZipViaSsh({
				configPath: opts.config,
				onlyTargets: opts.only,
				dryRun: Boolean(opts.dryRun),
			});
		},
	);

program.parseAsync(process.argv).catch((err) => {
	// eslint-disable-next-line no-console
	console.error(err instanceof Error ? err.message : err);
	process.exitCode = 1;
});
