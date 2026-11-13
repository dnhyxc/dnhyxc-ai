/**
 * 一次性把 english_vocabulary_library_item.lemma 的空值补上。
 * 只更新 lemma = '' 的行，已经有值的不动。再跑一次是空操作。
 *
 * 数据库连接只读同目录的 .env.production，不用 .env，也不用 shell 里的变量。
 * 在含 .env.production 的目录执行（线上 /usr/local/dnhyxc-ai/server）：
 *   node dist/scripts/backfill-vocab-lemma.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

function storedLemma(word) {
	const lemma = String(word ?? '')
		.trim()
		.replace(/\s+/g, ' ')
		.toLowerCase();
	return lemma.length > 120 ? '' : lemma;
}

function findRoot() {
	const starts = [process.cwd(), __dirname];
	for (const start of starts) {
		let dir = path.resolve(start);
		for (let i = 0; i < 6; i += 1) {
			if (fs.existsSync(path.join(dir, '.env.production'))) return dir;
			const parent = path.dirname(dir);
			if (parent === dir) break;
			dir = parent;
		}
	}
	return null;
}

function readEnv() {
	const root = findRoot();
	if (!root) {
		console.error('找不到 .env.production');
		process.exit(1);
	}
	const merged = dotenv.parse(
		fs.readFileSync(path.join(root, '.env.production')),
	);
	const need = [
		'DB_HOST',
		'DB_PORT',
		'DB_USERNAME',
		'DB_PASSWORD',
		'DB_DATABASE',
	];
	for (const key of need) {
		if (!merged[key]) {
			console.error(`缺少 ${key}`);
			process.exit(1);
		}
	}
	if (merged.DB_TYPE && merged.DB_TYPE !== 'mysql') {
		console.error(`这个脚本只连 MySQL，当前 DB_TYPE=${merged.DB_TYPE}`);
		process.exit(1);
	}
	return merged;
}

async function main() {
	const env = readEnv();
	console.log(
		`using .env.production ${env.DB_HOST}:${env.DB_PORT}/${env.DB_DATABASE}`,
	);
	const conn = await mysql.createConnection({
		host: env.DB_HOST,
		port: Number(env.DB_PORT),
		user: env.DB_USERNAME,
		password: env.DB_PASSWORD,
		database: env.DB_DATABASE,
	});
	let last = '';
	let updated = 0;
	for (;;) {
		const [rows] = await conn.query(
			'SELECT id, word FROM english_vocabulary_library_item WHERE id > ? AND lemma = ? ORDER BY id ASC LIMIT 200',
			[last, ''],
		);
		if (!rows.length) break;
		const params = [];
		const whens = [];
		for (const row of rows) {
			whens.push('WHEN ? THEN ?');
			params.push(row.id, storedLemma(row.word));
		}
		const ids = rows.map((row) => row.id);
		await conn.query(
			`UPDATE english_vocabulary_library_item SET lemma = CASE id ${whens.join(' ')} ELSE lemma END WHERE id IN (${ids.map(() => '?').join(',')})`,
			[...params, ...ids],
		);
		updated += rows.length;
		last = ids[ids.length - 1];
	}
	const [check] = await conn.query(
		"SELECT SUM(lemma = '') AS empty_lemma, SUM(lemma <> '') AS filled FROM english_vocabulary_library_item",
	);
	console.log(
		`updated ${updated}, empty ${check[0].empty_lemma}, filled ${check[0].filled}`,
	);
	await conn.end();
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
