#!/usr/bin/env node
/** Levanta PocketBase local con datos y migraciones dentro de ./pocketbase. */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dir = fileURLToPath(new URL('../pocketbase', import.meta.url));
const bin = join(dir, process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');

if (!existsSync(bin)) {
	console.error('No hay binario de PocketBase. Ejecuta primero: npm run pb:download');
	process.exit(1);
}

const child = spawn(
	bin,
	[
		'serve',
		'--http=127.0.0.1:8090',
		`--dir=${join(dir, 'pb_data')}`,
		`--migrationsDir=${join(dir, 'pb_migrations')}`
	],
	{ stdio: 'inherit' }
);
child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
