#!/usr/bin/env node
/** Levanta PocketBase y SvelteKit juntos; Ctrl+C detiene ambos. */
import { spawn } from 'node:child_process';

const run = (cmd, args) =>
	spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
const children = [run('node', ['scripts/pb-serve.js']), run('npm', ['run', 'dev'])];

let closing = false;
function shutdown(code = 0) {
	if (closing) return;
	closing = true;
	for (const child of children) child.kill('SIGTERM');
	process.exit(code);
}
for (const child of children) child.on('exit', (code) => shutdown(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutdown(0));
