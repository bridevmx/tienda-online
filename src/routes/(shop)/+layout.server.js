import { CART_COOKIE, cartCount, parseCart } from '#core/cart.js';
import { pricingConfig } from '#core/pricing.js';
import { createStorefront } from '#modules/catalog/storefront.js';

/** Datos comunes de la tienda: categorias del menu, cantidad en el carrito, contacto y sesion. */
/** @type {import('./$types').LayoutServerLoad} */
export async function load({ locals, cookies }) {
	const settings = await locals.settings();
	const config = pricingConfig(settings);
	return {
		categories: await createStorefront(locals.pb, config).categories(),
		cartCount: cartCount(parseCart(cookies.get(CART_COOKIE))),
		contact: { email: settings['store.contact_email'], phone: settings['store.contact_phone'] },
		// el precio que ve el cliente ya trae el IVA incluido cuando esta activo
		ivaIncluded: config.applyIva,
		account: locals.customer ? { name: locals.customer.name } : null
	};
}
