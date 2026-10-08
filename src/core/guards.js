import { error, redirect } from '@sveltejs/kit';
import { can } from './can.js';
import { routes } from './routes.js';

/** Exige sesion de personal; si no, manda al login conservando a donde iba. */
export function requireStaff(locals, url) {
	if (!locals.user) {
		redirect(303, `${routes.admin.login()}?next=${encodeURIComponent(url.pathname + url.search)}`);
	}
	return locals.user;
}

/** Exige un permiso concreto. Sin sesion -> login; con sesion pero sin permiso -> 403. */
export function requirePermission(locals, url, code) {
	const user = requireStaff(locals, url);
	if (!can(locals.permissions, code)) error(403, 'No tienes permiso para esta acción');
	return user;
}

/** Exige sesion de cliente. */
export function requireCustomer(locals, url) {
	if (!locals.customer) {
		redirect(303, `${routes.login()}?next=${encodeURIComponent(url.pathname + url.search)}`);
	}
	return locals.customer;
}
