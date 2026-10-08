import { routes } from '#core/routes.js';

/**
 * Catalogo del TPV: una pieza por variante vendible, ya aplanada para filtrar en el navegador
 * (nombre, SKU, codigo de barras). Se lee con el PocketBase del cajero: las reglas de la base
 * solo dejan ver lo activo. Trae el precio neto (base) porque el TPV calcula los totales por metodo.
 */
export async function loadPosCatalog(pb) {
	const rows = await pb.collection('variants').getFullList({
		filter: 'active = true',
		expand: 'product.category,values.option',
		sort: 'sku',
		batch: 500
	});
	const items = rows
		.filter((v) => v.expand?.product)
		.map((v) => {
			const product = v.expand.product;
			const label = (v.expand?.values ?? [])
				.map((ov) => ({ sort: ov.expand?.option?.sort ?? 0, value: ov.value }))
				.sort((a, b) => a.sort - b.sort)
				.map((o) => o.value)
				.join(' / ');
			const image = v.image
				? routes.media('variants', v.id, v.image, '240x240')
				: product.images?.[0]
					? routes.media('products', product.id, product.images[0], '240x240')
					: null;
			return {
				id: v.id,
				sku: v.sku,
				barcode: v.barcode ?? '',
				name: product.name,
				label,
				image,
				stock: v.stock,
				base: v.price,
				category: product.expand?.category?.id ?? ''
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name, 'es') || a.label.localeCompare(b.label, 'es'));

	const categories = new Map();
	for (const v of rows) {
		const c = v.expand?.product?.expand?.category;
		if (c) categories.set(c.id, c.name);
	}
	return {
		items,
		categories: [...categories]
			.map(([id, name]) => ({ id, name }))
			.sort((a, b) => a.name.localeCompare(b.name, 'es'))
	};
}

/** Busca por texto (nombre/SKU/codigo) sin acentos ni mayusculas. Pura: se usa en servidor y navegador. */
const fold = (s) =>
	String(s ?? '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase();

export function matchItems(items, query, categoryId = '') {
	const words = fold(query).split(/\s+/).filter(Boolean);
	return items.filter((i) => {
		if (categoryId && i.category !== categoryId) return false;
		const hay = fold(`${i.name} ${i.label} ${i.sku} ${i.barcode}`);
		return words.every((w) => hay.includes(w));
	});
}

/** Lectura de lector de codigos: SKU o codigo de barras EXACTO (ignora mayusculas). */
export function findByCode(items, code) {
	const c = String(code ?? '')
		.trim()
		.toLowerCase();
	if (!c) return null;
	return (
		items.find((i) => i.sku.toLowerCase() === c || (i.barcode && i.barcode.toLowerCase() === c)) ??
		null
	);
}
