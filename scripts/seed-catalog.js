#!/usr/bin/env node
/**
 * Datos de ejemplo del catalogo (idempotente: lo que ya existe se omite).
 * Uso: npm run seed:catalog
 */
import { slugify } from '#core/slug.js';
import { createCatalogService } from '#modules/catalog/service.js';
import { scriptPb } from './_pb.js';

const pb = await scriptPb();
const catalog = createCatalogService(pb);
const stats = { created: 0, skipped: 0 };

async function ensure(collection, filter, create) {
	const found = await pb
		.collection(collection)
		.getFirstListItem(filter)
		.catch((err) => (err?.status === 404 ? null : Promise.reject(err)));
	if (found) {
		stats.skipped++;
		return found;
	}
	stats.created++;
	return create();
}
const byField = (field, value) => pb.filter(`${field} = {:v}`, { v: value });

// --- categorias ---
const cat = {};
const seedCategory = (key, name, slug, parent = '', sort = 0) =>
	ensure('categories', byField('slug', slug), () =>
		catalog.categories.create({ name, slug, parent, sort, active: true })
	).then((c) => (cat[key] = c));

await seedCategory('ropa', 'Ropa', 'ropa', '', 0);
await seedCategory('camisetas', 'Camisetas', 'camisetas', cat.ropa.id, 0);
await seedCategory('pantalones', 'Pantalones', 'pantalones', cat.ropa.id, 1);
await seedCategory('accesorios', 'Accesorios', 'accesorios', '', 1);
await seedCategory('hogar', 'Hogar', 'hogar', '', 2);

// --- opciones ---
const opt = {};
const seedOption = (key, name, sort, values) =>
	ensure('options', byField('name', name), () =>
		catalog.options.create({ name, sort, values })
	).then(async (o) => {
		const rows = await pb.collection('option_values').getFullList({
			filter: byField('option', o.id),
			sort: 'sort'
		});
		opt[key] = Object.fromEntries(rows.map((r) => [r.value, r.id]));
	});
await seedOption('talla', 'Talla', 0, ['S', 'M', 'L']);
await seedOption('color', 'Color', 1, ['Negro', 'Blanco', 'Azul']);

// --- productos y variantes (precios en centavos) ---
async function seedProduct(product, variants) {
	const p = await ensure('products', byField('slug', slugify(product.name)), () =>
		catalog.products.create(product)
	);
	for (const v of variants) {
		await ensure('variants', byField('sku', v.sku), () =>
			catalog.variants.create({ product: p.id, active: true, ...v })
		);
	}
}

const sizes = ['S', 'M', 'L'];
await seedProduct(
	{
		name: 'Camiseta básica',
		category: cat.camisetas.id,
		description: '<p>Camiseta de algodón de corte regular.</p>'
	},
	['Negro', 'Blanco'].flatMap((color, ci) =>
		sizes.map((size, si) => ({
			sku: `CAM-${color.slice(0, 3).toUpperCase()}-${size}`,
			price: 24900,
			stock: ci === 1 && size === 'L' ? 0 : 10 + si * 5, // una variante agotada para probar
			values: [opt.talla[size], opt.color[color]]
		}))
	)
);
await seedProduct(
	{
		name: 'Pantalón de mezclilla',
		category: cat.pantalones.id,
		description: '<p>Mezclilla resistente, corte recto.</p>'
	},
	sizes.map((size, i) => ({
		sku: `PAN-${size}`,
		price: 59900,
		stock: 8 + i,
		values: [opt.talla[size]]
	}))
);
await seedProduct(
	{ name: 'Gorra', category: cat.accesorios.id, description: '<p>Gorra ajustable.</p>' },
	['Negro', 'Azul'].map((color) => ({
		sku: `GOR-${color.slice(0, 3).toUpperCase()}`,
		price: 19900,
		stock: 20,
		values: [opt.color[color]]
	}))
);
await seedProduct(
	{ name: 'Mochila urbana', category: cat.accesorios.id, description: '<p>Mochila de 20 L.</p>' },
	[{ sku: 'MOC-URB', price: 79900, stock: 6, values: [] }]
);
await seedProduct(
	{ name: 'Taza de cerámica', category: cat.hogar.id, description: '<p>Taza de 350 ml.</p>' },
	[{ sku: 'TAZ-CER', price: 14900, stock: 25, values: [] }]
);
await seedProduct({ name: 'Playera descontinuada', category: cat.camisetas.id, active: false }, [
	{ sku: 'DESC-001', price: 9900, stock: 3, values: [] }
]);

console.log(
	`Catalogo listo: ${stats.created} registro(s) creado(s), ${stats.skipped} ya existian.`
);
