import { env } from '$env/dynamic/private';
import { SESSION, loadCustomer, loadStaff } from '#core/auth.js';
import { getAdminPb } from '#core/pb-admin.js';
import { createPb } from '#core/pb.js';
import { THEME_COOKIE, resolveTheme } from '#core/themes.js';

const pbUrl = () => env.PB_URL || 'http://127.0.0.1:8090';

/**
 * Llena `locals` en cada solicitud. Aqui solo se LEE la sesion; decidir quien entra a donde es
 * trabajo de los `+layout.server.js` de cada grupo de rutas (ver #core/guards.js).
 *
 *   locals.pb          cliente de PocketBase con el token del personal (o anonimo)
 *   locals.user        personal con sesion { id, email, name, role } o null
 *   locals.permissions Set de codigos de permiso del personal
 *   locals.customerPb  cliente de PocketBase con el token del cliente (o anonimo)
 *   locals.customer    cliente con sesion { id, email, name, phone } o null
 *   locals.adminPb()   superusuario; solo checkout de invitado y webhooks
 *   locals.theme       tema de DaisyUI elegido
 */
/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const { locals, cookies } = event;

	locals.theme = resolveTheme(cookies.get(THEME_COOKIE));
	locals.pb = createPb(pbUrl());
	locals.customerPb = createPb(pbUrl());
	locals.user = null;
	locals.permissions = new Set();
	locals.customer = null;
	locals.adminPb = () =>
		getAdminPb({
			url: pbUrl(),
			email: env.PB_ADMIN_EMAIL,
			password: env.PB_ADMIN_PASSWORD
		});

	const staffToken = cookies.get(SESSION.staff.cookie);
	if (staffToken) {
		const staff = await loadStaff(locals.pb, staffToken);
		if (staff) {
			locals.user = staff.user;
			locals.permissions = staff.permissions;
		} else {
			cookies.delete(SESSION.staff.cookie, { path: '/' });
			locals.pb.authStore.clear();
		}
	}

	const customerToken = cookies.get(SESSION.customer.cookie);
	if (customerToken) {
		locals.customer = await loadCustomer(locals.customerPb, customerToken);
		if (!locals.customer) {
			cookies.delete(SESSION.customer.cookie, { path: '/' });
			locals.customerPb.authStore.clear();
		}
	}

	return resolve(event, {
		// el tema se pone en <html> desde el servidor para que no haya parpadeo
		transformPageChunk: ({ html }) => html.replace('%theme%', locals.theme)
	});
}
