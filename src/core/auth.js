/**
 * Sesiones. Hay dos poblaciones distintas, cada una con su coleccion de autenticacion y su cookie:
 *   - personal (`users`)      -> cookie `pb_staff`, con rol y permisos
 *   - clientes (`customers`)  -> cookie `pb_customer`, solo ven lo suyo
 * La cookie guarda solo el token de PocketBase (httpOnly). En cada solicitud se vuelve a leer el
 * registro con ese token, asi que cambios de rol/permisos o desactivar a alguien aplican de inmediato.
 */
export const SESSION = {
	staff: { cookie: 'pb_staff', collection: 'users' },
	customer: { cookie: 'pb_customer', collection: 'customers' }
};

function decodePayload(token) {
	try {
		const part = String(token).split('.')[1];
		return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
	} catch {
		return null;
	}
}

/** id del registro dueno del token, o null si el token esta mal formado o ya expiro. */
export function tokenSubject(token, now = Date.now()) {
	const payload = decodePayload(token);
	if (!payload?.id || typeof payload.exp !== 'number') return null;
	return payload.exp * 1000 > now ? payload.id : null;
}

/** Segundos de vida que le quedan al token (para el maxAge de la cookie). */
export function tokenMaxAge(token, now = Date.now()) {
	const payload = decodePayload(token);
	if (typeof payload?.exp !== 'number') return 0;
	return Math.max(0, Math.floor(payload.exp - now / 1000));
}

/** Opciones de cookie de sesion. `secure` lo decide SvelteKit (https salvo localhost). */
export function sessionCookieOptions(token) {
	return { path: '/', httpOnly: true, sameSite: 'lax', maxAge: tokenMaxAge(token) };
}

const NOT_LOGGED_IN = new Set([400, 401, 403, 404]);
const isAuthFailure = (err) => NOT_LOGGED_IN.has(err?.status);

/**
 * Inicia sesion en una coleccion. Devuelve el token, o null si las credenciales no son validas
 * (incluye usuarios inactivos: la regla `authRule` de `users` lo rechaza). Otros errores se lanzan.
 */
export async function authenticate(pb, collection, email, password) {
	try {
		const { token } = await pb.collection(collection).authWithPassword(email, password);
		return token;
	} catch (err) {
		if (isAuthFailure(err)) return null;
		throw err;
	}
}

/**
 * Carga al personal a partir del token: usuario, rol y permisos. Devuelve null si no hay sesion
 * valida. Los permisos se leen de `role.permissions` (expand) con el propio token del usuario,
 * asi que las reglas de la base tambien aplican a esta lectura.
 */
export async function loadStaff(pb, token) {
	const id = tokenSubject(token);
	if (!id) return null;
	pb.authStore.save(token, null);
	try {
		const record = await pb.collection(SESSION.staff.collection).getOne(id, {
			expand: 'role.permissions'
		});
		if (record.active === false) return null;
		const role = record.expand?.role ?? null;
		const permissions = new Set((role?.expand?.permissions ?? []).map((p) => p.code));
		return {
			user: {
				id: record.id,
				email: record.email,
				name: record.name,
				role: role ? { id: role.id, name: role.name, slug: role.slug } : null
			},
			permissions
		};
	} catch (err) {
		if (isAuthFailure(err)) return null;
		throw err;
	}
}

/** Carga a un cliente a partir del token. Devuelve null si no hay sesion valida. */
export async function loadCustomer(pb, token) {
	const id = tokenSubject(token);
	if (!id) return null;
	pb.authStore.save(token, null);
	try {
		const record = await pb.collection(SESSION.customer.collection).getOne(id);
		return { id: record.id, email: record.email, name: record.name, phone: record.phone ?? '' };
	} catch (err) {
		if (isAuthFailure(err)) return null;
		throw err;
	}
}
