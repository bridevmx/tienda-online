import { pricingConfig } from '#core/pricing.js';
import { routes } from '#core/routes.js';
import { createStorefront } from '#modules/catalog/storefront.js';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals, url }) {
	const store = createStorefront(locals.pb, pricingConfig(await locals.settings()));
	const { products, categories } = await store.sitemap();
	const entry = (path, updated) =>
		`<url><loc>${esc(url.origin + path)}</loc>${updated ? `<lastmod>${updated.slice(0, 10)}</lastmod>` : ''}</url>`;
	const body = [
		entry(routes.home()),
		entry(routes.products()),
		...categories.map((c) => entry(routes.category(c.slug), c.updated)),
		...products.map((p) => entry(routes.product(p.slug), p.updated))
	].join('');
	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`,
		{
			headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' }
		}
	);
}
