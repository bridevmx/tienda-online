import { sanitizeDescription, stripHtml } from '#core/html.js';
import { priceByMethod } from '#core/pricing.js';
import { routes } from '#core/routes.js';
import { LOW_STOCK } from '#core/crud-format.js';
import { buildOptionModel, defaultSelection } from './variant-model.js';

/** Hasta cuantas piezas se ofrece comprar de una vez (y se revela de existencias). */
export const MAX_VISIBLE_STOCK = 10;

const notFoundToNull = (err) => {
	if (err?.status === 404) return null;
	throw err;
};

export const availabilityOf = (stock) => (stock <= 0 ? 'out' : stock <= LOW_STOCK ? 'low' : 'in');

const imageOf = (collection, record, file, thumb = '480x480') =>
	file ? routes.media(collection, record.id, file, thumb) : null;

/** Precios que ve el cliente: solo `customerView` (nunca la comision), por metodo. */
function publicPrices(basePrice, config) {
	const { card, other, saves } = priceByMethod(basePrice, config);
	return {
		card: card.total,
		other: other.total,
		saves,
		cardIva: card.iva,
		otherDiscount: other.discount
	};
}

/** Variante cruda de PocketBase (con expand values.option) -> variante publica. */
export function toPublicVariant(raw, config, product) {
	const options = (raw.expand?.values ?? [])
		.map((ov) => ({
			optionId: ov.option,
			option: ov.expand?.option?.name ?? '',
			optionSort: ov.expand?.option?.sort ?? 0,
			valueId: ov.id,
			value: ov.value,
			valueSort: ov.sort ?? 0
		}))
		.sort((a, b) => a.optionSort - b.optionSort || a.option.localeCompare(b.option));
	return {
		id: raw.id,
		label: options.map((o) => o.value).join(' / '),
		options,
		// existencias reales solo hasta MAX_VISIBLE_STOCK: basta para decidir cuantas piezas ofrecer
		stock: Math.min(raw.stock, MAX_VISIBLE_STOCK),
		availability: availabilityOf(raw.stock),
		image: imageOf('variants', raw, raw.image) ?? imageOf('products', product, product.images?.[0]),
		prices: publicPrices(raw.price, config)
	};
}

/** Tarjeta de producto para listados. `variants` = variantes activas ya mapeadas. */
export function toProductCard(product, variants) {
	const buyable = variants.filter((v) => v.stock > 0);
	const pool = buyable.length ? buyable : variants;
	const cheapest = pool.length
		? pool.reduce((a, b) => (b.prices.card < a.prices.card ? b : a))
		: null;
	return {
		id: product.id,
		slug: product.slug,
		name: product.name,
		href: routes.product(product.slug),
		image: imageOf('products', product, product.images?.[0]),
		category: product.expand?.category?.name ?? '',
		hasVariants: variants.some((v) => v.options.length > 0),
		availability: buyable.length
			? buyable.some((v) => v.availability === 'in')
				? 'in'
				: 'low'
			: 'out',
		from: cheapest
			? { card: cheapest.prices.card, other: cheapest.prices.other, saves: cheapest.prices.saves }
			: null,
		multiplePrices: new Set(variants.map((v) => v.prices.card)).size > 1
	};
}

const orFilter = (field, ids, prefix) => ({
	expr: ids.map((_, i) => `${field} = {:${prefix}${i}}`).join(' || '),
	params: Object.fromEntries(ids.map((id, i) => [`${prefix}${i}`, id]))
});

/**
 * Lecturas publicas del catalogo (tienda). Siempre filtra por activos (aunque el cliente de
 * PocketBase sea de personal) y nunca devuelve precios base ni existencias exactas.
 * @param pb     cliente de PocketBase (anonimo basta: lo activo es de lectura publica)
 * @param config pricingConfig(...)
 */
