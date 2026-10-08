import { PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, PB_URL } from '$app/env/private';
import { SESSION, loadCustomer, loadStaff } from '#core/auth.js';
import { getAdminPb } from '#core/pb-admin.js';
import { createPb } from '#core/pb.js';
import { readSettings } from '#modules/settings/service.js';
import { THEME_COOKIE, resolveTheme } from '#core/themes.js';

const pbUrl = () => PB_URL;

/**
 * Llena `locals` en cada solicitud. Aqui solo se LEE la sesion; decidir quien entra a donde es
 * trabajo de los `+layout.server.js` de cada grupo de rutas (ver #core/guards.js).
 *
 *   locals.pb          cliente de PocketBase con el token del personal (o anonimo)
 *   locals.user        personal con sesion { id, email, name, role } o null
 *   locals.permissions Set de codigos de permiso del personal
 *   locals.customerPb  cliente de PocketBase con el token del cliente (o anonimo)
 *   locals.customer    cliente con sesion { id, email, name, phone } o null
 *   locals.adminPb()   superusuario; solo checkout/pedidos, webhooks y lectura de ajustes
 *   locals.settings()  ajustes tipados de la tienda (cache de 30 s)
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
			email: PB_ADMIN_EMAIL,
			password: PB_ADMIN_PASSWORD
		});

	locals.settings = () => readSettings(locals.adminPb);

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
