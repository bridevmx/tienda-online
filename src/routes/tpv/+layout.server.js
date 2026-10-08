import { requirePermission } from '#core/guards.js';

/** Todo /tpv exige el permiso pos:use (gerente y cajero). */
/** @type {import('./$types').LayoutServerLoad} */
export async function load({ locals, url }) {
	const user = requirePermission(locals, url, 'pos:use');
	let storeName = 'Tienda';
	try {
		storeName = (await locals.settings())['store.name'];
	} catch {
		// sin ajustes se usa el nombre por defecto
	}
	return {
		cashier: { name: user.name },
		storeName,
		canAdmin: locals.permissions.has('orders:read')
	};
}
