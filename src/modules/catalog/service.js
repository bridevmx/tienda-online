import { DomainError } from '#core/errors.js';
import { guard } from '#core/pb-errors.js';
import {
	categorySchema,
	optionSchema,
	optionValueSchema,
	productSchema,
	variantSchema
} from './schema.js';
import { checkCategoryParent, checkVariantOptions } from './rules.js';

/** Valida con Zod; ante un error lanza un DomainError con el primer problema y su campo. */
function parse(schema, input) {
	const result = schema.safeParse(input);
	if (result.success) return result.data;
	const issue = result.error.issues[0];
	throw new DomainError(issue.message, { field: issue.path.join('.') || '_' });
}

const notFoundToNull = (err) => {
	if (err?.status === 404) return null;
	throw err;
};

/**
 * Servicio del catalogo. Recibe un cliente de PocketBase (con la sesion del que llama, asi las
 * reglas de la base tambien aplican). Las rutas no usan `pb.collection(...)` directo: pasan por aqui.
 * Precios en centavos enteros.
 */
export function createCatalogService(pb) {
	// ---------- categorias ----------
	async function assertParent(id, data) {
		if (!data.parent) return;
		const parent = await pb.collection('categories').getOne(data.parent).catch(notFoundToNull);
		const hasChildren = id
			? (
					await pb
						.collection('categories')
						.getList(1, 1, { filter: pb.filter('parent = {:id}', { id }) })
				).totalItems > 0
			: false;
		checkCategoryParent({ id, parentId: data.parent, parent, hasChildren });
	}

	const categories = {
		async create(input) {
			const data = parse(categorySchema, input);
			await assertParent(null, data);
			return guard(() => pb.collection('categories').create(data));
		},
		async update(id, input) {
			const data = parse(categorySchema, input);
			await assertParent(id, data);
			return guard(() => pb.collection('categories').update(id, data));
		},
		/** Categorias activas como arbol de un nivel: [{ ...raiz, children: [...] }]. */
		async listTree() {
			const all = await pb.collection('categories').getFullList({ sort: 'sort,name' });
			const roots = all.filter((c) => !c.parent).map((c) => ({ ...c, children: [] }));
			const byId = new Map(roots.map((c) => [c.id, c]));
			for (const child of all.filter((c) => c.parent)) byId.get(child.parent)?.children.push(child);
			return roots;
		}
	};

	// ---------- opciones y valores ----------
	const options = {
		/** Crea la opcion y, si se pasan, sus valores en orden: create({ name: 'Talla', values: ['S', 'M'] }). */
		async create({ values = [], ...input }) {
			const data = parse(optionSchema, input);
			const option = await guard(() => pb.collection('options').create(data));
			const created = [];
			for (const [i, value] of values.entries()) {
				created.push(await options.addValue({ option: option.id, value, sort: i }));
			}
			return { ...option, values: created };
		},
		async addValue(input) {
			const data = parse(optionValueSchema, input);
			return guard(() => pb.collection('option_values').create(data));
		}
	};

	// ---------- productos ----------
	const products = {
		async create(input) {
			const data = parse(productSchema, input);
			return guard(() => pb.collection('products').create(data));
		},
		async update(id, input) {
			const data = parse(productSchema, input);
			return guard(() => pb.collection('products').update(id, data));
		},
		/** Producto por slug con su categoria y sus variantes (cada una con sus opciones legibles). */
		async getBySlug(slug) {
			const product = await pb
				.collection('products')
				.getFirstListItem(pb.filter('slug = {:slug}', { slug }), { expand: 'category' })
				.catch(notFoundToNull);
			if (!product) return null;

			const rows = await pb.collection('variants').getFullList({
				filter: pb.filter('product = {:id}', { id: product.id }),
				expand: 'values.option',
				sort: 'sku'
			});
			const variants = rows.map((v) => ({
				id: v.id,
				sku: v.sku,
				barcode: v.barcode,
				price: v.price,
				stock: v.stock,
				active: v.active,
				image: v.image,
				options: (v.expand?.values ?? [])
					.map((ov) => ({
						optionId: ov.option,
						option: ov.expand?.option?.name,
						optionSort: ov.expand?.option?.sort ?? 0,
						valueId: ov.id,
						value: ov.value
					}))
					.sort((a, b) => a.optionSort - b.optionSort || a.option.localeCompare(b.option))
			}));
			return { ...product, category: product.expand?.category ?? null, variants };
		}
	};

	// ---------- variantes ----------
	/** Reglas de integridad: sin opcion repetida y mismas opciones que las demas variantes del producto. */
	async function assertVariantOptions(productId, valueIds, excludeId) {
		let optionIds = [];
		if (valueIds.length) {
			const params = Object.fromEntries(valueIds.map((id, i) => [`v${i}`, id]));
			const filter = pb.filter(valueIds.map((_, i) => `id = {:v${i}}`).join(' || '), params);
			const rows = await pb.collection('option_values').getFullList({ filter });
			const optionOf = new Map(rows.map((r) => [r.id, r.option]));
			if ([...new Set(valueIds)].some((id) => !optionOf.has(id))) {
				throw new DomainError('Alguno de los valores de opción no existe', { field: 'values' });
			}
			optionIds = valueIds.map((id) => optionOf.get(id));
		}
		const siblings = await pb.collection('variants').getFullList({
			filter: excludeId
				? pb.filter('product = {:p} && id != {:x}', { p: productId, x: excludeId })
				: pb.filter('product = {:p}', { p: productId }),
			expand: 'values'
		});
		const siblingSets = siblings.map((v) => (v.expand?.values ?? []).map((ov) => ov.option));
		checkVariantOptions(optionIds, siblingSets);
	}

	const variants = {
		async create(input) {
			const data = parse(variantSchema, input);
			await assertVariantOptions(data.product, data.values, null);
			return guard(() => pb.collection('variants').create(data));
		},
		async update(id, input) {
			const data = parse(variantSchema, input);
			await assertVariantOptions(data.product, data.values, id);
			return guard(() => pb.collection('variants').update(id, data));
		}
	};

	return { categories, options, products, variants };
}
