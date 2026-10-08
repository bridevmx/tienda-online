import { fail, redirect } from '@sveltejs/kit';
import { SESSION } from '#core/auth.js';
import { setFlash } from '#core/flash.js';
import { mailActions, TOO_MANY } from '#core/limits.js';
import { routes } from '#core/routes.js';
import { listCustomerOrders } from '#modules/customers/orders.js';

const toPage = (v) => Math.min(Math.max(parseInt(v ?? '1', 10) || 1, 1), 10000);

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, url }) {
	return listCustomerOrders(
		locals.customerPb,
		locals.customer.id,
		toPage(url.searchParams.get('page'))
	);
}

/** @type {import('./$types').Actions} */
export const actions = {
	resend: async ({ locals, cookies, getClientAddress }) => {
		if (!locals.customer) redirect(303, routes.login());
		if (
			mailActions.hit(`verify:${locals.customer.id}`) ||
			mailActions.hit(`verify:${getClientAddress()}`)
		)
			return fail(429, { errors: { _: TOO_MANY } });
		await locals.customerPb
			.collection(SESSION.customer.collection)
			.requestVerification(locals.customer.email)
			.catch(() => {});
		setFlash(cookies, { text: 'Te enviamos el correo de verificación.' });
		redirect(303, routes.account());
	}
};
