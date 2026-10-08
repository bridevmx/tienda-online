import { pricingConfig } from '#core/pricing.js';
import { createStorefront } from '#modules/catalog/storefront.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
	const store = createStorefront(locals.pb, pricingConfig(await locals.settings()));
	const latest = await store.listProducts({ page: 1, perPage: 8 });
	return { latest: latest.items };
}
