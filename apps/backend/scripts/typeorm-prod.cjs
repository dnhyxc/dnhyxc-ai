/**
 * 生产环境 TypeORM CLI（在 /usr/local/dnhyxc-ai/server 或 apps/backend 根目录执行）：
 * - 数据库连接：dist/ormconfig.js（实体仍从 dist 加载）
 * - 迁移文件：./migrations/（与 dist 同级，重新部署 dist 不会覆盖）
 */
const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { spawnSync } = require('node:child_process');

const cwd = process.cwd();
const distOrmconfig = resolve(cwd, 'dist/ormconfig.js');
const migrationsDir = resolve(cwd, 'migrations');
const prodDataSourceFile = resolve(cwd, '.typeorm.prod-datasource.cjs');

if (!existsSync(distOrmconfig)) {
	console.error(
		'[typeorm:prod] 未找到 dist/ormconfig.js（请在 server 根目录执行，且已存在 dist/）',
	);
	process.exit(1);
}

mkdirSync(migrationsDir, { recursive: true });

/** 基于 dist/ormconfig，将 migrations 指向 server 根目录 ./migrations */
function ensureProdDataSourceFile() {
	const content = `'use strict';
const path = require('node:path');
const { DataSource } = require('typeorm');
const root = ${JSON.stringify(cwd)};
const base = require(${JSON.stringify(distOrmconfig)}).default;
module.exports = new DataSource({
	...base.options,
	migrations: [path.join(root, 'migrations', '**', '*.{js,ts}')],
});
`;
	writeFileSync(prodDataSourceFile, content, 'utf8');
	return prodDataSourceFile;
}

const cliArgs = process.argv.slice(2);
if (cliArgs.length === 0) {
	console.error(
		'[typeorm:prod] 请传入子命令，例如：migration:create | migration:run | migration:generate',
	);
	process.exit(1);
}

const subcommand = cliArgs[0];
const needsDataSource = subcommand !== 'migration:create';

/**
 * 解析迁移路径参数（兼容 -p），默认目录为 ./migrations/<name>
 */
function resolveMigrationPathArg(rest, { requireName }) {
	let pathArg = '';
	const extraFlags = [];
	for (let i = 0; i < rest.length; i++) {
		const a = rest[i];
		if (a === '-p' || a === '--path') {
			pathArg = rest[++i] ?? '';
			continue;
		}
		if (!a.startsWith('-')) {
			pathArg = pathArg ? `${pathArg}/${a}` : a;
			continue;
		}
		extraFlags.push(a);
	}
	if (!pathArg && requireName) {
		console.error(
			'[typeorm:prod] 请提供迁移名称，例如：pnpm m:c:prod add-vocab-pos',
		);
		process.exit(1);
	}
	if (pathArg && !pathArg.includes('/') && !pathArg.includes('\\')) {
		pathArg = join('migrations', pathArg);
	}
	return { pathArg, extraFlags };
}

function buildMigrationCreateArgs(rest) {
	const { pathArg, extraFlags } = resolveMigrationPathArg(rest, {
		requireName: true,
	});
	const out = ['migration:create', pathArg, ...extraFlags];
	if (!out.includes('--outputJs') && !out.includes('-o')) {
		out.push('--outputJs');
	}
	return out;
}

function buildMigrationGenerateArgs(rest) {
	const { pathArg, extraFlags } = resolveMigrationPathArg(rest, {
		requireName: true,
	});
	return ['migration:generate', pathArg, ...extraFlags];
}

let typeormArgv;
if (subcommand === 'migration:create') {
	typeormArgv = [
		require.resolve('typeorm/cli.js'),
		...buildMigrationCreateArgs(cliArgs.slice(1)),
	];
} else if (subcommand === 'migration:generate') {
	const ds = ensureProdDataSourceFile();
	typeormArgv = [
		require.resolve('typeorm/cli.js'),
		'-d',
		ds,
		...buildMigrationGenerateArgs(cliArgs.slice(1)),
	];
} else if (needsDataSource) {
	const ds = ensureProdDataSourceFile();
	typeormArgv = [require.resolve('typeorm/cli.js'), '-d', ds, ...cliArgs];
} else {
	typeormArgv = [require.resolve('typeorm/cli.js'), ...cliArgs];
}

const env = { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' };

const result = spawnSync(process.execPath, typeormArgv, {
	stdio: 'inherit',
	env,
	cwd,
});

process.exit(result.status === null ? 1 : result.status);
