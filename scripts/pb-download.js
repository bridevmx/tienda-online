#!/usr/bin/env node
/**
 * Descarga el binario de PocketBase a ./pocketbase (ignorado por git).
 * Uso: npm run pb:download            (ultima version)
 *      PB_VERSION=x.y.z npm run pb:download
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const OS = { linux: 'linux', darwin: 'darwin', win32: 'windows' };
const ARCH = { x64: 'amd64', arm64: 'arm64' };

/** Nombre del archivo de release para una plataforma, ej. pocketbase_0.30.0_linux_amd64.zip */
export function assetName(version, platform = process.platform, arch = process.arch) {
	const os = OS[platform];
	const cpu = ARCH[arch];
	if (!os || !cpu) throw new Error(`Plataforma no soportada: ${platform}/${arch}`);
	return `pocketbase_${version}_${os}_${cpu}.zip`;
}

/** Ultima version estable: primero el redirect de GitHub, si no, el proxy de modulos de Go. */
async function latestVersion() {
	try {
		const res = await fetch('https://github.com/pocketbase/pocketbase/releases/latest', {
			redirect: 'manual'
		});
		const match = (res.headers.get('location') ?? '').match(/\/tag\/v([^/]+)$/);
		if (match) return match[1];
	} catch {
		// se intenta la alternativa
	}
	const res = await fetch('https://proxy.golang.org/github.com/pocketbase/pocketbase/@latest');
	if (!res.ok) throw new Error(`No pude resolver la ultima version (HTTP ${res.status}).`);
	return (await res.json()).Version.replace(/^v/, '');
}

async function main() {
	const dir = fileURLToPath(new URL('../pocketbase', import.meta.url));
	mkdirSync(dir, { recursive: true });

	const version = (process.env.PB_VERSION || (await latestVersion())).replace(/^v/, '');
	const asset = assetName(version);
	const url = `https://github.com/pocketbase/pocketbase/releases/download/v${version}/${asset}`;
	const zip = join(dir, asset);

	console.log(`Descargando PocketBase ${version}...\n${url}`);
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Descarga fallida: HTTP ${res.status}`);
	writeFileSync(zip, Buffer.from(await res.arrayBuffer()));

	if (process.platform === 'win32') execFileSync('tar', ['-xf', zip, '-C', dir]);
	else execFileSync('unzip', ['-o', zip, 'pocketbase', '-d', dir]);
	rmSync(zip);

	const bin = join(dir, process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');
	if (!existsSync(bin)) throw new Error('El zip no contenia el binario esperado.');
	if (process.platform !== 'win32') chmodSync(bin, 0o755);
	writeFileSync(join(dir, '.version'), `${version}\n`);
	console.log(`Listo: ${bin}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((err) => {
		console.error(err.message);
		process.exit(1);
	});
}
