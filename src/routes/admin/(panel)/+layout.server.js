import { requireStaff } from '#core/guards.js';
import { buildNav } from '#core/resource.js';
import { modules, resources } from '#core/resources.js';
import { routes } from '#core/routes.js';

/** Todo lo que cuelga de (panel) exige sesion de personal. Cada pagina pide ademas su permiso. */
/** @type {import('./$types').LayoutServerLoad} */
export function load({ locals, url }) {
	const user = requireStaff(locals, url);
	return {
		user,
		permissions: [...locals.permissions].sort(),
		nav: buildNav(modules, resources, locals.permissions, routes.admin.list)
	};
}
