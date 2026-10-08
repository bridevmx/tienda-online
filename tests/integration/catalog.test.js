import { describe, it } from 'vitest';
import { createCatalogService } from '#modules/catalog/service.js';
import { DomainError } from '#core/errors.js';
import { createPb } from '#core/pb.js';
import { cfg, enabled, ok, pbAs, pbStaff, su as suPb } from './support.js';

describe.skipIf(!enabled)('catalogo: reglas de PocketBase y servicio', () => {
	it('flujos completos', async () => {
		const PB = cfg.pbUrl;
		const status = async (p) => {
			try {
				await p;
				return 200;
			} catch (e) {
				return e.status ?? 'err';
			}
		};
		const domainErr = async (p) => {
			try {
				await p;
				return null;
			} catch (e) {
				return e;
			}
		};
		const su = await suPb();
		const anon = createPb(PB);
		const caja = await pbStaff('caja');
		const ger = await pbStaff('ger');
		const boss = await pbStaff('boss');
		void boss;
		void pbAs;
		console.log('== Lectura publica y por rol ==');
		const names = async (pb, c, f) =>
			(await pb.collection(c).getFullList(f ? { filter: f } : {})).length;
		ok(
			'anonimo: ve los productos activos y ninguno inactivo',
			(await names(anon, 'products', 'active = false')) === 0 &&
				(await names(anon, 'products')) >= 5
		);
		ok(
			'anonimo: no ve el producto inactivo por slug',
			(await status(
				anon.collection('products').getFirstListItem('slug="playera-descontinuada"')
			)) === 404
		);
		const allVariants = await names(su, 'variants'),
			pubVariants = await names(anon, 'variants');
		ok(
			`anonimo: no ve variantes de productos inactivos (${pubVariants} de ${allVariants})`,
			pubVariants < allVariants
		);
		ok(
			'anonimo: ve opciones y valores',
			(await names(anon, 'options')) >= 2 && (await names(anon, 'option_values')) >= 6
		);
		ok(
			'cajero (products:read): ve tambien el inactivo',
			(await names(caja, 'products', 'active = false')) >= 1
		);
		ok(
			'gerente: ve todo',
			(await names(ger, 'products')) === (await names(su, 'products')) &&
				(await names(ger, 'variants')) === allVariants
		);

		// ---- Escritura por permiso
		const cat = (await su.collection('categories').getFirstListItem('slug="hogar"')).id;
		const newProduct = (slug) => ({ name: slug, slug, category: cat, active: true });
		ok(
			'anonimo no crea productos',
			(await status(anon.collection('products').create(newProduct('x1')))) >= 400
		);
		ok(
			'cajero no crea productos',
			(await status(caja.collection('products').create(newProduct('x2')))) >= 400
		);
		ok(
			'cajero no edita variantes',
			(await status(
				caja
					.collection('variants')
					.update((await su.collection('variants').getFirstListItem('sku="TAZ-CER"')).id, {
						stock: 99
					})
			)) >= 400
		);
		const px = await ger.collection('products').create(newProduct('prueba-ger'));
		ok('gerente crea producto', !!px.id);
		ok(
			'gerente edita producto',
			(await status(ger.collection('products').update(px.id, { name: 'Prueba 2' }))) === 200
		);

		// ---- Restricciones de campos (PocketBase)
		const vbase = { product: px.id, sku: 'PRB-1', price: 1000, stock: 0, active: true };
		ok(
			'stock 0 y precio 0 son validos',
			(await status(
				ger.collection('variants').create({ ...vbase, sku: 'PRB-0', price: 0, stock: 0 })
			)) === 200
		);
		ok(
			'precio negativo rechazado',
			(await status(ger.collection('variants').create({ ...vbase, sku: 'PRB-N', price: -1 }))) >=
				400
		);
		ok(
			'precio con decimales rechazado',
			(await status(ger.collection('variants').create({ ...vbase, sku: 'PRB-D', price: 10.5 }))) >=
				400
		);
		ok(
			'stock negativo rechazado',
			(await status(ger.collection('variants').create({ ...vbase, sku: 'PRB-S', stock: -3 }))) >=
				400
		);
		ok(
			'SKU duplicado rechazado',
			(await status(ger.collection('variants').create({ ...vbase, sku: 'PRB-0' }))) >= 400
		);
		ok(
			'SKU en minuscula rechazado',
			(await status(ger.collection('variants').create({ ...vbase, sku: 'prb-low' }))) >= 400
		);
		ok(
			'slug de producto duplicado rechazado',
			(await status(ger.collection('products').create(newProduct('prueba-ger')))) >= 400
		);
		ok(
			'slug invalido rechazado',
			(await status(ger.collection('products').create({ ...newProduct('x'), slug: 'Mal Slug' }))) >=
				400
		);
		ok(
			'varias variantes sin codigo de barras',
			(await status(ger.collection('variants').create({ ...vbase, sku: 'PRB-B1' }))) === 200 &&
				(await status(ger.collection('variants').create({ ...vbase, sku: 'PRB-B2' }))) === 200
		);
		ok(
			'codigo de barras duplicado rechazado',
			(await status(
				ger.collection('variants').create({ ...vbase, sku: 'PRB-B3', barcode: '123' })
			)) === 200 &&
				(await status(
					ger.collection('variants').create({ ...vbase, sku: 'PRB-B4', barcode: '123' })
				)) >= 400
		);

		// ---- Borrados protegidos
		const ropa = await su.collection('categories').getFirstListItem('slug="ropa"');
		ok(
			'no se borra categoria con subcategorias',
			(await status(ger.collection('categories').delete(ropa.id))) >= 400
		);
		const camis = await su.collection('categories').getFirstListItem('slug="camisetas"');
		ok(
			'no se borra categoria con productos',
			(await status(ger.collection('categories').delete(camis.id))) >= 400
		);
		const talla = await su.collection('options').getFirstListItem('name="Talla"');
		ok(
			'no se borra opcion con valores',
			(await status(ger.collection('options').delete(talla.id))) >= 400
		);
		const mVal = await su
			.collection('option_values')
			.getFirstListItem(`option="${talla.id}" && value="M"`);
		ok(
			'no se borra valor de opcion en uso por una variante',
			(await status(ger.collection('option_values').delete(mVal.id))) >= 400
		);
		const free = await ger
			.collection('option_values')
			.create({ option: talla.id, value: 'XL', sort: 9 });
		ok(
			'si se borra un valor sin uso',
			(await status(ger.collection('option_values').delete(free.id))) === 200
		);
		ok('cajero no borra nada', (await status(caja.collection('products').delete(px.id))) >= 400);
		const nVars = (await su.collection('variants').getFullList({ filter: `product="${px.id}"` }))
			.length;
		ok(
			`borrar producto borra sus variantes (${nVars})`,
			nVars > 0 &&
				(await status(ger.collection('products').delete(px.id))) === 200 &&
				(await su.collection('variants').getFullList({ filter: `product="${px.id}"` })).length === 0
		);
		const lonely = await ger
			.collection('categories')
			.create({ name: 'Sola', slug: 'sola', active: true });
		ok(
			'si se borra una categoria vacia',
			(await status(ger.collection('categories').delete(lonely.id))) === 200
		);

		// ---- Servicio (reglas de integridad)
		const svc = createCatalogService(ger);
		const color = await su.collection('options').getFirstListItem('name="Color"');
		const val = async (opt, v) =>
			(await su.collection('option_values').getFirstListItem(`option="${opt.id}" && value="${v}"`))
				.id;
		const [S, M, L, Negro, Azul] = [
			await val(talla, 'S'),
			mVal.id,
			await val(talla, 'L'),
			await val(color, 'Negro'),
			await val(color, 'Azul')
		];
		const camiseta = await su.collection('products').getFirstListItem('slug="camiseta-basica"');
		const v = (o) => ({ product: camiseta.id, price: 100, stock: 1, ...o });
		let e = await domainErr(svc.variants.create(v({ sku: 'T-DUP', values: [S, M] })));
		ok(
			'variante con dos tallas -> DomainError(values)',
			e instanceof DomainError && e.field === 'values',
			e?.message
		);
		e = await domainErr(svc.variants.create(v({ sku: 'T-ONLY', values: [S] })));
		ok(
			'variante con solo Talla en un producto Talla+Color -> DomainError',
			e instanceof DomainError && /mismas opciones/.test(e.message),
			e?.message
		);
		e = await domainErr(svc.variants.create(v({ sku: 'T-NONE', values: [] })));
		ok(
			'variante sin valores en producto con opciones -> DomainError',
			e instanceof DomainError,
			e?.message
		);
		e = await domainErr(svc.variants.create(v({ sku: 'T-BAD', values: ['zzzzzzzzzzzzzzz'] })));
		ok(
			'valor inexistente -> DomainError',
			e instanceof DomainError && /no existe/.test(e.message),
			e?.message
		);
		e = await domainErr(svc.variants.create(v({ sku: 'CAM-NEG-S', values: [S, Negro] })));
		ok(
			'SKU duplicado -> DomainError(sku/unico)',
			e instanceof DomainError && e.field === 'sku',
			`${e?.field} ${e?.message}`
		);
		e = await domainErr(svc.variants.create(v({ sku: 'T-AZU-L', values: [L, Azul] })));
		ok('variante valida (Talla L + Color Azul) se crea', e === null);
		const nueva = await su.collection('variants').getFirstListItem('sku="T-AZU-L"');
		e = await domainErr(
			svc.variants.update(nueva.id, v({ sku: 'T-AZU-L', values: [L, Azul], price: 200 }))
		);
		ok('actualizar la misma variante no choca consigo misma', e === null);
		e = await domainErr(svc.variants.update(nueva.id, v({ sku: 'T-AZU-L', values: [L] })));
		ok('actualizar dejandola sin Color -> DomainError', e instanceof DomainError, e?.message);
		const mochila = await su.collection('products').getFirstListItem('slug="mochila-urbana"');
		e = await domainErr(
			svc.variants.create({ product: mochila.id, sku: 'MOC-2', price: 1, stock: 1, values: [S] })
		);
		ok('producto simple no admite variante con opciones', e instanceof DomainError, e?.message);
		e = await domainErr(
			svc.variants.create({
				product: camiseta.id,
				sku: 'T-NEG',
				price: '12.5',
				stock: 1,
				values: []
			})
		);
		ok(
			'precio con decimales -> DomainError(price)',
			e instanceof DomainError && e.field === 'price',
			`${e?.field}`
		);

		e = await domainErr(svc.categories.create({ name: 'Nieta', parent: camis.id }));
		ok(
			'subcategoria de una subcategoria -> DomainError (un nivel)',
			e instanceof DomainError && /un nivel/.test(e.message),
			e?.message
		);
		e = await domainErr(
			svc.categories.update(ropa.id, { name: 'Ropa', slug: 'ropa', parent: ropa.id })
		);
		ok('categoria no puede ser su propio padre', e instanceof DomainError, e?.message);
		e = await domainErr(
			svc.categories.update(ropa.id, {
				name: 'Ropa',
				slug: 'ropa',
				parent: (await su.collection('categories').getFirstListItem('slug="hogar"')).id
			})
		);
		ok(
			'categoria con hijos no pasa a ser hija',
			e instanceof DomainError && /subcategorías/.test(e.message),
			e?.message
		);
		e = await domainErr(svc.categories.create({ name: 'Hogar' }));
		ok(
			'slug de categoria duplicado -> DomainError(slug)',
			e instanceof DomainError && e.field === 'slug',
			`${e?.field}`
		);
		e = await domainErr(svc.products.create({ name: 'Sin categoria' }));
		ok(
			'producto sin categoria -> DomainError(category)',
			e instanceof DomainError && e.field === 'category',
			`${e?.field}`
		);
		const tree = await svc.categories.listTree();
		ok(
			'arbol de categorias: Ropa con 2 hijas',
			tree.find((c) => c.slug === 'ropa')?.children.length === 2 && tree.length >= 3
		);
		const full = await svc.products.getBySlug('camiseta-basica');
		ok(
			'getBySlug: variantes con opciones legibles y orden',
			full.variants.length >= 6 &&
				full.variants.every(
					(x) => x.options[0].option === 'Talla' && x.options[1].option === 'Color'
				) &&
				full.category.name === 'Camisetas',
			JSON.stringify(full.variants[0])
		);
		ok('getBySlug: slug inexistente -> null', (await svc.products.getBySlug('nope')) === null);
		const mochilaFull = await svc.products.getBySlug('mochila-urbana');
		ok(
			'producto simple: una variante sin opciones',
			mochilaFull.variants.length === 1 &&
				mochilaFull.variants[0].options.length === 0 &&
				mochilaFull.variants[0].price === 79900
		);
	});
});
