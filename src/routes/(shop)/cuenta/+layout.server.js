import { requireCustomer } from '#core/guards.js';

/** Todo /cuenta exige sesion de cliente. */
/** @type {import('./$types').LayoutServerLoad} */
export function load({ locals, url }) {
	return { customer: requireCustomer(locals, url) };
}
