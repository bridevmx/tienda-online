import { requireStaff } from '#core/guards.js';

/** Todo lo que cuelga de (panel) exige sesion de personal. Cada pagina pide ademas su permiso. */
/** @type {import('./$types').LayoutServerLoad} */
export function load({ locals, url }) {
	const user = requireStaff(locals, url);
	return { user, permissions: [...locals.permissions].sort() };
}
