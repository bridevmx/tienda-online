import { fail, redirect } from '@sveltejs/kit';
import { CART_COOKIE, parseCart } from '#core/cart.js';
import { DomainError } from '#core/errors.js';
import { setFlash } from '#core/flash.js';
import { computeTotals, pricingConfig } from '#core/pricing.js';
import { routes } from '#core/routes.js';
import { formDataToObject } from '#core/validate.js';
import { buildCart } from '#modules/store/cart-view.js';

/** Metodos de pago de la tienda web (el efectivo es solo del TPV). */
const WEB_METHODS = [
	{ id: 'card_clip', label: 'Tarjeta de crédito o débito', hint: 'Pagas en una página segura.' },
	{ id: 'transfer', label: 'Transferencia bancaria', hint: 'Te damos los datos para transferir.' }
];

const availability = (settings, clip) => ({
	card_clip: clip.isConfigured,
	transfer: !!settings['transfer.clabe']
});

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, cookies }) {
	const lines = parseCart(cookies.get(CART_COOKIE));
	if (!lines.length) redirect(303, routes.cart());

	const settings = await locals.settings();
	const config = pricingConfig(settings);
	const { view, server } = await buildCart(locals.pb, lines, config);
	if (!view.canCheckout) redirect(303, routes.cart());

	const available = availability(settings, locals.clip);
	const methods = WEB_METHODS.map((m) => ({
		...m,
		available: available[m.id],
		// solo lo que ve el cliente: subtotal, descuento, IVA y total de ese metodo
		totals: computeTotals({ baseCents: server.baseTotal, method: m.id, config }).customerView
	}));
	const customer = locals.customer;
	return {
		cart: view,
		methods,
		values: {
			name: customer?.name ?? '',
			email: customer?.email ?? '',
			phone: customer?.phone ?? '',
			method: methods.find((m) => m.available)?.id ?? ''
		}
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	default: async ({ request, locals, cookies, url }) => {
		const lines = parseCart(cookies.get(CART_COOKIE));
		if (!lines.length) redirect(303, routes.cart());

		const form = formDataToObject(await request.formData());
		const values = {
			name: String(form.name ?? ''),
			email: String(form.email ?? ''),
			phone: String(form.phone ?? ''),
			method: String(form.method ?? '')
		};

		let placed;
		try {
			placed = await (
				await locals.sales()
			).placeOrder({
				channel: 'web',
				method: values.method,
				lines: lines.map((l) => ({ variant: l.variant, qty: l.qty })),
				contact: { name: values.name, email: values.email, phone: values.phone },
				customerId: locals.customer?.id ?? '',
				origin: url.origin
			});
		} catch (err) {
			if (err instanceof DomainError) {
				// algo cambio en el carrito (sin stock, producto retirado): se explica en el carrito
				if (err.field === 'lines') {
					setFlash(cookies, { type: 'error', text: err.message });
					redirect(303, routes.cart());
				}
				return fail(400, { errors: { [err.field]: err.message }, values });
			}
			throw err;
		}

		cookies.delete(CART_COOKIE, { path: '/' });
		setFlash(cookies, { text: 'Recibimos tu pedido' });
		const { order, action } = placed;
		// tarjeta: se va directo a la pagina de pago; si regresa, ve el estado en /pedido
		if (action.type === 'redirect') redirect(303, action.url, { external: true });
		redirect(303, routes.order(order.code, order.accessToken));
	}
};
