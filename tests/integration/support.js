import http from 'node:http';
import { expect, inject } from 'vitest';
import { createPb } from '#core/pb.js';

/** Configuracion de la instancia de pruebas (null si no hay binario de PocketBase). */
export const cfg = inject('it');
export const enabled = !!cfg;

/** Pequeno PNG valido (1x1) para probar subidas de imagenes. */
export const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);

/** Afirmacion con nombre: el nombre aparece en el mensaje si falla. */
export const ok = (name, condition, extra = '') =>
	expect(condition, `${name}${condition ? '' : ` :: ${String(extra).slice(0, 400)}`}`).toBe(true);

// ---------------------------------------------------------------- web (SvelteKit)
/** Peticion HTTP cruda (node:http, para poder enviar Origin como un navegador). */
export function raw(path, { method = 'GET', headers = {}, body } = {}) {
	return new Promise((resolve, reject) => {
		const req = http.request(cfg.webUrl + path, { method, headers }, (res) => {
			const chunks = [];
			res.on('data', (c) => chunks.push(c));
			res.on('end', () => {
				const buf = Buffer.concat(chunks);
				resolve({
					status: res.statusCode,
					headers: {
						get: (k) => res.headers[k.toLowerCase()] ?? null,
						setCookies: res.headers['set-cookie'] || []
					},
					buf,
					text: buf.toString('utf8')
				});
			});
		});
		req.on('error', reject);
		if (body) req.write(body);
		req.end();
	});
}

/** "Navegador" con cookies: get / post (formulario) / multipart (con archivos). */
export function client() {
	const jar = new Map();
	const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
	const send = async (path, opts = {}) => {
		const headers = {
			origin: cfg.webUrl,
			'x-forwarded-proto': 'http',
			'x-forwarded-for': ip,
			accept: 'text/html',
			...(opts.headers || {})
		};
		if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
		const res = await raw(path, { ...opts, headers });
		res.cookiesSet = {};
		for (const c of res.headers.setCookies) {
			const [kv] = c.split('; ');
			const k = kv.slice(0, kv.indexOf('='));
			const v = kv.slice(kv.indexOf('=') + 1);
			res.cookiesSet[k] = c;
			if (/max-age=0/i.test(c) || v === '') jar.delete(k);
			else jar.set(k, v);
		}
		res.flash = jar.get('flash') ? decodeURIComponent(jar.get('flash')) : null;
		res.location = res.headers.get('location');
		return res;
	};
	const get = (path, headers) => send(path, { headers });
	const post = (path, fields) =>
		send(path, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields).toString()
		});
	/** fields: [[k, v], ...]; files: [{ name, filename, type, data }] */
	const multipart = (path, fields, files = []) => {
		const b = `----it${Math.random().toString(16).slice(2)}`;
		const parts = [];
		for (const [k, v] of fields)
			parts.push(
				Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
			);
		for (const f of files) {
			parts.push(
				Buffer.concat([
					Buffer.from(
						`--${b}\r\nContent-Disposition: form-data; name="${f.name}"; filename="${f.filename}"\r\nContent-Type: ${f.type}\r\n\r\n`
					),
					f.data,
					Buffer.from('\r\n')
				])
			);
		}
		parts.push(Buffer.from(`--${b}--\r\n`));
		return send(path, {
			method: 'POST',
			headers: { 'content-type': `multipart/form-data; boundary=${b}` },
			body: Buffer.concat(parts)
		});
	};
	return { jar, get, post, multipart };
}

/** Navegador con sesion de personal (boss | ger | caja) o por correo y contrasena. */
export async function staff(who) {
	const user = cfg.users[who] ?? who;
	const c = client();
	await c.post('/admin/entrar', { email: user.email, password: user.password });
	return c;
}

// ---------------------------------------------------------------- PocketBase
/** API REST de PocketBase con token opcional. */
export async function pbRaw(path, { token, method = 'GET', body } = {}) {
	const res = await fetch(cfg.pbUrl + path, {
		method,
		headers: { 'content-type': 'application/json', ...(token ? { Authorization: token } : {}) },
		body: body ? JSON.stringify(body) : undefined
	});
	let json = null;
	try {
		json = await res.json();
	} catch {
		// sin cuerpo
	}
	return { status: res.status, json };
}
export const pbLogin = async (collection, identity, password) =>
	(
		await pbRaw(`/api/collections/${collection}/auth-with-password`, {
			method: 'POST',
			body: { identity, password }
		})
	).json;

/** SDK autenticado como personal, cliente o superusuario. */
export async function pbAs(collection, email, password) {
	const pb = createPb(cfg.pbUrl);
	await pb.collection(collection).authWithPassword(email, password);
	return pb;
}
export const pbStaff = (who) => pbAs('users', cfg.users[who].email, cfg.users[who].password);
let superuser;
export async function su() {
	superuser ??= await pbAs('_superusers', cfg.superuser.email, cfg.superuser.password);
	return superuser;
}
export const first = async (collection, filter) =>
	(await su()).collection(collection).getFirstListItem(filter);
