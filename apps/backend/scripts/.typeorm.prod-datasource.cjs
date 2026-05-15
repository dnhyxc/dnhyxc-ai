'use strict';
const path = require('node:path');
const { DataSource } = require('typeorm');
const root = '/Users/dnhyxc/Documents/code/dnhyxc-ai/apps/backend';
const base =
	require('/Users/dnhyxc/Documents/code/dnhyxc-ai/apps/backend/dist/ormconfig.js').default;
module.exports = new DataSource({
	...base.options,
	migrations: [path.join(root, 'migrations', '**', '*.{js,ts}')],
});
