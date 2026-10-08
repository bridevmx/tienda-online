import { createPb } from './pb.js';

/**
 * Cliente de PocketBase con superusuario. Es la excepcion, no la regla: solo para el checkout de
 * invitados, el webhook de Clip y los scripts. Se obtiene con `locals.adminPb()`; buscar ese
 * nombre en el codigo basta para auditar todos los usos.
 */
const cache = new Map();
const REFRESH_MARGIN_MS = 60_000;

function expiresSoon(pb) {
	const part = pb.authStore.token.split('.')[1];
	try {
		const { exp } = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
		return exp * 1000 - Date.now() < REFRESH_MARGIN_MS;
	} catch {
		return true;
	}
}

export async function getAdminPb({ url, email, password }) {
	if (!email || !password) throw new Error('Faltan PB_ADMIN_EMAIL y PB_ADMIN_PASSWORD');
	const key = `${url}|${email}`;
	const cached = cache.get(key);
	if (cached && cached.authStore.isValid && !expiresSoon(cached)) return cached;

	const pb = createPb(url);
	await pb.collection('_superusers').authWithPassword(email, password);
	cache.set(key, pb);
	return pb;
}