export const count = async (collection, filter) =>
	(await (await su()).collection(collection).getList(1, 1, { filter })).totalItems;
export const uid = () => Math.random().toString(36).slice(2, 8);

// ---------------------------------------------------------------- ajustes
const DEFAULT_SETTINGS_FORM = {
	'store.name': 'Tienda online',
	'store.contact_email': '',
	'store.contact_phone': '',
	'tax.apply_iva': 'on',
	'tax.iva_rate': '16',
	'clip.apply_fee': 'off',
	'clip.fee_rate': '2.9',
	'clip.fee_fixed': '0',
	'pricing.discount_non_card': 'on',
	'orders.pending_ttl_hours': '24',
	'transfer.beneficiary': '',
	'transfer.bank': '',
	'transfer.clabe': '',
	'transfer.instructions': ''
};

/** Guarda ajustes como admin: parte de los valores por defecto y aplica `patch` (para no depender del orden de las pruebas). */
export async function saveSettings(boss, patch = {}) {
	const res = await boss.post('/admin/ajustes', { ...DEFAULT_SETTINGS_FORM, ...patch });
	if (res.status !== 200)
		throw new Error(`No pude guardar ajustes (${res.status}): ${res.text.slice(0, 300)}`);
}

// ---------------------------------------------------------------- Clip (doble)
const clipCall = (path) =>
	fetch(`${cfg.clipUrl}/__mock/${path}`, { method: 'POST' }).then((r) => r.json());
export const clipMock = {
	complete: (id) => clipCall(`complete/${id}`),
	cancel: (id) => clipCall(`cancel/${id}`),
	failNext: () => clipCall('fail-next'),
	reset: () => clipCall('reset'),
	requests: () => fetch(`${cfg.clipUrl}/__mock/requests`).then((r) => r.json())
};

/** Envia a la tienda un aviso como el de Clip (con o sin el token correcto). */
export function sendClipWebhook(payload, { token = cfg?.clipWebhookToken, body } = {}) {
	return raw(`/api/webhooks/clip${token === null ? '' : `?token=${encodeURIComponent(token)}`}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'x-forwarded-proto': 'http' },
		body: body ?? JSON.stringify(payload)
	});
}

// ---------------------------------------------------------------- pedidos
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Carrito de un "navegador": agrega variantes por SKU y devuelve el cliente. */
export async function cartWith(items, browser = client()) {
	for (const [sku, qty] of items) {
		const variant = await first('variants', `sku="${sku}"`);
		const res = await browser.post('/carrito?/add', { variant: variant.id, qty: String(qty) });
		if (res.status !== 303) throw new Error(`No pude agregar ${sku}: ${res.status}`);
	}
	return browser;
}

/** Pedido por codigo (superusuario). */
export const orderByCode = (code) => first('orders', `code="${code}"`);
export const stockOf = async (sku) => (await first('variants', `sku="${sku}"`)).stock;

/** Codigo y token del pedido a partir de la URL de redireccion /pedido/<codigo>?t=<token>. */
export function parseOrderLocation(location) {
	const m = String(location ?? '').match(/^\/pedido\/([A-Z]-\d{8}-[A-Z0-9]+)(?:\?t=([^&]+))?/);
	return m ? { code: m[1], token: m[2] ? decodeURIComponent(m[2]) : '' } : null;
}

/** Ejecuta un script de scripts/ contra la instancia de pruebas. */
export function runScript(script, args = [], env = {}) {
	const root = resolve(import.meta.dirname, '../..');
	return spawnSync('node', [script, ...args], {
		cwd: root,
		encoding: 'utf8',
		env: {
			...process.env,
			PB_URL: cfg.pbUrl,
			PB_ADMIN_EMAIL: cfg.superuser.email,
			PB_ADMIN_PASSWORD: cfg.superuser.password,
			...env
		}
	});
}

// ---------------------------------------------------------------- correo (sumidero SMTP)
export const inbox = {
	all: () => fetch(cfg.inboxUrl).then((r) => r.json()),
	clear: () => fetch(cfg.inboxUrl, { method: 'DELETE' }),
	/** Ultimo correo para esa direccion (espera un poco: PocketBase lo envia en segundo plano). */
	async last(to, { tries = 30 } = {}) {
		for (let i = 0; i < tries; i++) {
			const mail = (await inbox.all()).filter((m) => m.to.some((t) => t.includes(to))).pop();
			if (mail) return mail;
			await new Promise((r) => setTimeout(r, 100));
		}
		return null;
	},
	/** Primer enlace de la tienda en el cuerpo (ruta relativa). */
	link: (mail) =>
		mail?.body.match(/href="[^"]*?(\/(?:verificar|recuperar|correo)\/[^"]+)"/)?.[1] ?? null
};