export function createStorefront(pb, config) {
	async function variantsFor(products) {
		if (!products.length) return new Map();
		const { expr, params } = orFilter(
			'product',
			products.map((p) => p.id),
			'p'
		);
		const rows = await pb.collection('variants').getFullList({
			filter: pb.filter(`active = true && (${expr})`, params),
			expand: 'values.option',
			sort: 'sku'
		});
		const byProduct = new Map(products.map((p) => [p.id, []]));
		const productById = new Map(products.map((p) => [p.id, p]));
		for (const row of rows)
			byProduct.get(row.product)?.push(toPublicVariant(row, config, productById.get(row.product)));
		return byProduct;
	}

	async function categoryBySlug(slug) {
		return pb
			.collection('categories')
			.getFirstListItem(pb.filter('slug = {:slug} && active = true', { slug }), {
				expand: 'parent'
			})
			.catch(notFoundToNull);
	}

	return {
		/** Categorias raiz activas con sus subcategorias. */
		async categories() {
			const all = await pb
				.collection('categories')
				.getFullList({ filter: 'active = true', sort: 'sort,name' });
			const toNode = (c) => ({
				id: c.id,
				slug: c.slug,
				name: c.name,
				href: routes.category(c.slug),
				image: imageOf('categories', c, c.image)
			});
			return all
				.filter((c) => !c.parent)
				.map((root) => ({
					...toNode(root),
					children: all.filter((c) => c.parent === root.id).map(toNode)
				}));
		},

		/** Listado paginado: { items, page, totalPages, totalItems, category }. */
		async listProducts({
			q = '',
			categorySlug = '',
			page = 1,
			perPage = 12,
			sort = 'recientes'
		} = {}) {
			const parts = ['active = true'];
			const params = {};
			let category = null;
			if (categorySlug) {
				category = await categoryBySlug(categorySlug);
				if (!category) return { items: [], page: 1, totalPages: 0, totalItems: 0, category: null };
				const children = await pb.collection('categories').getFullList({
					filter: pb.filter('parent = {:id} && active = true', { id: category.id })
				});
				const ids = [category.id, ...children.map((c) => c.id)];
				const f = orFilter('category', ids, 'c');
				parts.push(`(${f.expr})`);
				Object.assign(params, f.params);
			}
			if (q) {
				parts.push('(name ~ {:q} || description ~ {:q})');
				params.q = q;
			}
			const result = await pb.collection('products').getList(page, perPage, {
				filter: pb.filter(parts.join(' && '), params),
				sort: sort === 'nombre' ? 'name' : '-created',
				expand: 'category'
			});
			const variants = await variantsFor(result.items);
			return {
				items: result.items.map((p) => toProductCard(p, variants.get(p.id) ?? [])),
				page: result.page,
				totalPages: result.totalPages,
				totalItems: result.totalItems,
				category: category && {
					id: category.id,
					name: category.name,
					slug: category.slug,
					parent: category.expand?.parent
						? { name: category.expand.parent.name, slug: category.expand.parent.slug }
						: null
				}
			};
		},

		/** Producto completo para su pagina, o null. */
		async getProduct(slug) {
			const product = await pb
				.collection('products')
				.getFirstListItem(pb.filter('slug = {:slug} && active = true', { slug }), {
					expand: 'category.parent'
				})
				.catch(notFoundToNull);
			if (!product) return null;
			const variants = (await variantsFor([product])).get(product.id) ?? [];
			const category = product.expand?.category;
			const parent = category?.expand?.parent;
			return {
				id: product.id,
				slug: product.slug,
				name: product.name,
				descriptionHtml: sanitizeDescription(product.description),
				summary: stripHtml(product.description),
				images: (product.images ?? []).map((file) => ({
					thumb: imageOf('products', product, file, '160x160'),
					src: imageOf('products', product, file, '960x0')
				})),
				category: category && {
					name: category.name,
					slug: category.slug,
					href: routes.category(category.slug)
				},
				parentCategory: parent && {
					name: parent.name,
					slug: parent.slug,
					href: routes.category(parent.slug)
				},
				variants,
				options: buildOptionModel(variants),
				defaultSelection: [...defaultSelection(variants).values()]
			};
		},

		/** Slugs publicos para el sitemap. */
		async sitemap() {
			const [products, categories] = await Promise.all([
				pb.collection('products').getFullList({ filter: 'active = true', fields: 'slug,updated' }),
				pb.collection('categories').getFullList({ filter: 'active = true', fields: 'slug,updated' })
			]);
			return { products, categories };
		}
	};
}
