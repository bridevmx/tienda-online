import { pricingConfig } from '#core/pricing.js';
import { createStorefront } from '#modules/catalog/storefront.js';

const toPage = (value) => Math.min(Math.max(parseInt(value ?? '1', 10) || 1, 1), 1000);

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, url }) {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	const sort = url.searchParams.get('sort') === 'nombre' ? 'nombre' : 'recientes';
	const store = createStorefront(locals.pb, pricingConfig(await locals.settings()));
	return {
		q,
		sort,
		result: await store.listProducts({ q, sort, page: toPage(url.searchParams.get('page')) })
	};
}
