import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CLIP_KEY, CLIP_SECRET, CLIP_WEBHOOK_TOKEN, startClipMock } from './mocks/clip.js';
import { startSmtpSink } from './mocks/smtp.js';

const ROOT = resolve(import.meta.dirname, '../..');
const PB_BIN = join(
	ROOT,
	'pocketbase',
	process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase'
);

export const USERS = {
	boss: { email: 'boss@test.local', name: 'Jefa', role: 'admin', password: 'Admin-pass-123' },
	ger: { email: 'ger@test.local', name: 'Gerente', role: 'gerente', password: 'Ger-pass-12345' },
	caja: { email: 'caja@test.local', name: 'Caja', role: 'cajero', password: 'Caja-pass-1234' }
};
const SUPERUSER = { email: 'admin@test.local', password: 'Passw0rd-test' };

const freePort = () =>
	new Promise((resolvePort, reject) => {
		const server = net.createServer();
		server.listen(0, '127.0.0.1', () => {
			const { port } = server.address();
			server.close(() => resolvePort(port));
		});
		server.on('error', reject);
	});

async function waitFor(url, label, ms = 30_000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		try {
			if ((await fetch(url)).status < 500) return;
		} catch {
			// aun no responde
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	throw new Error(`${label} no respondio en ${ms} ms (${url})`);
}

function run(args, env, label) {
	const res = spawnSync('node', args, {
		cwd: ROOT,
		env: { ...process.env, ...env },
		encoding: 'utf8'
	});
	if (res.status !== 0) throw new Error(`${label} fallo:\n${res.stdout}\n${res.stderr}`);
}

/** Levanta PocketBase temporal + servidor compilado + mocks (Clip, SMTP). Se omite sin binario. */
export default async function setup({ provide }) {
	if (!existsSync(PB_BIN)) {
		console.warn(
			'\n[integration] Falta el binario de PocketBase (npm run pb:download): se omiten las pruebas.\n'
		);
		provide('it', null);
		return;
	}

	if (!process.env.IT_SKIP_BUILD) {
		const build = spawnSync('npx', ['vite', 'build'], {
			cwd: ROOT,
			encoding: 'utf8',
			shell: process.platform === 'win32'
		});
		if (build.status !== 0) throw new Error(`vite build fallo:\n${build.stdout}\n${build.stderr}`);
	}

	const tmp = mkdtempSync(join(tmpdir(), 'tienda-it-'));
	const [pbPort, webPort] = [await freePort(), await freePort()];
	const pbUrl = `http://127.0.0.1:${pbPort}`;
	const webUrl = `http://127.0.0.1:${webPort}`;
	const children = [];
	const stops = [];

	const smtp = await startSmtpSink();
	const clip = await startClipMock();
	stops.push(smtp.stop, clip.stop);

	const dataDir = join(tmp, 'pb');
	const su = spawnSync(
		PB_BIN,
		['superuser', 'upsert', SUPERUSER.email, SUPERUSER.password, `--dir=${dataDir}`],
		{ encoding: 'utf8' }
	);
	if (su.status !== 0) throw new Error(`No pude crear el superusuario: ${su.stderr}`);

	const pb = spawn(
		PB_BIN,
		[
			'serve',
			'--automigrate=false',
			`--http=127.0.0.1:${pbPort}`,
			`--dir=${dataDir}`,
			`--migrationsDir=${join(ROOT, 'pocketbase', 'pb_migrations')}`
		],
		{ stdio: process.env.IT_DEBUG ? 'inherit' : 'ignore' }
	);
	children.push(pb);
	await waitFor(`${pbUrl}/api/health`, 'PocketBase');

	const env = {
		PB_URL: pbUrl,
		PB_ADMIN_EMAIL: SUPERUSER.email,
		PB_ADMIN_PASSWORD: SUPERUSER.password
	};
	run(['scripts/permissions-sync.js'], env, 'permissions:sync');
	for (const user of Object.values(USERS)) {
		run(
			['scripts/create-staff.js', '--email', user.email, '--name', user.name, '--role', user.role],
			{ ...env, STAFF_PASSWORD: user.password },
			`create-staff ${user.email}`
		);
	}
	run(['scripts/seed-catalog.js'], env, 'seed:catalog');
	await smtp.configurePocketBase(pbUrl, SUPERUSER, webUrl);

	const web = spawn('node', ['build/index.js'], {
		cwd: ROOT,
		env: {
			...process.env,
			...env,
			PORT: String(webPort),
			HOST: '127.0.0.1',
			PROTOCOL_HEADER: 'x-forwarded-proto',
			BODY_SIZE_LIMIT: '10M',
			CLIP_API_URL: clip.url,
			CLIP_API_KEY: CLIP_KEY,
			CLIP_API_SECRET: CLIP_SECRET,
			CLIP_WEBHOOK_TOKEN
		},
		stdio: process.env.IT_DEBUG ? 'inherit' : 'ignore'
	});
	children.push(web);
	await waitFor(`${webUrl}/`, 'servidor web');

	provide('it', {
		pbUrl,
		webUrl,
		superuser: SUPERUSER,
		users: USERS,
		smtpUrl: smtp.url,
		clipUrl: clip.url,
		clipWebhookToken: CLIP_WEBHOOK_TOKEN
	});

	return async () => {
		for (const child of children) child.kill('SIGTERM');
		for (const stop of stops) await stop();
		rmSync(tmp, { recursive: true, force: true });
	};
}
