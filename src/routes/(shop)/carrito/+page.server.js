import { redirect } from '@sveltejs/kit';
import {
	CART_COOKIE,
	CART_COOKIE_OPTIONS,
	MAX_QTY,
	addLine,
	parseCart,
	removeLine,
	serializeCart,
	setQty
} from '#core/cart.js';
import { setFlash } from '#core/flash.js';
import { pricingConfig } from '#core/pricing.js';
import { routes } from '#core/routes.js';
import { buildCart } from '#modules/store/cart-view.js';

const readLines = (cookies) => parseCart(cookies.get(CART_COOKIE));
const saveLines = (cookies, lines) => {
	if (lines.length) cookies.set(CART_COOKIE, serializeCart(lines), CART_COOKIE_OPTIONS);
	else cookies.delete(CART_COOKIE, { path: '/' });
};
const id = (v) => String(v ?? '');
const qtyOf = (v) => {
	const n = Number(v);
	return Number.isInteger(n) ? Math.min(Math.max(n, 0), MAX_QTY) : 0;
};

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, cookies }) {
	const { view } = await buildCart(
		locals.pb,
		readLines(cookies),
		pricingConfig(await locals.settings())
	);
	return { cart: view };
}

/** Variante publica (activa, de un producto activo) o null. */
const findVariant = (pb, variantId) =>
	pb
		.collection('variants')
		.getOne(variantId, { expand: 'product' })
		.then((v) => (v.active && v.expand?.product?.active !== false ? v : null))
		.catch((err) => (err?.status === 404 ? null : Promise.reject(err)));

/** @type {import('./$types').Actions} */
export const actions = {
	/** Agrega una variante (la cantidad se limita a las existencias). */
	add: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const variantId = id(form.get('variant'));
		const qty = Math.max(qtyOf(form.get('qty')), 1);
		const variant = /^[a-z0-9]{15}$/.test(variantId)
			? await findVariant(locals.pb, variantId)
			: null;
		if (!variant) {
			setFlash(cookies, { type: 'error', text: 'Ese producto ya no está disponible' });
			redirect(303, routes.cart());
		}
		if (variant.stock <= 0) {
			setFlash(cookies, { type: 'error', text: 'Ese producto está agotado' });
			redirect(303, routes.cart());
		}
		const lines = readLines(cookies);
		const have = lines.find((l) => l.variant === variantId)?.qty ?? 0;
		const wanted = have + qty;
		const next = addLine(lines, variantId, Math.min(wanted, variant.stock) - have);
		saveLines(cookies, next);
		if (wanted > variant.stock) {
			setFlash(cookies, {
				type: 'info',
				text: `Solo hay ${variant.stock} disponibles; ajustamos la cantidad`
			});
		} else {
			setFlash(cookies, { text: 'Agregado al carrito' });
		}
		redirect(303, routes.cart());
	},

	/** Cambia la cantidad (0 la quita). */
	set: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const variantId = id(form.get('variant'));
		let qty = qtyOf(form.get('qty'));
		if (qty > 0) {
			const variant = await findVariant(locals.pb, variantId);
			if (variant && qty > variant.stock) {
				qty = Math.max(variant.stock, 0);
				setFlash(cookies, { type: 'info', text: `Solo hay ${variant.stock} disponibles` });
			}
		}
		saveLines(cookies, setQty(readLines(cookies), variantId, qty));
		redirect(303, routes.cart());
	},

	remove: async ({ request, cookies }) => {
		const variantId = id((await request.formData()).get('variant'));
		saveLines(cookies, removeLine(readLines(cookies), variantId));
		redirect(303, routes.cart());
	},

	clear: async ({ cookies }) => {
		saveLines(cookies, []);
		redirect(303, routes.cart());
	}
};
