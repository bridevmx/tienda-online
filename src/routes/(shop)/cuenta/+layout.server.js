import { requireCustomer } from '#core/guards.js';
import { linkGuestOrders } from '#modules/customers/orders.js';

/** Todo /cuenta exige sesion de cliente. Con el correo verificado, se vinculan sus pedidos de invitado. */
/** @type {import('./$types').LayoutServerLoad} */
export async function load({ locals, url }) {
	const customer = requireCustomer(locals, url);
	if (customer.verified) await linkGuestOrders(await locals.adminPb(), customer);
	return { customer };
}
