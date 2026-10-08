import { error } from '@sveltejs/kit';
import { pricingConfig } from '#core/pricing.js';
import { createStorefront } from '#modules/catalog/storefront.js';

const toPage = (value) => Math.min(Math.max(parseInt(value ?? '1', 10) || 1, 1), 1000);

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, params, url }) {
	const sort = url.searchParams.get('sort') === 'nombre' ? 'nombre' : 'recientes';
	const store = createStorefront(locals.pb, pricingConfig(await locals.settings()));
	const result = await store.listProducts({
		categorySlug: params.slug,
		sort,
		page: toPage(url.searchParams.get('page'))
	});
	if (!result.category) error(404, 'Categoría no encontrada');
	return { sort, result };
}
