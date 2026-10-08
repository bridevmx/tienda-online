#!/usr/bin/env node
/** Crea o actualiza el superusuario de PocketBase. Uso: npm run pb:superuser -- correo contrasena */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
	console.error('Uso: npm run pb:superuser -- correo contrasena');
	process.exit(1);
}
const dir = fileURLToPath(new URL('../pocketbase', import.meta.url));
const bin = join(dir, process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');
const result = spawnSync(
	bin,
	[
		'superuser',
		'upsert',
		email,
		password,
		`--dir=${process.env.PB_DATA_DIR || join(dir, 'pb_data')}`
	],
	{ stdio: 'inherit' }
);
process.exit(result.status ?? 1);
