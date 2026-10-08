import { redirect } from '@sveltejs/kit';
import { SESSION, tokenSubject } from '#core/auth.js';
import { setFlash } from '#core/flash.js';
import { routes } from '#core/routes.js';
import { linkGuestOrders } from '#modules/customers/orders.js';

/** Enlace del correo de verificacion: confirma el correo y vincula los pedidos de invitado. */
/** @type {import('./$types').PageServerLoad} */
export async function load({ params, locals, cookies }) {
	let linked = 0;
	try {
		await locals.customerPb
			.collection(SESSION.customer.collection)
			.confirmVerification(params.token);
		const id = tokenSubject(params.token);
		if (id) {
			const admin = await locals.adminPb();
			const customer = await admin.collection(SESSION.customer.collection).getOne(id);
			linked = await linkGuestOrders(admin, customer);
		}
	} catch (err) {
		if (err?.status !== 400) throw err;
		setFlash(cookies, {
			type: 'error',
			text: 'El enlace de verificación no es válido o ya venció.'
		});
		redirect(303, locals.customer ? routes.account() : routes.login());
	}
	setFlash(cookies, {
		text: linked
			? `Correo verificado. Vinculamos ${linked} pedido(s) a tu cuenta.`
			: 'Correo verificado.'
	});
	redirect(303, locals.customer ? routes.account() : routes.login());
}
