import { error } from '@sveltejs/kit';
import { computeTotals, pricingConfig } from '#core/pricing.js';
import { routes } from '#core/routes.js';
import { createStorefront } from '#modules/catalog/storefront.js';
import {
	findVariant,
	paramsWith,
	selectionFrom,
	valueStates
} from '#modules/catalog/variant-model.js';

const flag = (searchParams, name, fallback) => {
	const value = searchParams.getAll(name).at(-1);
	return value === '1' ? true : value === '0' ? false : fallback;
};

/** Enlace de un chip de opcion: la misma pagina con ese valor elegido (funciona sin JavaScript). */
const chipHref = (slug, ids, extra) => {
	const params = new URLSearchParams();
	for (const id of ids) params.append('v', id);
	for (const [k, v] of Object.entries(extra)) params.set(k, v);
	const query = params.toString();
	return `${routes.product(slug)}${query ? `?${query}` : ''}`;
};

/** @type {import('./$types').PageServerLoad} */
export async function load({ params, url, locals }) {
	const config = pricingConfig(await locals.settings());
	const product = await createStorefront(locals.pb, config).getProduct(params.slug);
	if (!product) error(404, 'Producto no encontrado');

	const model = product.options;
	// ids invalidos o ausentes en la URL: se parte de la primera variante con stock
	let selection = selectionFrom(url.searchParams.getAll('v'), model);
	if (selection.size === 0) selection = selectionFrom(product.defaultSelection, model);
	const variant = findVariant(product.variants, model, selection);
	const states = valueStates(product.variants, model, selection);

	// el simulador del personal conserva sus interruptores al cambiar de opcion
	const staffCanSee = !!locals.user && locals.permissions.has('products:read');
	const simFlags = staffCanSee
		? {
				iva: flag(url.searchParams, 'iva', config.applyIva),
				clip: flag(url.searchParams, 'clip', config.applyFee)
			}
		: null;
	const extra = simFlags ? { iva: simFlags.iva ? '1' : '0', clip: simFlags.clip ? '1' : '0' } : {};

	const options = model.map((option) => ({
		id: option.id,
		name: option.name,
		values: option.values.map((value) => ({
			id: value.id,
			value: value.value,
			selected: selection.get(option.id) === value.id,
			status: states.get(value.id)?.status ?? 'impossible',
			href: chipHref(product.slug, paramsWith(model, selection, option.id, value.id), extra)
		}))
	}));

	let simulator = null;
	if (staffCanSee && variant) {
		const row = await locals.pb
			.collection('variants')
			.getOne(variant.id)
			.catch(() => null);
		if (row) {
			const sim = { ...config, applyIva: simFlags.iva, applyFee: simFlags.clip };
			simulator = {
				flags: simFlags,
				base: row.price,
				rates: { iva: sim.ivaBp / 100, clip: sim.feeBp / 100, fixed: sim.feeFixed },
				card: computeTotals({ baseCents: row.price, method: 'card_clip', config: sim }),
				other: computeTotals({ baseCents: row.price, method: 'transfer', config: sim })
			};
		}
	}

	return {
		product,
		options,
		variant,
		incomplete: model.length > 0 && !variant && selection.size < model.length,
		simulator,
		// los enlaces de la galeria y la URL canonica no llevan la seleccion
		canonical: routes.product(product.slug)
	};
}
