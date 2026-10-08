#!/usr/bin/env node
/**
 * Producto de PRUEBA para validar Clip con dinero real: "Producto de prueba $1" (SKU PRUEBA-1, precio neto $1.00,
 * 50 piezas). Idempotente. Uso: npm run seed:clip-test
 *
 * El precio guardado es el NETO. Con IVA y comision activados el total con tarjeta sera mayor a $1:
 *   - Para cobrar EXACTAMENTE $1.00: en /admin/ajustes apaga "Aplicar IVA a todos los productos" e "Incluir la comisión de Clip en los precios".
 *   - Para probar los calculos reales (IVA + comision): dejalos encendidos (el total sera ~$1.20).
 * Recuerda volver a encenderlos y borrar o desactivar el producto despues de las pruebas.
 */
import { createCatalogService } from '#modules/catalog/service.js';
import { scriptPb } from './_pb.js';

const pb = await scriptPb();
const catalog = createCatalogService(pb);
const find = (collection, filter, params) =>
	pb
		.collection(collection)
		.getFirstListItem(pb.filter(filter, params))
		.catch((err) => (err?.status === 404 ? null : Promise.reject(err)));

const category =
	(await find('categories', 'slug = {:s}', { s: 'pruebas' })) ??
	(await catalog.categories.create({
		name: 'Pruebas',
		slug: 'pruebas',
		parent: '',
		sort: 99,
		active: true
	}));

const product =
	(await find('products', 'slug = {:s}', { s: 'producto-prueba-1' })) ??
	(await catalog.products.create({
		name: 'Producto de prueba $1',
		slug: 'producto-prueba-1',
		category: category.id,
		description:
			'<p>Producto de prueba para validar los pagos con tarjeta. Borrar o desactivar después.</p>',
		active: true
	}));

const variant =
	(await find('variants', 'sku = {:s}', { s: 'PRUEBA-1' })) ??
	(await catalog.variants.create({
		product: product.id,
		sku: 'PRUEBA-1',
		price: 100,
		stock: 50,
		active: true,
		values: []
	}));

console.log(
	`Producto listo: ${product.name} (SKU ${variant.sku}, precio neto $${(variant.price / 100).toFixed(2)}, stock ${variant.stock})`
);
console.log(
	'Abre /productos/producto-prueba-1. Para cobrar exactamente $1.00 apaga IVA y comisión en /admin/ajustes.'
);
